import type { AclPerformative } from '@ai-corp/shared-types';

/** How an agent-to-agent (FIPA-ACL) message is labelled in the Meeting Room */
export const PERFORMATIVE_STYLES: Record<AclPerformative, { color: string; label: string }> = {
  REQUEST: { color: 'purple', label: 'asks' },
  INFORM: { color: 'blue', label: 'informs' },
  PROPOSE: { color: 'gold', label: 'proposes' },
  ACCEPT: { color: 'green', label: 'accepts' },
  REJECT: { color: 'red', label: 'rejects' },
};

const PROTOCOL_LABELS: Record<string, string> = {
  pair_develop: 'Pair develop',
  review_chain: 'Review chain',
  clarification_loop: 'Clarification',
  task_result: 'Task result',
};

export function performativeStyle(performative?: string): { color: string; label: string } | null {
  return performative && performative in PERFORMATIVE_STYLES
    ? PERFORMATIVE_STYLES[performative as AclPerformative]
    : null;
}

export function protocolLabel(protocol?: string): string | null {
  if (!protocol) return null;
  return PROTOCOL_LABELS[protocol] ?? protocol.replace(/_/g, ' ');
}
