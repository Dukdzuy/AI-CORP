import { AclMessage, Performative } from '../../../domain/collaboration/AclMessage';

/** The fields an agent produced in one turn (its AgentOutputs payload) */
export type TurnOutput = Record<string, any>;

/**
 * What an agent_collaboration node hands a collaboration strategy.
 * Strategies never call agents or the message bus directly: every agent turn runs as a
 * workflow step (same retries, logging and WebSocket events as an agent_task node), and every
 * message goes through AgentMessageBus.
 */
export interface CollaborationContext {
  readonly projectId: string;
  /** One conversation per node execution; replies are validated inside it */
  readonly conversationId: string;
  readonly pattern: string;
  /** The node's metadata (maxRounds, reviewers, asker, ...) */
  readonly options: Record<string, unknown>;
  /** Runs one agent turn with extra input variables and returns the agent's output fields */
  turn(role: string, taskType: string, input?: Record<string, unknown>): Promise<TurnOutput>;
  /** Sends an ACL message; pass the message being answered as `inReplyTo` */
  say(performative: Performative, sender: string, receiver: string, content: string, inReplyTo?: AclMessage): Promise<AclMessage>;
  /** Current workflow variables (earlier agents' outputs) */
  variables(): Record<string, unknown>;
}

export interface CollaborationResult {
  /** Merged into the workflow variables, like an agent_task node's output */
  output: TurnOutput;
  /** Edge to follow; defaults to onSuccess */
  edgeCondition?: 'onSuccess' | 'onFail';
}

/**
 * One way agents work together on a workflow step (pair_develop, review_chain, clarification_loop).
 * Added to CollaborationRegistry; the agent_collaboration node picks one by metadata.pattern.
 *
 * @pattern Strategy
 */
export interface CollaborationStrategy {
  readonly pattern: string;
  run(ctx: CollaborationContext): Promise<CollaborationResult>;
}

/** Shortens agent output for a Meeting Room message */
export function brief(text: unknown, max = 400): string {
  const value = typeof text === 'string' ? text.trim() : '';
  if (!value) return '(no details)';
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}
