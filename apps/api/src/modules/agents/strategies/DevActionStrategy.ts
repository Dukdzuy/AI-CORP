import { Injectable, Logger } from '@nestjs/common';
import { IActionStrategy } from '../../../domain/agent/interfaces/IActionStrategy.interface';
import { AgentContext, AgentThought, AgentActionResult } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { LLMProviderFactory } from '../../llm/llm-provider.factory';
import { SandboxExecutor } from '../../tools/sandbox.executor';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { AgentRole, ModelRouteConfig } from '@ai-corp/shared-types';
import { OOADGateNotPassedError } from '../errors/OOADGateNotPassedError';

@Injectable()
export class DevActionStrategy implements IActionStrategy {
  private readonly logger = new Logger(DevActionStrategy.name);
  private readonly systemPrompt: string = 'You are an expert software developer. Write clean, efficient, production-quality code.';
  private readonly modelConfig: ModelRouteConfig = { 
    provider: 'opencode', 
    model: 'openrouter/openrouter/free', 
    fallbackProvider: 'opencode' 
  };

  constructor(
    private readonly memoryService: MemoryService,
    private readonly llmFactory: LLMProviderFactory,
    private readonly sandboxExecutor: SandboxExecutor,
    private readonly websocketGateway: AppWebSocketGateway
  ) {}

  async act(context: AgentContext, thought: AgentThought): Promise<AgentActionResult> {
    const memories = thought.memories || [];
    const memoryContext = memories.length > 0
      ? `\n\nRelevant coding conventions:\n${memories.join('\n')}`
      : '';

    const goal = context.goal || context.projectContext?.goal || '';
    const description = context.projectSummary || context.projectContext?.description || '';
    const projectName = context.projectName || context.projectContext?.name || '';
    const existingCode = context.code || '';
    const projectId = context.projectId;

    // Load OOAD artifacts
    let ooadContext = '';
    if (projectId) {
      try {
        const projectPath = `projects/${projectId}/docs`;
        const readFileCommand = (filename: string) => `cat ${projectPath}/${filename} 2>/dev/null || echo "FILE_NOT_FOUND"`;

        const [useCasesResult, domainModelResult, architectureResult] = await Promise.all([
          this.sandboxExecutor.executeInSandbox('custom_command', readFileCommand('use-cases.md'), {
            maxMemoryMB: 64, maxCPUPercent: 10, maxDiskMB: 10, timeout: 5000
          }),
          this.sandboxExecutor.executeInSandbox('custom_command', readFileCommand('domain-model.puml'), {
            maxMemoryMB: 64, maxCPUPercent: 10, maxDiskMB: 10, timeout: 5000
          }),
          this.sandboxExecutor.executeInSandbox('custom_command', readFileCommand('architecture-patterns.md'), {
            maxMemoryMB: 64, maxCPUPercent: 10, maxDiskMB: 10, timeout: 5000
          })
        ]);

        const useCases = useCasesResult.output.includes('FILE_NOT_FOUND') ? null : useCasesResult.output;
        const domainModel = domainModelResult.output.includes('FILE_NOT_FOUND') ? null : domainModelResult.output;
        const architecture = architectureResult.output.includes('FILE_NOT_FOUND') ? null : architectureResult.output;

        if (useCases && domainModel && architecture) {
          ooadContext = `\n\n==== OOAD DESIGN (MUST FOLLOW) ====\n\n=== USE CASES ===\n${useCases}\n\n=== DOMAIN MODEL ===\n${domainModel}\n\n=== ARCHITECTURE & PATTERNS ===\n${architecture}\n\n==== IMPLEMENTATION RULES ====\n1. Follow the layered architecture (domain/application/infrastructure)\n2. Implement entities EXACTLY as specified in the domain model\n3. Apply the design patterns listed above\n4. Each class must reference its corresponding use case ID in a comment (e.g., // UC-001: Create Order)\n5. Follow SOLID principles\n6. No deviations from the design without explicit reason\n\n`;
        } else {
          this.logger.warn('Some OOAD artifacts missing - proceeding without full design context');
        }
      } catch (err: any) {
        this.logger.warn(`Failed to load OOAD artifacts: ${err.message}`);
      }
    }

    const prompt = `You are implementing a software project. Write REAL, WORKING code.${ooadContext.length > 0 ? ' STRICTLY FOLLOW THE OOAD DESIGN PROVIDED BELOW.' : ''}

PROJECT: ${projectName || 'New Project'}
GOAL: ${goal}
DESCRIPTION: ${description}

TASK: ${context.task}
${memoryContext}

${existingCode ? `EXISTING CODE:\n${existingCode}\n` : ''}
${ooadContext}

INSTRUCTIONS:
1. Analyze the PROJECT GOAL and DESCRIPTION carefully
2. Choose the appropriate technology stack based on the description:
   - If it mentions "Express", "Node.js", "server" → write Express.js server code
   - If it mentions "React", "frontend", "web app" → write React component code
   - If it mentions "TypeScript", "Ant Design" → use TypeScript + Ant Design
   - If it mentions "HTML", "CSS" → write HTML/CSS/JS
3. Write COMPLETE, RUNNABLE code - not pseudocode or placeholders
4. Include all necessary imports, exports, and configuration
5. Output code in this EXACT format for each file:

<CODE filepath="src/index.js">
// your complete working code here
</CODE>

Write ALL files needed for the project to work. Make it production-quality.`;

    // Fetch latest model config
    const modelConfig = await this.memoryService.getModelConfigForAgent(AgentRole.DEV, this.modelConfig);
    const provider = this.llmFactory.getProvider(modelConfig);

    const result = await provider.chat({
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: prompt }
      ],
      model: modelConfig.model,
      maxTokens: 3000
    });

    const llmOutput = result.content || '';

    // Parse <CODE filepath="..."> blocks
    const codeBlocks = this.parseCodeBlocks(llmOutput);

    let writtenFiles: string[] = [];
    let codeContent = '';

    if (codeBlocks.length > 0) {
      for (const block of codeBlocks) {
        try {
          const command = `mkdir -p $(dirname "${block.filepath}") && cat > "${block.filepath}" << 'HEREDOC_EOF'\n${block.content}\nHEREDOC_EOF`;
          await this.sandboxExecutor.executeInSandbox('custom_command', command, {
            maxMemoryMB: 256,
            maxCPUPercent: 30,
            maxDiskMB: 100,
            timeout: 10000
          });
          writtenFiles.push(block.filepath);
          codeContent += `// File: ${block.filepath}\n${block.content}\n\n`;
          this.logger.log(`DEV wrote file: ${block.filepath}`);
        } catch (err: any) {
          this.logger.warn(`Failed to write file ${block.filepath}: ${err.message}`);
        }
      }
    }

    if (!codeContent) {
      codeContent = llmOutput;
    }

    // Save memory
    await this.memoryService.saveMemory(
      await this.memoryService.getAgentIdByRole(AgentRole.DEV) || 'dev',
      AgentRole.DEV,
      'coding_conventions',
      `Implemented task: ${context.task}. Files written: ${writtenFiles.join(', ') || 'none'}`,
      { importance: 5, projectId: context.projectId }
    );

    // Check for UC-ID comments in generated code if OOAD context was provided
    if (ooadContext && codeContent) {
      const ucIdPattern = /\/\/\s*UC-\d{3}/g;
      const ucIdMatches = codeContent.match(ucIdPattern);
      const ucIdCount = ucIdMatches ? ucIdMatches.length : 0;
      
      if (ucIdCount === 0 && codeContent.length > 100) {
        this.logger.warn('Generated code missing UC-ID comments. OOAD traceability may be incomplete.');
        this.websocketGateway.sendToProject(context.projectId, {
          type: 'quality_warning',
          payload: {
            message: 'Generated code missing use case ID comments (// UC-XXX)',
            severity: 'warning'
          }
        });
      } else if (ucIdCount > 0) {
        this.logger.log(`Found ${ucIdCount} UC-ID references in generated code`);
      }
    }

    // Emit action event
    this.websocketGateway.sendToProject(context.projectId, {
      type: 'agent:action',
      payload: {
        agentId: AgentRole.DEV,
        agentRole: AgentRole.DEV,
        taskId: context.taskId || 'none',
        actionType: 'implement',
        toolName: writtenFiles.length > 0 ? 'write_file' : 'llm',
        parameters: { task: context.task, files: writtenFiles }
      }
    });

    return {
      success: true,
      output: {
        action: 'implement',
        output: codeContent,
        toolOutput: writtenFiles.length > 0 ? `Wrote ${writtenFiles.length} file(s): ${writtenFiles.join(', ')}` : 'No files written (code in response only)',
        filesWritten: writtenFiles,
        code: codeContent
      },
      errors: []
    };
  }

  private parseCodeBlocks(output: string): Array<{ filepath: string; content: string }> {
    const blocks: Array<{ filepath: string; content: string }> = [];
    const regex = /<CODE\s+filepath=["']([^"']+)["']>\s*\n([\s\S]*?)\n\s*<\/CODE>/gi;
    let match;
    while ((match = regex.exec(output)) !== null) {
      blocks.push({ filepath: match[1], content: match[2] });
    }
    return blocks;
  }
}
