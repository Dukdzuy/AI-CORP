import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IActionStrategy } from '../../../domain/agent/interfaces/IActionStrategy.interface';
import { AgentContext, AgentThought, AgentActionResult } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { AgentLLMService } from '../services/agent-llm.service';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { AgentRole, ModelRouteConfig } from '@ai-corp/shared-types';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProjectWorkspace } from '../../workspace/project-workspace.service';
import { SourceFile, TraceabilityService, TraceUseCase } from '../services/traceability.service';

/**
 * QC (Quality Control) action: product-side verification of the generated project.
 *
 * 1. Derives acceptance test suites from the BA's use cases (one describe('UC-xxx: ...') per use case)
 * 2. Writes them under tests/ in the project workspace
 * 3. Builds the traceability matrix use case → domain class → implementation → test
 * 4. Persists the coverage to ooadMetadata and alerts below 80%
 *
 * QA (process-side) then reviews the implementation against the design using this report.
 */
@Injectable()
export class QcActionStrategy implements IActionStrategy {
  private readonly logger = new Logger(QcActionStrategy.name);
  private readonly systemPrompt =
    'You are a QC (Quality Control) engineer. You derive executable acceptance tests from use cases and verify that the implementation covers every use case.';
  private readonly modelConfig: ModelRouteConfig = {
    provider: 'opencode',
    model: 'openrouter/openrouter/free',
    fallbackProvider: 'opencode',
  };

  constructor(
    private readonly memoryService: MemoryService,
    private readonly agentLLM: AgentLLMService,
    private readonly websocketGateway: AppWebSocketGateway,
    private readonly prisma: PrismaService,
    private readonly workspace: ProjectWorkspace,
    private readonly traceability: TraceabilityService
  ) {}

  async act(context: AgentContext, thought: AgentThought): Promise<AgentActionResult> {
    const projectId = context.projectId;
    if (!projectId || projectId === 'unknown') {
      return { success: false, output: null, error: 'QC needs a project to verify' };
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ooadMetadata: true },
    });
    const metadata = (project?.ooadMetadata as any) || {};

    const useCases = await this.loadUseCases(projectId, metadata);
    const entities: string[] = (metadata.domainModel?.entities || []).map((e: any) => e.name);
    const sourceFiles = await this.loadFiles(projectId);

    // 1-2. Acceptance tests for the use cases that have none yet
    const before = this.traceability.build(useCases, entities, sourceFiles);
    const testsWritten = before.missingUseCases.length > 0
      ? await this.writeAcceptanceTests(context, thought, useCases.filter(uc => before.missingUseCases.includes(uc.id)), sourceFiles)
      : [];

    // 3. Traceability over the final set of files
    const report = testsWritten.length > 0
      ? this.traceability.build(useCases, entities, await this.loadFiles(projectId))
      : before;
    await this.workspace.writeFile(projectId, 'docs/traceability-matrix.md', report.markdown);

    // 4. Persist coverage for the OOAD metrics dashboard
    const updatedMetadata = JSON.parse(JSON.stringify({
      ...metadata,
      testCoverage: report.coveragePercent,
      traceability: {
        coveredCount: report.coveredCount,
        totalCount: report.totalCount,
        missingUseCases: report.missingUseCases,
        generatedAt: new Date().toISOString(),
      },
    }));
    await this.prisma.project.update({
      where: { id: projectId },
      data: { ooadMetadata: updatedMetadata as Prisma.InputJsonValue },
    });

    const qcPassed = report.totalCount > 0 && report.coveragePercent >= TraceabilityService.COVERAGE_THRESHOLD;
    if (!qcPassed) {
      this.websocketGateway.sendToProject(projectId, {
        type: 'quality_warning',
        payload: {
          message: `Use case test coverage is ${report.coveragePercent}% (below ${TraceabilityService.COVERAGE_THRESHOLD}%)`,
          missingUseCases: report.missingUseCases,
          severity: 'warning',
        },
      });
    }

    const agentId = await this.memoryService.getAgentIdByRole(AgentRole.QC);
    if (agentId) {
      await this.memoryService.saveMemory(
        agentId,
        AgentRole.QC,
        'test_design',
        `Verified ${report.totalCount} use cases, coverage ${report.coveragePercent}%, wrote ${testsWritten.length} test file(s)`,
        { importance: 6, projectId }
      );
    }

    this.websocketGateway.sendToProject(projectId, {
      type: 'agent:action',
      payload: {
        agentId: AgentRole.QC,
        agentRole: AgentRole.QC,
        taskId: context.taskId || 'none',
        actionType: 'verify',
        toolName: 'llm+traceability',
        parameters: { coverage: report.coveragePercent, testsWritten },
      },
    });

    return {
      success: true,
      output: {
        action: 'verify',
        output: report.markdown,
        qc_passed: qcPassed,
        testCoverage: report.coveragePercent,
        missingUseCases: report.missingUseCases,
        testsWritten,
        qcReport: report.markdown,
      },
    };
  }

  private async loadUseCases(projectId: string, metadata: any): Promise<TraceUseCase[]> {
    if (metadata.useCases?.length) {
      return metadata.useCases.map((uc: any) => ({ id: uc.id, name: uc.name, priority: uc.priority }));
    }
    const md = await this.workspace.readFile(projectId, 'docs/use-cases.md');
    return md ? this.traceability.parseUseCasesMarkdown(md) : [];
  }

  private async loadFiles(projectId: string): Promise<SourceFile[]> {
    const paths = (await this.workspace.listFiles(projectId)).filter(p => /\.[jt]sx?$/.test(p));
    const files: SourceFile[] = [];
    for (const p of paths) {
      const content = await this.workspace.readFile(projectId, p);
      if (content !== null) files.push({ path: p, content });
    }
    return files;
  }

  private async writeAcceptanceTests(
    context: AgentContext,
    thought: AgentThought,
    useCases: TraceUseCase[],
    files: SourceFile[]
  ): Promise<string[]> {
    const projectId = context.projectId;
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { ooadMetadata: true } });
    const fullUseCases = ((project?.ooadMetadata as any)?.useCases || []).filter((uc: any) =>
      useCases.some(u => u.id === uc.id)
    );
    const services = files
      .filter(f => f.path.startsWith('src/application/') && !this.traceability.isTestFile(f.path))
      .map(f => `// File: ${f.path}\n${f.content}`)
      .join('\n\n')
      .slice(0, 12000);
    const memoryContext = thought.memories?.length ? `\nPAST LEARNINGS:\n${thought.memories.join('\n')}\n` : '';

    const prompt = `Write Jest acceptance tests (TypeScript) for these use cases of the project "${context.projectName || context.projectContext?.name || ''}".

USE CASES:
${JSON.stringify(fullUseCases.length ? fullUseCases : useCases, null, 2)}

APPLICATION SERVICES UNDER TEST:
${services || '(no application services found - test against the domain entities)'}
${memoryContext}
RULES:
1. One file per use case at tests/<UC-ID>.spec.ts, e.g. tests/UC-001.spec.ts
2. The top-level describe MUST be named "<UC-ID>: <use case name>", e.g. describe('UC-001: Place Order', ...)
3. One it() for the main flow, one per alternative flow and one per exception flow
4. Import the real classes with relative paths from tests/ (e.g. ../src/application/services/OrderService) and use the in-memory repositories
5. Output each file in this EXACT format:

<CODE filepath="tests/UC-001.spec.ts">
// test code
</CODE>`;

    const { provider, model } = await this.agentLLM.providerFor(AgentRole.QC, this.modelConfig, projectId);
    const result = await provider.chat({
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: prompt },
      ],
      model,
      maxTokens: 3000,
    });

    const written: string[] = [];
    const pattern = /<CODE\s+filepath=["']([^"']+)["']>\s*\n([\s\S]*?)\n\s*<\/CODE>/gi;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(result.content || '')) !== null) {
      const relativePath = this.workspace.normalize(projectId, match[1]);
      if (!relativePath || !this.traceability.isTestFile(relativePath)) {
        this.logger.warn(`QC skipped non-test or unsafe path: ${match[1]}`);
        continue;
      }
      written.push(await this.workspace.writeFile(projectId, relativePath, match[2]));
    }
    this.logger.log(`QC wrote ${written.length} acceptance test file(s) for project ${projectId}`);
    return written;
  }
}
