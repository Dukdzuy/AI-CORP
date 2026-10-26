import { Injectable, Logger } from '@nestjs/common';
import { AclMessage, AclMessageProps, AclProtocol } from '../../domain/collaboration/AclMessage';
import { AgentMessageService } from './agent-message.service';

export type AclListener = (message: AclMessage) => void | Promise<void>;

/** Listener key that receives every message, whoever it is addressed to */
export const ALL_ROLES = '*';

/**
 * AgentMessageBus
 *
 * The one channel agents use to talk to each other (Task 15). Agents never call each other:
 * they send an ACL message to the bus, which validates it against the conversation so far
 * (a reply must answer an earlier message, come from that message's receiver and use a
 * performative the protocol allows), persists it as an AgentMessage (streamed to the
 * Meeting Room by AgentMessageService) and delivers it to the receiver's listeners.
 *
 * @pattern Mediator
 */
@Injectable()
export class AgentMessageBus {
  /** Conversations kept in memory for reply validation; the oldest are dropped first */
  static readonly MAX_CONVERSATIONS = 200;

  private readonly logger = new Logger(AgentMessageBus.name);
  private readonly listeners = new Map<string, Set<AclListener>>();
  private readonly conversations = new Map<string, AclMessage[]>();

  constructor(private readonly messages: AgentMessageService) {}

  /**
   * Validates, persists and delivers one message.
   * Throws when the message breaks the protocol; persistence and listener errors are logged,
   * so a failing Meeting Room never stops the agents' work.
   */
  async send(props: AclMessageProps): Promise<AclMessage> {
    const message = AclMessage.create(props);
    const history = this.conversations.get(message.conversationId) || [];
    this.checkReply(message, history);
    this.remember(message, history);

    try {
      await this.messages.sendMessage({
        projectId: message.projectId,
        fromRole: message.sender,
        toRole: message.receiver === 'all' ? null : message.receiver,
        message: message.content,
        messageType: 'acl',
        metadata: {
          aclId: message.id,
          performative: message.performative,
          conversationId: message.conversationId,
          inReplyTo: message.inReplyTo,
          protocol: message.protocol,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Could not persist ${message.performative} from ${message.sender}: ${err.message}`);
    }

    await this.deliver(message);
    return message;
  }

  /** Subscribes to messages addressed to `role` (or every message with ALL_ROLES); returns the unsubscribe function */
  on(role: string, listener: AclListener): () => void {
    const set = this.listeners.get(role) || new Set<AclListener>();
    set.add(listener);
    this.listeners.set(role, set);
    return () => set.delete(listener);
  }

  /** Messages of a conversation still held in memory, oldest first */
  conversation(conversationId: string): AclMessage[] {
    return [...(this.conversations.get(conversationId) || [])];
  }

  /** Frees a finished conversation */
  endConversation(conversationId: string): void {
    this.conversations.delete(conversationId);
  }

  private checkReply(message: AclMessage, history: AclMessage[]): void {
    if (!message.inReplyTo) return;
    const original = history.find(m => m.id === message.inReplyTo);
    if (!original) {
      throw new Error(`${message.performative} answers unknown message ${message.inReplyTo} in conversation ${message.conversationId}`);
    }
    if (original.receiver !== 'all' && original.receiver !== message.sender) {
      throw new Error(`${message.sender} cannot answer a message addressed to ${original.receiver}`);
    }
    if (!AclProtocol.allowsReply(original.performative, message.performative)) {
      throw new Error(`${message.performative} is not a valid answer to ${original.performative}`);
    }
  }

  private remember(message: AclMessage, history: AclMessage[]): void {
    if (!this.conversations.has(message.conversationId)) {
      if (this.conversations.size >= AgentMessageBus.MAX_CONVERSATIONS) {
        const oldest = this.conversations.keys().next().value;
        if (oldest !== undefined) this.conversations.delete(oldest);
      }
      this.conversations.set(message.conversationId, history);
    }
    history.push(message);
  }

  private async deliver(message: AclMessage): Promise<void> {
    const targets = new Set<AclListener>(this.listeners.get(ALL_ROLES) || []);
    if (message.receiver === 'all') {
      for (const [role, set] of this.listeners) {
        if (role !== message.sender) set.forEach(l => targets.add(l));
      }
    } else {
      (this.listeners.get(message.receiver) || new Set<AclListener>()).forEach(l => targets.add(l));
    }
    for (const listener of targets) {
      try {
        await listener(message);
      } catch (err: any) {
        this.logger.warn(`Listener failed for ${message.performative} to ${message.receiver}: ${err.message}`);
      }
    }
  }
}
