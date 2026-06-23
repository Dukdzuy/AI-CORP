import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AgentRole } from '@ai-corp/shared-types';

export interface MeetingMessage {
  id: string;
  fromRole: AgentRole;
  toRole: AgentRole | 'all';
  message: string;
  type: 'chat' | 'thinking' | 'action' | 'notification' | 'approval';
  timestamp: Date;
  approvalId?: string;
  projectId?: string;
  approvalType?: string;
  requestData?: Record<string, unknown>;
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
      addMessage: (msg) =>
        set((state) => ({
          messages: [...state.messages.slice(-(MAX_MESSAGES - 1)), msg],
        })),
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
