import { AclMessage, Performative } from '../../../domain/collaboration/AclMessage';
import { brief, CollaborationContext, CollaborationResult, CollaborationStrategy, TurnOutput } from './collaboration-strategy';
import { ClarificationLoopCollaboration } from './clarification-loop.collaboration';

/**
 * pair_develop: DEV drives, the Architect navigates.
 *
 * 1. DEV plans (planImplementation); ambiguous use cases go to BA first (clarification loop)
 * 2. DEV PROPOSEs the plan; the Architect ACCEPTs or REJECTs it with feedback (reviewPlan),
 *    DEV revises it up to maxRounds times
 * 3. DEV implements with the plan, feedback and clarifications, then INFORMs the Architect
 * 4. The Architect reviews the code (reviewCode); a REJECT sends DEV back for another round
 *
 * The navigator advises: after maxRounds DEV's last version goes on to QC/QA, which decide.
 */
export class PairDevelopCollaboration implements CollaborationStrategy {
  readonly pattern = 'pair_develop';
  static readonly DEFAULT_MAX_ROUNDS = 2;

  constructor(private readonly clarification = new ClarificationLoopCollaboration()) {}

  async run(ctx: CollaborationContext): Promise<CollaborationResult> {
    const navigator = String(ctx.options.navigator || 'ARCHITECT');
    const maxRounds = Math.max(1, Number(ctx.options.maxRounds) || PairDevelopCollaboration.DEFAULT_MAX_ROUNDS);
    const reviewCode = ctx.options.reviewCode !== false;

    // 1. Plan, and clear up ambiguous use cases before the plan is reviewed
    let plan = await ctx.turn('DEV', 'planImplementation', { designFeedback: '' });
    let clarifications: string[] = [];
    if (Array.isArray(plan.questions) && plan.questions.length) {
      clarifications = await this.clarification.ask(ctx, 'DEV', plan.questions);
      plan = await ctx.turn('DEV', 'planImplementation', { clarifications, designFeedback: '' });
    }

    // 2. Plan review
    let proposal = await ctx.say(Performative.PROPOSE, 'DEV', navigator, brief(plan.implementationPlan || plan.output, 1200));
    let planAccepted = false;
    let feedback = '';
    let reviews = 0;
    for (let round = 1; round <= maxRounds; round++) {
      reviews++;
      const review = await ctx.turn(navigator, 'reviewPlan', { implementationPlan: plan.implementationPlan || plan.output });
      planAccepted = review.design_approved !== false;
      feedback = planAccepted ? '' : String(review.designFeedback || review.output || '');
      const answer = await ctx.say(planAccepted ? Performative.ACCEPT : Performative.REJECT, navigator, 'DEV', brief(review.output), proposal);
      if (planAccepted || round === maxRounds) break;
      plan = await ctx.turn('DEV', 'planImplementation', { designFeedback: feedback });
      proposal = await ctx.say(Performative.PROPOSE, 'DEV', navigator, brief(plan.implementationPlan || plan.output, 1200), answer);
    }

    // 3. Implementation
    const implementationPlan = String(plan.implementationPlan || plan.output || '');
    let impl = await ctx.turn('DEV', 'implement', { implementationPlan, designFeedback: feedback });
    let report = await ctx.say(Performative.INFORM, 'DEV', navigator, PairDevelopCollaboration.describe(impl));

    // 4. Code review
    let codeAccepted: boolean | undefined;
    if (reviewCode) {
      for (let round = 1; round <= maxRounds; round++) {
        reviews++;
        const review = await ctx.turn(navigator, 'reviewCode', { code: impl.code });
        codeAccepted = review.design_approved !== false;
        feedback = codeAccepted ? '' : String(review.designFeedback || review.output || '');
        const answer: AclMessage = await ctx.say(codeAccepted ? Performative.ACCEPT : Performative.REJECT, navigator, 'DEV', brief(review.output), report);
        if (codeAccepted || round === maxRounds) break;
        impl = await ctx.turn('DEV', 'implement', { implementationPlan, designFeedback: feedback });
        report = await ctx.say(Performative.INFORM, 'DEV', navigator, PairDevelopCollaboration.describe(impl), answer);
      }
    }

    return {
      output: {
        ...impl,
        implementationPlan,
        designFeedback: feedback,
        clarifications,
        planAccepted,
        ...(codeAccepted === undefined ? {} : { codeAccepted }),
        navigatorReviews: reviews,
      },
    };
  }

  private static describe(impl: TurnOutput): string {
    const files: string[] = Array.isArray(impl.filesWritten) ? impl.filesWritten : [];
    return files.length
      ? `Implemented the plan: ${files.length} file(s) written (${files.slice(0, 8).join(', ')}${files.length > 8 ? ', ...' : ''}).`
      : `Implemented the plan: ${brief(impl.toolOutput || impl.output, 200)}`;
  }
}
