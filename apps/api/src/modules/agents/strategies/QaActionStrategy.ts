import { Injectable, Logger } from '@nestjs/common';
import { IActionStrategy } from '../../../domain/agent/interfaces/IActionStrategy.interface';
import { AgentContext, AgentThought, AgentActionResult } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { AgentLLMService } from '../services/agent-llm.service';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { AgentRole, ModelRouteConfig } from '@ai-corp/shared-types';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * QA (Quality Assurance) action: process-side review.
 *
 * Checks that the implementation follows the approved OOAD design (layers, domain model,
 * patterns, use case references) and takes the QC verification report into account.
 * Its verdict (qa_approved) drives the workflow's QA condition node.
 * Product-side testing and the traceability matrix belong to QC (QcActionStrategy).
 */
@Injectable()
export class QaActionStrategy implements IActionStrategy {
  private readonly logger = new Logger(QaActionStrategy.name);
  private readonly systemPrompt: string =
    'You are a QA (Quality Assurance) engineer. You check that code produced by an AI developer follows the approved OOAD design and the team process. Be thorough but fair.';
  private readonly modelConfig: ModelRouteConfig = {
    provider: 'opencode',
    model: 'openrouter/openrouter/free',
    fallbackProvider: 'opencode'
  };

  constructor(
    private readonly memoryService: MemoryService,
    private readonly agentLLM: AgentLLMService,
    private readonly websocketGateway: AppWebSocketGateway,
    private readonly prisma: PrismaService
  ) {}

  async act(context: AgentContext, thought: AgentThought): Promise<AgentActionResult> {
    const memories = thought.memories || [];
    const memoryContext = memories.length > 0
      ? `\n\nRelevant review checklist items:\n${memories.join('\n')}`
      : '';

    const code = context.code || '';
    const hasCode = code.length > 10 && !code.includes('No code provided');
    const projectId = context.projectId;
    const designSummary = await this.loadDesignSummary(projectId);
    const qcReport = typeof context.qcReport === 'string' ? context.qcReport : '';

    const prompt = `You are reviewing code from an AI developer against the approved design.
${memoryContext}
${designSummary ? `APPROVED DESIGN:\n${designSummary}\n` : ''}
${qcReport ? `QC VERIFICATION REPORT:\n${qcReport}\n` : ''}
Code to review:
${hasCode ? code : 'No code was provided by the developer.'}

Review checklist:
1. Layered structure respected (domain / application / infrastructure / presentation); domain imports nothing from outer layers
2. Entities and value objects match the domain model
3. Application service methods carry their use case comment (// UC-xxx)
4. Listed design patterns are applied where the design says
5. QC report: use cases without tests

List findings for each checklist item, then give your verdict.
Rules for your verdict:
- If real implementation code exists and broadly follows the design (even if imperfect), reply: VERDICT: PASS
- Reply VERDICT: FAIL only if there is NO real code, the code is a placeholder, or it ignores the design entirely

Reply with EXACTLY one of these on the last line:
VERDICT: PASS
VERDICT: FAIL`;

    const { provider, model } = await this.agentLLM.providerFor(AgentRole.QA, this.modelConfig, context.projectId);

    const result = await provider.chat({
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: prompt }
      ],
      model,
      maxTokens: 1200
    });

    // Save memory
    await this.memoryService.saveMemory(
      await this.memoryService.getAgentIdByRole(AgentRole.QA) || 'qa',
      AgentRole.QA,
      'review_checklist',
      `Reviewed design conformance for task: ${context.taskId || 'unknown'}`,
      { importance: 5, projectId }
    );

    const output = result.content || '';
    const approved = QaActionStrategy.verdict(output, hasCode);
    this.logger.log(`QA review result: ${approved ? 'APPROVED' : 'REJECTED'}`);

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
      },
    };
  }

  /** Explicit FAIL wins, then explicit PASS; without a verdict, approve only if code exists */
  static verdict(output: string, hasCode: boolean): boolean {
    const upper = output.toUpperCase();
    if (/VERDICT:\s*FAIL/.test(upper)) return false;
    if (/VERDICT:\s*PASS/.test(upper)) return true;
    return hasCode;
  }

  private async loadDesignSummary(projectId?: string): Promise<string> {
    if (!projectId || projectId === 'unknown') return '';
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ooadMetadata: true }
    });
    const m = (project?.ooadMetadata as any) || {};
    const lines: string[] = [];
    if (m.useCases?.length) {
      lines.push(`Use cases: ${m.useCases.map((uc: any) => `${uc.id} ${uc.name}`).join('; ')}`);
    }
    if (m.domainModel?.entities?.length) {
      lines.push(`Entities: ${m.domainModel.entities.map((e: any) => e.name).join(', ')}`);
    }
    if (m.domainModel?.valueObjects?.length) {
      lines.push(`Value objects: ${m.domainModel.valueObjects.map((v: any) => v.name).join(', ')}`);
    }
    if (m.patterns?.length) {
      lines.push(`Patterns: ${m.patterns.map((p: any) => `${p.name} (${p.location})`).join('; ')}`);
    }
    if (m.architecture?.style) {
      lines.push(`Architecture style: ${m.architecture.style}`);
    }
    return lines.join('\n');
  }
}
