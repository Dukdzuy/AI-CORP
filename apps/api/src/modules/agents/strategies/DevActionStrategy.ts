import { Injectable, Logger, Optional } from '@nestjs/common';
import { IActionStrategy } from '../../../domain/agent/interfaces/IActionStrategy.interface';
import { AgentContext, AgentThought, AgentActionResult } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { AgentLLMService } from '../services/agent-llm.service';
import { ProjectWorkspace } from '../../workspace/project-workspace.service';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { DevAgentOutput, DevCodeQuality, DevOutput, DevPlanOutput } from '../../../domain/agent/AgentOutputs';
import { DEV_PROFILE } from '../profiles';
import { PrismaService } from '../../../prisma/prisma.service';
import { OOADArtifactService } from '../services/ooad-artifact.service';
import { parseQuestions, stripMarkers } from '../services/collaboration-replies';
import { CodeQualityService, SourceFile } from '../../code-quality/code-quality.service';
import { CodeQualityPolicy } from '../../../domain/quality';

/** At most this many low-scoring files are sent back for one refinement round */
const MAX_REFINED_FILES = 6;

@Injectable()
export class DevActionStrategy implements IActionStrategy<DevAgentOutput> {
  private readonly logger = new Logger(DevActionStrategy.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly agentLLM: AgentLLMService,
    private readonly websocketGateway: AppWebSocketGateway,
    private readonly prisma: PrismaService,
    private readonly ooadArtifacts: OOADArtifactService,
    private readonly workspace: ProjectWorkspace,
    // Phase 6, Task 26: static analysis and one refinement round of low-scoring code
    @Optional() private readonly codeQuality?: CodeQualityService
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

    // Paths relative to the project (analysed) and as the workspace reports them (output)
    let written: SourceFile[] = [];
    const storedPath = new Map<string, string>();

    if (codeBlocks.length > 0 && projectId) {
      for (const block of codeBlocks) {
        const relativePath = this.workspace.normalize(projectId, block.filepath);
        if (!relativePath) {
          this.logger.warn(`Skipping unsafe file path from LLM: ${block.filepath}`);
          continue;
        }
        try {
          const stored = await this.workspace.writeFile(projectId, relativePath, block.content);
          written.push({ path: relativePath, content: block.content });
          storedPath.set(relativePath, stored);
          this.logger.log(`DEV wrote file: ${stored}`);
        } catch (err: any) {
          this.logger.warn(`Failed to write file ${block.filepath}: ${err.message}`);
        }
      }
    }

    const quality = await this.assureQuality(projectId, written, { provider, model, systemPrompt }, context.task);
    if (quality) written = quality.files;
    const writtenFiles = written.map(f => storedPath.get(f.path) ?? f.path);
    let codeContent = written.map(f => `// File: ${storedPath.get(f.path) ?? f.path}\n${f.content}\n\n`).join('');

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
        code: codeContent,
        ...(quality ? { codeQuality: quality.report } : {}),
      },
    };
  }

  /**
   * Phase 6, Task 26: scores the files just written. When the analysis predicts that QA will
   * reject the code (score below the threshold, syntax errors or layer violations), the LLM
   * gets one round to fix the reported findings; the refinement is kept only if the score improves.
   */
  private async assureQuality(
    projectId: string | undefined,
    files: SourceFile[],
    llm: { provider: any; model: string; systemPrompt: string },
    task: string | undefined
  ): Promise<{ files: SourceFile[]; report: DevCodeQuality } | null> {
    if (!this.codeQuality || !projectId || !files.length) return null;
    this.codeQuality.invalidate(projectId); // the files were just rewritten
    try {
      const before = this.codeQuality.assessFiles(files);
      if (before.score === null) return null;
      let after = before;
      let current = files;
      let refinedFiles: string[] = [];
      let attempted = false;

      if (before.predictedQaVerdict === 'fail' && this.codeQuality.refinementEnabled) {
        attempted = true;
        const weak = before.files.filter(f => f.findings.length).slice(0, MAX_REFINED_FILES).map(f => f.path);
        const prompt = `Static analysis of the code you just wrote for "${task || 'the task'}" scored ${before.score}/100 (minimum ${before.threshold}): ${before.reasons.join('; ')}.

FINDINGS:
${CodeQualityPolicy.summarize(before, 30)}

Rewrite ONLY the files listed below so that the findings are fixed: keep their paths, their public API, their layer
(domain / application / infrastructure / presentation) and their // UC-xxx comments; split complex functions,
remove unsafe calls and hard-coded secrets, and make dependencies point inwards (towards the domain).

${current.filter(f => weak.includes(f.path)).map(f => `<CODE filepath="${f.path}">\n${f.content}\n</CODE>`).join('\n\n')}

Answer with the complete corrected files in the same <CODE filepath="..."> format.`;
        const result = await llm.provider.chat({
          messages: [
            { role: 'system', content: llm.systemPrompt },
            { role: 'user', content: prompt },
          ],
          model: llm.model,
          maxTokens: 3000,
        });
        const replacements = new Map<string, string>();
        for (const block of this.parseCodeBlocks(result.content || '')) {
          const path = this.workspace.normalize(projectId, block.filepath);
          if (path && weak.includes(path)) replacements.set(path, block.content);
        }
        if (replacements.size) {
          const candidate = current.map(f => (replacements.has(f.path) ? { path: f.path, content: replacements.get(f.path)! } : f));
          const assessed = this.codeQuality.assessFiles(candidate);
          if (assessed.score !== null && assessed.score > before.score) {
            for (const [path, content] of replacements) await this.workspace.writeFile(projectId, path, content);
            current = candidate;
            after = assessed;
            refinedFiles = [...replacements.keys()];
          }
        }
        this.logger.log(`Code quality ${before.score} → ${after.score}${refinedFiles.length ? ` after refining ${refinedFiles.length} file(s)` : ' (refinement not kept)'}`);
      }

      const note = attempted
        ? `Score before refinement: ${before.score}. ${refinedFiles.length ? `Refined: ${refinedFiles.join(', ')}.` : 'The refined code did not score higher and was discarded.'}\n`
        : '';
      const reportPath = await this.codeQuality.writeReport(projectId, after, note);
      return {
        files: current,
        report: {
          score: after.score!,
          scoreBefore: attempted ? before.score : null,
          refined: refinedFiles.length > 0,
          refinedFiles,
          threshold: after.threshold,
          predictedQaVerdict: after.predictedQaVerdict!,
          reasons: after.reasons,
          findings: after.totals,
          summary: CodeQualityPolicy.summarize(after),
          reportPath,
        },
      };
    } catch (err: any) {
      this.logger.warn(`Code quality analysis skipped: ${err.message}`);
      return null;
    }
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
