import { Injectable, Logger } from '@nestjs/common';
import { IActionStrategy } from '../../../domain/agent/interfaces/IActionStrategy.interface';
import { AgentContext, AgentThought, AgentActionResult } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { LLMProviderFactory } from '../../llm/llm-provider.factory';
import { SandboxExecutor } from '../../tools/sandbox.executor';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { AgentRole, ModelRouteConfig } from '@ai-corp/shared-types';

@Injectable()
export class DevActionStrategy implements IActionStrategy {
  private readonly logger = new Logger(DevActionStrategy.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly llmFactory: LLMProviderFactory,
    private readonly sandboxExecutor: SandboxExecutor,
    private readonly websocketGateway: AppWebSocketGateway,
    private readonly systemPrompt: string,
    private readonly modelConfig: ModelRouteConfig
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

    const prompt = `You are implementing a software project. Write REAL, WORKING code.

PROJECT: ${projectName || 'New Project'}
GOAL: ${goal}
DESCRIPTION: ${description}

TASK: ${context.task}
${memoryContext}

${existingCode ? `EXISTING CODE:\n${existingCode}\n` : ''}

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
