import { AclMessage, Performative } from '../../../domain/collaboration/AclMessage';
import { brief, CollaborationContext, CollaborationResult, CollaborationStrategy } from './collaboration-strategy';

export interface ReviewerConfig {
  role: string;
  taskType: string;
  /** Output field holding the reviewer's verdict (false = rejected) */
  verdictField: string;
  /**
   * Whether the verdict decides the outcome. An advisory reviewer's report is forwarded to the
   * next reviewer, who weighs it (QC's failing tests are evidence for QA's verdict).
   */
  decides: boolean;
}

export interface ReviewOutcome {
  role: string;
  approved: boolean;
  decides: boolean;
}

/** QC (advisory: executed tests + traceability) → QA (decides: design conformance) */
export const DEFAULT_REVIEWERS: ReviewerConfig[] = [
  { role: 'QC', taskType: 'verify', verdictField: 'qc_passed', decides: false },
  { role: 'QA', taskType: 'review', verdictField: 'qa_approved', decides: true },
];

/**
 * One link of the review chain: reviews, answers the proposal it received, and either stops
 * the chain (a deciding reviewer rejected) or forwards the proposal to the next reviewer.
 *
 * @pattern Chain of Responsibility
 */
export class ReviewHandler {
  private next?: ReviewHandler;

  constructor(readonly config: ReviewerConfig) {}

  setNext(next: ReviewHandler): ReviewHandler {
    this.next = next;
    return next;
  }

  /** One line for the Meeting Room: QC's coverage figures, or the start of the reviewer's findings */
  static summarize(output: Record<string, any>): string {
    if (typeof output.testCoverage === 'number') {
      const list = (v: unknown) => (Array.isArray(v) && v.length ? v.join(', ') : 'none');
      return `Coverage ${output.testCoverage}%${output.testsExecuted ? ' (tests executed)' : ''}; failing: ${list(output.failingUseCases)}; missing: ${list(output.missingUseCases)}.`;
    }
    return brief(String(output.output || '').replace(/^\s*VERDICT\s*:.*$/gim, '').trim());
  }

  async handle(ctx: CollaborationContext, proposal: AclMessage, outcomes: ReviewOutcome[] = []): Promise<ReviewOutcome[]> {
    const { role, taskType, verdictField, decides } = this.config;
    const output = await ctx.turn(role, taskType);
    const approved = output[verdictField] !== false;
    outcomes.push({ role, approved, decides });

    const summary = ReviewHandler.summarize(output);
    await ctx.say(approved ? Performative.ACCEPT : Performative.REJECT, role, proposal.sender, summary, proposal);

    if (!this.next || (decides && !approved)) {
      return outcomes;
    }
    const forward = await ctx.say(
      Performative.PROPOSE,
      role,
      this.next.config.role,
      `Please review the implementation. ${role} ${approved ? 'accepted' : 'rejected'} it: ${brief(ReviewHandler.summarize(output), 300)}`
    );
    return this.next.handle(ctx, forward, outcomes);
  }
}

/**
 * review_chain: DEV's implementation passes through the reviewers in order (default QC → QA).
 * Approved when every deciding reviewer accepted. Sets qa_approved too, so the existing
 * condition nodes and Kanban moves keep working; a reviewer is added by node metadata only.
 */
export class ReviewChainCollaboration implements CollaborationStrategy {
  readonly pattern = 'review_chain';

  async run(ctx: CollaborationContext): Promise<CollaborationResult> {
    const reviewers = ReviewChainCollaboration.reviewers(ctx.options.reviewers);
    const [first, ...rest] = reviewers.map(r => new ReviewHandler(r));
    rest.reduce((prev, handler) => prev.setNext(handler), first);

    const author = String(ctx.options.author || 'DEV');
    const files = ctx.variables().filesWritten;
    const proposal = await ctx.say(
      Performative.PROPOSE,
      author,
      first.config.role,
      `Implementation ready for review${Array.isArray(files) && files.length ? ` (${files.length} file(s))` : ''}.`
    );
    const outcomes = await first.handle(ctx, proposal);

    const deciding = outcomes.filter(o => o.decides);
    const approved = deciding.length > 0
      ? deciding.every(o => o.approved)
      : outcomes.every(o => o.approved);
    const rejectedBy = outcomes.filter(o => !o.approved).map(o => o.role);
    return {
      output: { review_approved: approved, qa_approved: approved, rejectedBy, reviews: outcomes },
      edgeCondition: approved ? 'onSuccess' : 'onFail',
    };
  }

  static reviewers(value: unknown): ReviewerConfig[] {
    if (!Array.isArray(value) || value.length === 0) return DEFAULT_REVIEWERS;
    return value.map((r: any) => {
      const known = DEFAULT_REVIEWERS.find(d => d.role === r?.role);
      if (!r?.role || !(r.taskType || known)) {
        throw new Error(`Reviewer needs a role and a taskType: ${JSON.stringify(r)}`);
      }
      return {
        role: String(r.role),
        taskType: String(r.taskType || known!.taskType),
        verdictField: String(r.verdictField || known?.verdictField || 'approved'),
        decides: r.decides !== undefined ? !!r.decides : known?.decides ?? true,
      };
    });
  }
}
