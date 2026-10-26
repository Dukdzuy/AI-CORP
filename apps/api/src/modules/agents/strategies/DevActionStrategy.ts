import { Injectable, Logger } from '@nestjs/common';
import { IActionStrategy } from '../../../domain/agent/interfaces/IActionStrategy.interface';
import { AgentContext, AgentThought, AgentActionResult } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { AgentLLMService } from '../services/agent-llm.service';
import { ProjectWorkspace } from '../../workspace/project-workspace.service';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { DevAgentOutput, DevOutput, DevPlanOutput } from '../../../domain/agent/AgentOutputs';
import { DEV_PROFILE } from '../profiles';
import { PrismaService } from '../../../prisma/prisma.service';
import { OOADArtifactService } from '../services/ooad-artifact.service';
import { parseQuestions, stripMarkers } from '../services/collaboration-replies';

@Injectable()
export class DevActionStrategy implements IActionStrategy<DevAgentOutput> {
  private readonly logger = new Logger(DevActionStrategy.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly agentLLM: AgentLLMService,
    private readonly websocketGateway: AppWebSocketGateway,
    private readonly prisma: PrismaService,
    private readonly ooadArtifacts: OOADArtifactService,
    private readonly workspace: ProjectWorkspace
  ) {}

  async act(context: AgentContext, thought: AgentThought): Promise<AgentActionResult<DevAgentOutput>> {
    if (context.taskType === 'planImplementation') {
      return this.planImplementation(context, thought);
    }
    return this.implement(context, thought);
  }

  private async implement(context: AgentContext, thought: AgentThought): Promise<AgentActionResult<DevOutput>> {
    const memories = thought.memories || [];
    const memoryContext = memories.length > 0
      ? `\n\nRelevant coding conventions:\n${memories.join('\n')}`
      : '';

    const goal = context.goal || context.projectContext?.goal || '';
    const description = context.projectSummary || context.projectContext?.description || '';
    const projectName = context.projectName || context.projectContext?.name || '';
    const existingCode = context.code || '';
    const projectId = context.projectId;
    const ooadContext = await this.loadDesignContext(projectId, projectName);
    const collaborationContext = DevActionStrategy.collaborationContext(context);

    const prompt = `You are implementing a software project. Write REAL, WORKING code.${ooadContext.length > 0 ? ' STRICTLY FOLLOW THE OOAD DESIGN PROVIDED BELOW.' : ''}

PROJECT: ${projectName || 'New Project'}
GOAL: ${goal}
DESCRIPTION: ${description}

TASK: ${context.task}
${memoryContext}

${existingCode ? `EXISTING CODE:\n${existingCode}\n` : ''}
${ooadContext}
${collaborationContext}

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
${ooadContext ? '6. File paths are relative to the project root; reuse the skeleton paths listed in the design (e.g. src/application/services/...)\n' : ''}

Write ALL files needed for the project to work. Make it production-quality.`;

    const { provider, model, systemPrompt } = await this.agentLLM.providerFor(DEV_PROFILE, context.projectId);

    const result = await provider.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      model,
      maxTokens: 3000
    });

    const llmOutput = result.content || '';

    // Parse <CODE filepath="..."> blocks
    const codeBlocks = this.parseCodeBlocks(llmOutput);

    let writtenFiles: string[] = [];
    let codeContent = '';

    if (codeBlocks.length > 0 && projectId) {
      for (const block of codeBlocks) {
        const relativePath = this.workspace.normalize(projectId, block.filepath);
        if (!relativePath) {
          this.logger.warn(`Skipping unsafe file path from LLM: ${block.filepath}`);
          continue;
        }
        try {
          const written = await this.workspace.writeFile(projectId, relativePath, block.content);
          writtenFiles.push(written);
          codeContent += `// File: ${written}\n${block.content}\n\n`;
          this.logger.log(`DEV wrote file: ${written}`);
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
      await this.memoryService.getAgentIdByRole(DEV_PROFILE.role) || 'dev',
      DEV_PROFILE.role,
      DEV_PROFILE.primaryNamespace,
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
        agentId: DEV_PROFILE.role,
        agentRole: DEV_PROFILE.role,
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
    };
  }

  /**
   * pair_develop (Task 15): a short plan the Architect reviews before any code is written.
   * Ambiguous use cases come back as QUESTION lines for the clarification loop.
   */
  private async planImplementation(context: AgentContext, thought: AgentThought): Promise<AgentActionResult<DevPlanOutput>> {
    const memories = thought.memories || [];
    const projectName = context.projectName || context.projectContext?.name || '';
    const ooadContext = await this.loadDesignContext(context.projectId, projectName);
    const collaborationContext = DevActionStrategy.collaborationContext(context);

    const prompt = `Before writing code, propose an implementation plan for the Architect to review.

PROJECT: ${projectName || 'New Project'}
GOAL: ${context.goal || context.projectContext?.goal || ''}
${memories.length ? `\nRelevant coding conventions:\n${memories.join('\n')}\n` : ''}
${ooadContext}
${collaborationContext}

Write the plan as a short list: for each use case (UC-xxx), the classes and files you will create or change,
in which layer (domain / application / infrastructure / presentation), and which design pattern applies.
Keep it under 30 lines.

If a use case is too ambiguous to implement, add one line per question at the end:
QUESTION: UC-xxx: <what you need to know>
If nothing is ambiguous, write: QUESTION: none`;

    const { provider, model, systemPrompt } = await this.agentLLM.providerFor(DEV_PROFILE, context.projectId);
    const result = await provider.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      model,
      maxTokens: 1200
    });

    const text = result.content || '';
    const plan = stripMarkers(text);
    const questions = parseQuestions(text);
    return {
      success: true,
      output: {
        action: 'planImplementation',
        output: plan,
        implementationPlan: plan,
        questions,
      },
    };
  }

  /** The OOAD design (use cases, domain model, class diagram, skeleton) written by BA/Architect */
  private async loadDesignContext(projectId: string | undefined, projectName: string): Promise<string> {
    if (!projectId) return '';
    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { ooadMetadata: true }
      });
      const designContext = await this.ooadArtifacts.buildImplementationContext(project?.ooadMetadata, projectName);
      if (designContext) {
        return `\n\n${designContext}\n\n`;
      }
      this.logger.warn('OOAD design missing - proceeding without design context');
    } catch (err: any) {
      this.logger.warn(`Failed to load OOAD design: ${err.message}`);
    }
    return '';
  }

  /** What collaborators said so far: accepted plan, Architect feedback, BA clarifications */
  static collaborationContext(context: AgentContext): string {
    const parts: string[] = [];
    if (context.implementationPlan) {
      parts.push(`IMPLEMENTATION PLAN (accepted by the Architect):\n${context.implementationPlan}`);
    }
    if (context.designFeedback) {
      parts.push(`ARCHITECT FEEDBACK (address every point):\n${context.designFeedback}`);
    }
    if (context.clarifications?.length) {
      parts.push(`CLARIFICATIONS FROM BA:\n${context.clarifications.map(c => `- ${c}`).join('\n')}`);
    }
    return parts.join('\n\n');
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
