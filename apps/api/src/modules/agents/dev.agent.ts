import { Injectable } from '@nestjs/common';
import { BaseAgent } from './base.agent';
import { AgentRole, ModelRouteConfig } from '@ai-corp/shared-types';
import { MemoryService } from '../memory/memory.service';
import { LLMProviderFactory } from '../llm/llm-provider.factory';
import { ToolRegistry } from '../tools/tool.registry';
import { SandboxExecutor } from '../tools/sandbox.executor';
import { ApiUsageService } from '../llm/api-usage.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class DevAgent extends BaseAgent {
  constructor(
    memoryService: MemoryService,
    llmFactory: LLMProviderFactory,
    toolRegistry: ToolRegistry,
    sandboxExecutor: SandboxExecutor,
    apiUsageService: ApiUsageService,
    websocketGateway: AppWebSocketGateway
  ) {
    const systemPrompt = `You are the Lead Developer. Your objective is to implement tasks by writing code and executing tests.
You MUST write actual implementation code. Do not describe what you would do - write the real code.
Always output code inside a CODE block with the file path on the first line:
<CODE filepath="relative/path/to/file">
actual code here
</CODE>`;
    const modelConfig: ModelRouteConfig = { provider: 'opencode', model: 'openrouter/nvidia/nemotron-3-super-120b-a12b:free', fallbackProvider: 'opencode' };
    super(AgentRole.DEV, systemPrompt, modelConfig, memoryService, llmFactory, toolRegistry, sandboxExecutor, apiUsageService, websocketGateway);
  }

  async think(context: any): Promise<any> {
    this.logger.debug('Dev thinking...');
    this.emitThinking(context.projectId, `Analyzing task implementation requirements for: ${context.task}`);

    const memories = await this.loadMemory('coding_conventions', JSON.stringify(context));
    return { thought: `Analyzing task implementation requirements for: ${context.task}`, memories };
  }

  async act(context: any): Promise<any> {
    this.logger.debug('Dev acting...');
    const memories = context.memories || [];
    const memoryContext = memories.length > 0
      ? `\n\nRelevant coding conventions:\n${memories.map((m: any) => m.content).join('\n')}`
      : '';

    const prompt = `Implement the following task by writing actual code.${memoryContext}

Task: ${context.task}

You MUST output code. Use this exact format:
<CODE filepath="src/index.js">
// your implementation code here
</CODE>

Write complete, working code. Do not use placeholders or TODOs.`;

    const result = await this.callLLM({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2000
    }, context.projectId);

    const llmOutput = result.content || '';

    // Parse <CODE filepath="..."> blocks from LLM output
    const codeBlocks = this.parseCodeBlocks(llmOutput);

    let writtenFiles: string[] = [];
    let codeContent = '';

    if (codeBlocks.length > 0) {
      for (const block of codeBlocks) {
        try {
          const escapedContent = this.escapeForShell(block.content);
          const command = `mkdir -p $(dirname "${block.filepath}") && cat > "${block.filepath}" << 'HEREDOC_EOF'\n${block.content}\nHEREDOC_EOF`;
          await this.executeSandboxCommand(command, {
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
          // Fallback: try simpler write
          try {
            const escaped = block.content.replace(/'/g, "'\\''");
            await this.executeSandboxCommand(`echo '${escaped}' > "${block.filepath}"`);
            writtenFiles.push(block.filepath);
            codeContent += `// File: ${block.filepath}\n${block.content}\n\n`;
          } catch (e2: any) {
            this.logger.error(`Fallback write also failed for ${block.filepath}: ${e2.message}`);
          }
        }
      }
    }

    // If no code blocks found, use raw LLM output as code content
    if (!codeContent) {
      codeContent = llmOutput;
    }

    // Verify written files exist
    if (writtenFiles.length > 0) {
      try {
        const verifyCmd = writtenFiles.map(f => `test -f "${f}" && echo "OK:${f}" || echo "MISSING:${f}"`).join('; ');
        const verifyResult = await this.executeSandboxCommand(verifyCmd);
        this.logger.log(`File verification: ${verifyResult.output}`);
      } catch (e) {
        this.logger.warn(`File verification failed: ${(e as Error).message}`);
      }
    }

    await this.saveMemory('coding_conventions', `Implemented task: ${context.task}. Files written: ${writtenFiles.join(', ') || 'none'}`, 5, context.projectId);

    this.emitAction(context.projectId, context.taskId || 'none', 'implement', writtenFiles.length > 0 ? 'write_file' : 'llm', { task: context.task, files: writtenFiles });

    return {
      action: 'implement',
      output: codeContent,
      toolOutput: writtenFiles.length > 0 ? `Wrote ${writtenFiles.length} file(s): ${writtenFiles.join(', ')}` : 'No files written (code in response only)',
      filesWritten: writtenFiles,
      code: codeContent
    };
  }

  /**
   * Parse <CODE filepath="...">...</CODE> blocks from LLM output
   */
  private parseCodeBlocks(output: string): Array<{ filepath: string; content: string }> {
    const blocks: Array<{ filepath: string; content: string }> = [];
    const regex = /<CODE\s+filepath=["']([^"']+)["']>\s*\n([\s\S]*?)\n\s*<\/CODE>/gi;
    let match;
    while ((match = regex.exec(output)) !== null) {
      blocks.push({ filepath: match[1], content: match[2] });
    }
    return blocks;
  }

  /**
   * Escape special characters for shell heredoc content
   */
  private escapeForShell(content: string): string {
    return content.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }
}
