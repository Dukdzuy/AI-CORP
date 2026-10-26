import { Performative } from '../../../domain/collaboration/AclMessage';
import { CollaborationContext, CollaborationResult, CollaborationStrategy } from './collaboration-strategy';

/**
 * clarification_loop: DEV or QC sends a REQUEST to BA for each ambiguous use case; BA answers
 * with an INFORM and updates the use case (BAActionStrategy.clarify). The answers reach the
 * asker's next turn through the `clarifications` variable.
 *
 * Questions come from node metadata, from the `questions` variable (DEV's plan), or, when the
 * asker is DEV and none are known yet, from a planImplementation turn.
 */
export class ClarificationLoopCollaboration implements CollaborationStrategy {
  readonly pattern = 'clarification_loop';
  static readonly MAX_QUESTIONS = 3;

  async run(ctx: CollaborationContext): Promise<CollaborationResult> {
    const asker = String(ctx.options.asker || 'DEV');
    let questions = ClarificationLoopCollaboration.asList(ctx.options.questions ?? ctx.variables().questions);
    if (!questions.length && asker === 'DEV') {
      const plan = await ctx.turn('DEV', 'planImplementation');
      questions = ClarificationLoopCollaboration.asList(plan.questions);
    }
    const clarifications = await this.ask(ctx, asker, questions);
    return { output: { clarifications, questions: [] } };
  }

  /** Asks BA each question in turn; returns every clarification known so far (old ones first) */
  async ask(ctx: CollaborationContext, asker: string, questions: string[]): Promise<string[]> {
    const known = ClarificationLoopCollaboration.asList(ctx.variables().clarifications);
    for (const question of questions.slice(0, ClarificationLoopCollaboration.MAX_QUESTIONS)) {
      const request = await ctx.say(Performative.REQUEST, asker, 'BA', question);
      const answer = await ctx.turn('BA', 'clarifyUseCase', { clarificationQuestion: question });
      const clarification = String(answer.clarification || answer.output || '').trim();
      const updated = answer.updatedUseCaseId ? ` (${answer.updatedUseCaseId} updated)` : '';
      await ctx.say(Performative.INFORM, 'BA', asker, `${clarification || 'No answer.'}${updated}`, request);
      if (clarification) known.push(clarification);
    }
    return known;
  }

  private static asList(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && !!v.trim()) : [];
  }
}
