import { Injectable, Logger } from '@nestjs/common';
import { IActionStrategy } from '../../../domain/agent/interfaces/IActionStrategy.interface';
import { AgentContext, AgentThought, AgentActionResult } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { LLMProviderFactory } from '../../llm/llm-provider.factory';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { AgentRole, ModelRouteConfig } from '@ai-corp/shared-types';
import { SandboxExecutor } from '../../tools/sandbox.executor';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class QaActionStrategy implements IActionStrategy {
  private readonly logger = new Logger(QaActionStrategy.name);
  private readonly systemPrompt: string = 'You are a QA engineer reviewing code from an AI developer. Be thorough but fair.';
  private readonly modelConfig: ModelRouteConfig = { 
    provider: 'opencode', 
    model: 'openrouter/openrouter/free', 
    fallbackProvider: 'opencode' 
  };

  constructor(
    private readonly memoryService: MemoryService,
    private readonly llmFactory: LLMProviderFactory,
    private readonly websocketGateway: AppWebSocketGateway,
    private readonly sandboxExecutor: SandboxExecutor,
    private readonly prisma: PrismaService
  ) {}

  async act(context: AgentContext, thought: AgentThought): Promise<AgentActionResult> {
    const memories = thought.memories || [];
    const memoryContext = memories.length > 0
      ? `\n\nRelevant testing patterns:\n${memories.join('\n')}`
      : '';

    const code = context.code || '';
    const hasCode = code.length > 10 && !code.includes('No code provided');
    const projectId = context.projectId;

    const prompt = `You are a QA engineer reviewing code from an AI developer.
${memoryContext}
Code to review:
${hasCode ? code : 'No code was provided by the developer.'}

Rules for your verdict:
- If real implementation code exists (even if imperfect), reply: VERDICT: PASS
- Only reply VERDICT: FAIL if there is absolutely NO code or the code is a pure placeholder (like "echo hello" or just comments)
- Remember: imperfect code is still code. Only reject empty/placeholder responses.

Reply with EXACTLY one of these on the last line:
VERDICT: PASS
VERDICT: FAIL`;

    // Fetch latest model config
    const modelConfig = await this.memoryService.getModelConfigForAgent(AgentRole.QA, this.modelConfig);
    const provider = this.llmFactory.getProvider(modelConfig);

    const result = await provider.chat({
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: prompt }
      ],
      model: modelConfig.model,
      maxTokens: 800
    });

    // Save memory
    await this.memoryService.saveMemory(
      await this.memoryService.getAgentIdByRole(AgentRole.QA) || 'qa',
      AgentRole.QA,
      'testing_patterns',
      `Reviewed code for task: ${context.taskId || 'unknown'}`,
      { importance: 5, projectId }
    );

    const output = result.content || '';
    const outputUpper = output.toUpperCase();

    // Check for explicit failure
    const explicitlyFailed = outputUpper.includes('VERDICT: FAIL')
      || outputUpper.includes('VERDICT:FAIL')
      || outputUpper.includes('VERDICT:\\s*FAIL');

    // Check for explicit pass
    const explicitlyPassed = outputUpper.includes('VERDICT: PASS')
      || outputUpper.includes('VERDICT:PASS');

    // Determine approval
    let approved: boolean;
    if (explicitlyFailed) {
      approved = false;
    } else if (explicitlyPassed) {
      approved = true;
    } else {
      approved = hasCode;
    }

    this.logger.log(`QA review result: ${approved ? 'APPROVED' : 'REJECTED'}`);

    // Generate traceability matrix if projectId is available
    let traceabilityMatrix = '';
    if (projectId && projectId !== 'unknown') {
      try {
        traceabilityMatrix = await this.generateTraceabilityMatrix(projectId);
        this.logger.log(`Generated traceability matrix for project ${projectId}`);
      } catch (err: any) {
        this.logger.warn(`Failed to generate traceability matrix: ${err.message}`);
      }
    }

    // Emit action event
    this.websocketGateway.sendToProject(projectId || 'unknown', {
      type: 'agent:action',
      payload: {
        agentId: AgentRole.QA,
        agentRole: AgentRole.QA,
        taskId: context.taskId || 'none',
        actionType: 'review',
        toolName: 'llm',
        parameters: { codeLength: code.length, approved }
      }
    });

    return {
      success: true,
      output: {
        action: 'review',
        output,
        qa_approved: approved,
        edgeCondition: approved ? 'onSuccess' : 'onFail',
        traceabilityMatrix: traceabilityMatrix || undefined
      },
      errors: []
    };
  }

  private async generateTraceabilityMatrix(projectId: string): Promise<string> {
    const projectPath = `projects/${projectId}`;
    const docsPath = `${projectPath}/docs`;

    const readFileCommand = (filename: string) => `cat ${docsPath}/${filename} 2>/dev/null || echo "FILE_NOT_FOUND"`;

    // Prefer the persisted OOAD metadata (written by BA/Architect); fall back to the docs files
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ooadMetadata: true }
    });
    const ooadMetadata = (project?.ooadMetadata as any) || {};

    let useCases: Array<{ id: string; name: string; priority?: string }>;
    if (ooadMetadata.useCases?.length) {
      useCases = ooadMetadata.useCases.map((uc: any) => ({ id: uc.id, name: uc.name, priority: uc.priority }));
    } else {
      const useCasesResult = await this.sandboxExecutor.executeInSandbox(
        'custom_command',
        readFileCommand('use-cases.md'),
        { maxMemoryMB: 64, maxCPUPercent: 10, maxDiskMB: 10, timeout: 5000 }
      );

      if (useCasesResult.output.includes('FILE_NOT_FOUND')) {
        throw new Error('use-cases.md not found - cannot generate traceability matrix');
      }
      useCases = this.parseUseCases(useCasesResult.output);
    }

    let entities: string[];
    if (ooadMetadata.domainModel?.entities?.length) {
      entities = ooadMetadata.domainModel.entities.map((e: any) => e.name);
    } else {
      const domainModelResult = await this.sandboxExecutor.executeInSandbox(
        'custom_command',
        readFileCommand('domain-model.puml'),
        { maxMemoryMB: 64, maxCPUPercent: 10, maxDiskMB: 10, timeout: 5000 }
      );
      entities = domainModelResult.output.includes('FILE_NOT_FOUND')
        ? []
        : this.parseEntitiesFromPuml(domainModelResult.output);
    }

    // Find test files
    const findTestsCommand = `find ${projectPath}/src -name '*.test.ts' -o -name '*.spec.ts' 2>/dev/null || echo ""`;
    const testFilesResult = await this.sandboxExecutor.executeInSandbox(
      'custom_command',
      findTestsCommand,
      { maxMemoryMB: 64, maxCPUPercent: 10, maxDiskMB: 10, timeout: 10000 }
    );

    const testFiles = testFilesResult.output.split('\n').filter(f => f.trim() && !f.includes('FILE_NOT_FOUND'));

    // Read test file contents
    const tests: { ucId: string; testFile: string; testName: string }[] = [];
    for (const testFile of testFiles) {
      try {
        const testContentResult = await this.sandboxExecutor.executeInSandbox(
          'custom_command',
          `cat "${testFile}" 2>/dev/null || echo ""`,
          { maxMemoryMB: 64, maxCPUPercent: 10, maxDiskMB: 10, timeout: 5000 }
        );
        
        if (testContentResult.output) {
          const parsedTests = this.parseTestFile(testContentResult.output, testFile);
          tests.push(...parsedTests);
        }
      } catch (err: any) {
        this.logger.warn(`Failed to read test file ${testFile}: ${err.message}`);
      }
    }

    // Build traceability matrix
    let traceabilityMd = '# Traceability Matrix\n\n';
    traceabilityMd += '| Use Case ID | Use Case Name | Priority | Domain Classes | Test Cases | Coverage |\n';
    traceabilityMd += '|-------------|---------------|----------|----------------|------------|-----------|\n';

    const matrixRows: any[] = [];

    useCases.forEach(uc => {
      const relatedEntities = entities.filter(e =>
        uc.name.toLowerCase().includes(e.toLowerCase())
      );

      const relatedTests = tests.filter(t => 
        t.ucId === uc.id || 
        t.testName.toLowerCase().includes(uc.name.toLowerCase()) ||
        t.testName.includes(uc.id)
      );

      const coverage = relatedTests.length > 0 ? 'Covered' : 'Missing';

      matrixRows.push({
        ucId: uc.id,
        ucName: uc.name,
        priority: uc.priority || 'Unknown',
        entities: relatedEntities,
        tests: relatedTests,
        coverage
      });

      traceabilityMd += `| ${uc.id} | ${uc.name} | ${uc.priority || 'N/A'} | ${relatedEntities.join(', ') || 'N/A'} | ${relatedTests.map(t => t.testName).join(', ') || 'None'} | ${coverage} |\n`;
    });

    const coveredCount = matrixRows.filter(r => r.coverage === 'Covered').length;
    const totalCount = matrixRows.length;
    const coveragePercent = totalCount > 0 ? ((coveredCount / totalCount) * 100).toFixed(1) : '0';

    traceabilityMd += `\n**Summary:**\n`;
    traceabilityMd += `- Total Use Cases: ${totalCount}\n`;
    traceabilityMd += `- Covered: ${coveredCount}\n`;
    traceabilityMd += `- Missing: ${totalCount - coveredCount}\n`;
    traceabilityMd += `- Coverage: ${coveragePercent}%\n`;

    if (parseFloat(coveragePercent) < 80) {
      const missingUCs = matrixRows.filter(r => r.coverage === 'Missing').map(r => r.ucId);
      traceabilityMd += `\n**⚠️ WARNING: Test coverage below 80%**\n`;
      traceabilityMd += `Missing tests for: ${missingUCs.join(', ')}\n`;

      // Emit warning via WebSocket
      this.websocketGateway.sendToProject(projectId, {
        type: 'quality_warning',
        payload: {
          message: `Test coverage is ${coveragePercent}% (below 80% threshold)`,
          missingUseCases: missingUCs,
          severity: 'warning'
        }
      });
    }

    // Write traceability matrix to file
    const writeMatrixCmd = `cat > ${docsPath}/traceability-matrix.md << 'HEREDOC_EOF'\n${traceabilityMd}\nHEREDOC_EOF`;
    await this.sandboxExecutor.executeInSandbox('custom_command', writeMatrixCmd, {
      maxMemoryMB: 128,
      maxCPUPercent: 20,
      maxDiskMB: 50,
      timeout: 10000
    });

    // Persist test coverage to ooadMetadata for metrics dashboard
    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { ooadMetadata: true }
      });
      
      const existingMetadata = (project?.ooadMetadata as any) || {};
      const updatedMetadata = JSON.parse(JSON.stringify({
        ...existingMetadata,
        testCoverage: parseFloat(coveragePercent)
      }));
      
      await this.prisma.project.update({
        where: { id: projectId },
        data: { ooadMetadata: updatedMetadata }
      });
      
      this.logger.log(`Persisted test coverage ${coveragePercent}% to project ${projectId}`);
    } catch (err: any) {
      this.logger.warn(`Failed to persist test coverage: ${err.message}`);
    }

    return traceabilityMd;
  }

  private parseUseCases(content: string): Array<{ id: string; name: string; priority?: string }> {
    const useCases: Array<{ id: string; name: string; priority?: string }> = [];
    
    // Match markdown headers with use case pattern
    const ucPattern = /##\s+Use Case:\s+(.+?)\n[\s\S]*?\|\s*\*\*ID\*\*\s*\|\s*(.+?)\s*\|[\s\S]*?(?:\|\s*\*\*Priority\*\*\s*\|\s*(.+?)\s*\|)?/gi;
    let match;
    
    while ((match = ucPattern.exec(content)) !== null) {
      useCases.push({
        name: match[1].trim(),
        id: match[2].trim(),
        priority: match[3]?.trim()
      });
    }

    return useCases;
  }

  private parseEntitiesFromPuml(content: string): string[] {
    const entities: string[] = [];
    const entityPattern = /class\s+(\w+)\s+<<Entity>>/g;
    let match;

    while ((match = entityPattern.exec(content)) !== null) {
      entities.push(match[1]);
    }

    return entities;
  }

  private parseTestFile(content: string, filePath: string): Array<{ ucId: string; testFile: string; testName: string }> {
    const tests: Array<{ ucId: string; testFile: string; testName: string }> = [];

    // Match describe blocks
    const describePattern = /describe\s*\(\s*['"`](.+?)['"`]/g;
    let match;

    while ((match = describePattern.exec(content)) !== null) {
      const testName = match[1];
      
      // Try to extract UC-XXX from test name or content
      const ucMatch = testName.match(/UC-\d{3}/);
      const ucId = ucMatch ? ucMatch[0] : '';

      tests.push({
        ucId,
        testFile: filePath,
        testName
      });
    }

    // Also match it() blocks
    const itPattern = /it\s*\(\s*['"`](.+?)['"`]/g;
    while ((match = itPattern.exec(content)) !== null) {
      const testName = match[1];
      const ucMatch = testName.match(/UC-\d{3}/);
      const ucId = ucMatch ? ucMatch[0] : '';

      if (ucId) {
        tests.push({
          ucId,
          testFile: filePath,
          testName
        });
      }
    }

    return tests;
  }
}
