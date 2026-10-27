/**
 * Agent Communication Language (subset of FIPA-ACL) for agent collaboration (Phase 3, Task 15).
 *
 * Performatives used by the collaboration patterns:
 * - REQUEST: ask another agent to do something (DEV asks BA to clarify a use case)
 * - INFORM:  share a fact or a result (BA's answer, DEV's implementation)
 * - PROPOSE: offer something for approval (DEV's implementation plan)
 * - ACCEPT / REJECT: answer a PROPOSE (or refuse a REQUEST)
 *
 * Interaction protocol (what may answer what) is enforced by AgentMessageBus through
 * AclProtocol.allowsReply.
 */

import { randomUUID } from 'crypto';

export enum Performative {
  REQUEST = 'REQUEST',
  INFORM = 'INFORM',
  PROPOSE = 'PROPOSE',
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
}

export type AclReceiver = string | 'all';

export interface AclMessageProps {
  performative: Performative;
  sender: string;
  receiver: AclReceiver;
  content: string;
  projectId: string;
  conversationId: string;
  /** Id of the message this one answers */
  inReplyTo?: string;
  /** Collaboration pattern that produced the message, e.g. pair_develop */
  protocol?: string;
}

export class AclProtocol {
  /** Which performatives may answer which */
  static readonly REPLIES: Record<Performative, Performative[]> = {
    [Performative.REQUEST]: [Performative.INFORM, Performative.REJECT],
    [Performative.PROPOSE]: [Performative.ACCEPT, Performative.REJECT],
    [Performative.INFORM]: [Performative.REQUEST, Performative.PROPOSE, Performative.ACCEPT, Performative.REJECT],
    [Performative.ACCEPT]: [],
    [Performative.REJECT]: [Performative.PROPOSE, Performative.INFORM],
  };

  /** Performatives that must answer an earlier message */
  static readonly REPLY_ONLY = new Set([Performative.ACCEPT, Performative.REJECT]);

  static allowsReply(to: Performative, reply: Performative): boolean {
    return AclProtocol.REPLIES[to].includes(reply);
  }
}

/**
 * AclMessage (value object): immutable, validated on creation.
 */
export class AclMessage {
  private constructor(
    readonly id: string,
    readonly performative: Performative,
    readonly sender: string,
    readonly receiver: AclReceiver,
    readonly content: string,
    readonly projectId: string,
    readonly conversationId: string,
    readonly sentAt: Date,
    readonly inReplyTo?: string,
    readonly protocol?: string
  ) {
    Object.freeze(this);
  }

  static create(props: AclMessageProps, id: string = AclMessage.newId(), sentAt = new Date()): AclMessage {
    if (!Object.values(Performative).includes(props.performative)) {
      throw new Error(`Unknown performative: ${props.performative}`);
    }
    if (!props.sender) throw new Error('ACL message needs a sender');
    if (!props.receiver) throw new Error('ACL message needs a receiver');
    if (props.sender === props.receiver) throw new Error(`${props.sender} cannot send a message to itself`);
    if (!props.content || !props.content.trim()) throw new Error('ACL message content is empty');
    if (!props.projectId) throw new Error('ACL message needs a project');
    if (!props.conversationId) throw new Error('ACL message needs a conversation id');
    if (AclProtocol.REPLY_ONLY.has(props.performative) && !props.inReplyTo) {
      throw new Error(`${props.performative} must answer an earlier message (inReplyTo)`);
    }
    return new AclMessage(
      id,
      props.performative,
      props.sender,
      props.receiver,
      props.content.trim(),
      props.projectId,
      props.conversationId,
      sentAt,
      props.inReplyTo,
      props.protocol
    );
  }

  /** The reply's receiver is this message's sender */
  reply(performative: Performative, content: string): AclMessageProps {
    return {
      performative,
      sender: this.receiver === 'all' ? '' : this.receiver,
      receiver: this.sender,
      content,
      projectId: this.projectId,
      conversationId: this.conversationId,
      inReplyTo: this.id,
      protocol: this.protocol,
    };
  }

  /** One line for the Meeting Room */
  toString(): string {
    return `[${this.performative}] ${this.sender} → ${this.receiver}: ${this.content}`;
  }

  private static newId(): string {
    return randomUUID();
  }
}
