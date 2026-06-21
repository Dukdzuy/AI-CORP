import { create } from 'zustand';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

interface WebsocketState {
  status: ConnectionState;
  lastMessageAt: Date | null;
  setStatus: (status: ConnectionState) => void;
  recordMessage: () => void;
}

export const useWebsocketStore = create<WebsocketState>((set) => ({
  status: 'disconnected',
  lastMessageAt: null,
  setStatus: (status) => set({ status }),
  recordMessage: () => set({ lastMessageAt: new Date() }),
}));
