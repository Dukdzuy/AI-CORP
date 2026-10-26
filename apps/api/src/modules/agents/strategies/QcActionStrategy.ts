import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IActionStrategy } from '../../../domain/agent/interfaces/IActionStrategy.interface';
import { AgentContext, AgentThought, AgentActionResult } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { AgentLLMService } from '../services/agent-llm.service';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { QcOutput } from '../../../domain/agent/AgentOutputs';
import { QC_PROFILE } from '../profiles';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProjectWorkspace } from '../../workspace/project-workspace.service';
import { SourceFile, TraceabilityService, TraceUseCase } from '../services/traceability.service';
import { ProjectTestRunner } from '../services/project-test-runner.service';

/**
 * QC (Quality Control) action: product-side verification of the generated project.
 *
 * 1. Derives acceptance test suites from the BA's use cases (one describe('UC-xxx: ...') per use case)
 * 2. Writes them under tests/ in the project workspace
 * 3. Runs the project's Jest suite in the sandbox (ProjectTestRunner) and maps results to use cases
 * 4. Builds the traceability matrix use case → domain class → implementation → test (Passing | Failing | Missing)
 * 5. Persists coverage and pass/fail counts to ooadMetadata; qc_passed needs coverage >= 80%
 *    and no failing High-priority use case (TraceabilityService.qcPassed)
 *
 * QA (process-side) then reviews the implementation against the design using this report.
 */
@Injectable()
export class QcActionStrategy implements IActionStrategy<QcOutput> {
  private readonly logger = new Logger(QcActionStrategy.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly agentLLM: AgentLLMService,
    private readonly websocketGateway: AppWebSocketGateway,
    private readonly prisma: PrismaService,
    private readonly workspace: ProjectWorkspace,
    private readonly traceability: TraceabilityService,
    private readonly testRunner: ProjectTestRunner
  ) {}

  async act(context: AgentContext, thought: AgentThought): Promise<AgentActionResult<QcOutput>> {
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

    // 3. Execute the tests
    const execution = await this.testRunner.run(projectId, useCases);
    if (!execution.executed) {
      this.logger.warn(`QC could not execute the tests of ${projectId}: ${execution.reason}; coverage counts existing tests`);
    }

    // 4. Traceability over the final set of files and the executed results
    const files = testsWritten.length > 0 ? await this.loadFiles(projectId) : sourceFiles;
    const report = this.traceability.build(useCases, entities, files, execution);
    await this.workspace.writeFile(projectId, 'docs/traceability-matrix.md', report.markdown);

    // 5. Persist coverage for the OOAD metrics dashboard
    const updatedMetadata = JSON.parse(JSON.stringify({
      ...metadata,
      testCoverage: report.coveragePercent,
      traceability: {
        executed: report.executed,
        coveredCount: report.coveredCount,
        passingCount: report.executed ? report.coveredCount : undefined,
        failingCount: report.failingCount,
        totalCount: report.totalCount,
        missingUseCases: report.missingUseCases,
        failingUseCases: report.failingUseCases,
        testsPassed: execution.passed,
        testsFailed: execution.failed,
        notExecutedReason: execution.executed ? undefined : execution.reason,
        generatedAt: new Date().toISOString(),
      },
    }));
    await this.prisma.project.update({
      where: { id: projectId },
      data: { ooadMetadata: updatedMetadata as Prisma.InputJsonValue },
    });

    const qcPassed = TraceabilityService.qcPassed(report);
    if (!qcPassed) {
      const reason = report.coveragePercent < TraceabilityService.COVERAGE_THRESHOLD
        ? `Use case test coverage is ${report.coveragePercent}% (below ${TraceabilityService.COVERAGE_THRESHOLD}%)`
        : `High-priority use cases have failing tests: ${report.failingUseCases.join(', ')}`;
      this.websocketGateway.sendToProject(projectId, {
        type: 'quality_warning',
        payload: {
          message: reason,
          missingUseCases: report.missingUseCases,
          failingUseCases: report.failingUseCases,
          severity: 'warning',
        },
      });
    }

    const agentId = await this.memoryService.getAgentIdByRole(QC_PROFILE.role);
    if (agentId) {
      await this.memoryService.saveMemory(
        agentId,
        QC_PROFILE.role,
        QC_PROFILE.primaryNamespace,
        `Verified ${report.totalCount} use cases, coverage ${report.coveragePercent}%`
          + (report.executed ? ` (${execution.passed} tests passed, ${execution.failed} failed)` : ' (tests not executed)')
          + `, wrote ${testsWritten.length} test file(s)`,
        { importance: 6, projectId }
      );
    }

    this.websocketGateway.sendToProject(projectId, {
      type: 'agent:action',
      payload: {
        agentId: QC_PROFILE.role,
        agentRole: QC_PROFILE.role,
        taskId: context.taskId || 'none',
        actionType: 'verify',
        toolName: 'llm+jest+traceability',
        parameters: {
          coverage: report.coveragePercent,
          testsWritten,
          testsExecuted: report.executed,
          testsPassed: execution.passed,
          testsFailed: execution.failed,
        },
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
        testsExecuted: report.executed,
        failingUseCases: report.failingUseCases,
        failingTests: report.failingTests,
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

    const { provider, model, systemPrompt } = await this.agentLLM.providerFor(QC_PROFILE, projectId);
    const result = await provider.chat({
      messages: [
        { role: 'system', content: systemPrompt },
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
