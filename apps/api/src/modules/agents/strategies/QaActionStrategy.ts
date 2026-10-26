import { Injectable, Logger } from '@nestjs/common';
import { IActionStrategy } from '../../../domain/agent/interfaces/IActionStrategy.interface';
import { AgentContext, AgentThought, AgentActionResult } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { AgentLLMService } from '../services/agent-llm.service';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { QaOutput } from '../../../domain/agent/AgentOutputs';
import { QA_PROFILE } from '../profiles';
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
export class QaActionStrategy implements IActionStrategy<QaOutput> {
  private readonly logger = new Logger(QaActionStrategy.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly agentLLM: AgentLLMService,
    private readonly websocketGateway: AppWebSocketGateway,
    private readonly prisma: PrismaService
  ) {}

  async act(context: AgentContext, thought: AgentThought): Promise<AgentActionResult<QaOutput>> {
    const memories = thought.memories || [];
    const memoryContext = memories.length > 0
      ? `\n\nRelevant review checklist items:\n${memories.join('\n')}`
      : '';

    const code = context.code || '';
    const hasCode = code.length > 10 && !code.includes('No code provided');
    const projectId = context.projectId;
    const designSummary = await this.loadDesignSummary(projectId);
    const qcReport = typeof context.qcReport === 'string' ? context.qcReport : '';
    const failingTests = Array.isArray(context.failingTests) ? context.failingTests.slice(0, 30) : [];

    const prompt = `You are reviewing code from an AI developer against the approved design.
${memoryContext}
${designSummary ? `APPROVED DESIGN:\n${designSummary}\n` : ''}
${qcReport ? `QC VERIFICATION REPORT:\n${qcReport}\n` : ''}
${failingTests.length ? `FAILING TESTS (executed by QC):\n${failingTests.map(t => `- ${t}`).join('\n')}\n` : ''}
Code to review:
${hasCode ? code : 'No code was provided by the developer.'}

Review checklist:
1. Layered structure respected (domain / application / infrastructure / presentation); domain imports nothing from outer layers
2. Entities and value objects match the domain model
3. Application service methods carry their use case comment (// UC-xxx)
4. Listed design patterns are applied where the design says
5. QC report: use cases without tests, and the failing tests listed above (name the code that causes each failure)

List findings for each checklist item, then give your verdict.
Rules for your verdict:
- If real implementation code exists and broadly follows the design (even if imperfect), reply: VERDICT: PASS
- Reply VERDICT: FAIL if there is NO real code, the code is a placeholder, it ignores the design entirely, or a failing test belongs to a High priority use case

Reply with EXACTLY one of these on the last line:
VERDICT: PASS
VERDICT: FAIL`;

    const { provider, model, systemPrompt } = await this.agentLLM.providerFor(QA_PROFILE, context.projectId);

    const result = await provider.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      model,
      maxTokens: 1200
    });

    // Save memory
    await this.memoryService.saveMemory(
      await this.memoryService.getAgentIdByRole(QA_PROFILE.role) || 'qa',
      QA_PROFILE.role,
      QA_PROFILE.primaryNamespace,
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
        agentId: QA_PROFILE.role,
        agentRole: QA_PROFILE.role,
        taskId: context.taskId || 'none',
        actionType: 'review',
        toolName: 'llm',
        parameters: { codeLength: code.length, approved, failingTests: failingTests.length }
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
