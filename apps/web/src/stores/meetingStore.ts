import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AclPerformative, AgentRole } from '@ai-corp/shared-types';

export interface MeetingMessage {
  id: string;
  fromRole: AgentRole;
  toRole: AgentRole | 'all';
  message: string;
  type: 'chat' | 'thinking' | 'action' | 'notification' | 'approval' | 'acl';
  timestamp: Date;
  approvalId?: string;
  projectId?: string;
  approvalType?: string;
  requestData?: Record<string, unknown>;
  /** Agent-to-agent message fields (messageType 'acl') */
  performative?: AclPerformative;
  protocol?: string;
}

interface MeetingState {
  messages: MeetingMessage[];
  addMessage: (msg: MeetingMessage) => void;
  clearMessages: () => void;
}

const MAX_MESSAGES = 500;

export const useMeetingStore = create<MeetingState>()(
  persist(
    (set) => ({
      messages: [],
      // A message already shown (e.g. an approval from both the API and the socket) is not added again
      addMessage: (msg) =>
        set((state) =>
          state.messages.some((m) => m.id === msg.id)
            ? state
            : { messages: [...state.messages.slice(-(MAX_MESSAGES - 1)), msg] }
        ),
      clearMessages: () => set({ messages: [] }),
    }),
    {
      name: 'meeting-messages',
      partialize: (state) => ({
        messages: state.messages.map((m) => ({
          ...m,
          timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
        })),
      }),
      merge: (persisted: any, current) => ({
        ...current,
        ...(persisted || {}),
        messages: (persisted?.messages || []).map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })),
      }),
    }
  )
);
