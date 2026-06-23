import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../../stores/authStore';
import { useWebsocketStore } from '../../stores/websocketStore';
import {
  WebSocketEventType,
  AgentThinkingEvent,
  AgentActionEvent,
  AgentMessageEvent,
  TaskUpdatedEvent,
  WorkflowStateChangedEvent,
  ApprovalRequiredEvent,
  SystemNotificationEvent,
} from '@ai-corp/shared-types';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

type EventHandler<T> = (data: T) => void;

const eventHandlers: Map<string, Set<EventHandler<any>>> = new Map();

let socket: Socket | null = null;

export const socketClient = {
  connect: () => {
    if (socket?.connected) return;

    const { token } = useAuthStore.getState();

    socket = io(WS_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    const wsStore = useWebsocketStore.getState();

    socket.on('connect', () => {
      wsStore.setStatus('connected');
      console.log('[WS] Connected to server');
    });

    socket.on('disconnect', () => {
      wsStore.setStatus('disconnected');
      console.log('[WS] Disconnected from server');
    });

    socket.on('connect_error', (err) => {
      console.warn('[WS] Connection error:', err.message);
      if (err.message.includes('jwt') || err.message.includes('expired') || err.message.includes('unauthorized')) {
        console.warn('[WS] Auth error, logging out');
        useAuthStore.getState().logout();
      }
    });

    socket.on('reconnecting', () => {
      wsStore.setStatus('reconnecting');
      console.log('[WS] Reconnecting...');
    });

    socket.on('reconnect', () => {
      wsStore.setStatus('connected');
      console.log('[WS] Reconnected to server');
    });

    // Register all AI Corp event listeners
    const registerEvent = <T>(eventType: WebSocketEventType) => {
      socket!.on(eventType, (data: T) => {
        wsStore.recordMessage();
        const handlers = eventHandlers.get(eventType);
        handlers?.forEach((handler) => handler(data));
      });
    };

    registerEvent<AgentThinkingEvent>(WebSocketEventType.AGENT_THINKING);
    registerEvent<AgentActionEvent>(WebSocketEventType.AGENT_ACTION);
    registerEvent<AgentMessageEvent>(WebSocketEventType.AGENT_MESSAGE);
    registerEvent<TaskUpdatedEvent>(WebSocketEventType.TASK_UPDATED);
    registerEvent<WorkflowStateChangedEvent>(WebSocketEventType.WORKFLOW_STATE_CHANGED);
    registerEvent<ApprovalRequiredEvent>(WebSocketEventType.HUMAN_APPROVAL_REQUIRED);
    registerEvent<SystemNotificationEvent>(WebSocketEventType.SYSTEM_NOTIFICATION);

    // Listen for system health events (circuit breaker, degraded, etc.)
    socket.on('system_event', (data: any) => {
      wsStore.recordMessage();
      console.log('[WS] system_event received:', data?.type, data?.payload ? 'has payload' : 'no payload');
      // Dispatch broadcast agent events to their specific handlers
      if (data?.type && data?.payload) {
        const handlers = eventHandlers.get(data.type);
        console.log('[WS] dispatching to', data?.type, 'handlers:', handlers?.size ?? 0);
        handlers?.forEach((handler) => handler(data.payload));
      }
      // Also fire general system_event handlers
      const handlers = eventHandlers.get('system_event');
      handlers?.forEach((handler) => handler(data));
    });

    // Listen for project-level events (agent:thinking, agent:action, workflow:state_changed, etc.)
    socket.on('project_event', (data: any) => {
      wsStore.recordMessage();
      if (data?.type) {
        const handlers = eventHandlers.get(data.type);
        handlers?.forEach((handler) => handler(data.data ?? data));
      }
    });

    // Listen for user-specific events (human:approval_required, etc.)
    socket.on('user_event', (data: any) => {
      wsStore.recordMessage();
      if (data?.type) {
        const handlers = eventHandlers.get(data.type);
        handlers?.forEach((handler) => handler(data.data ?? data));
      }
    });
  },

  disconnect: () => {
    socket?.disconnect();
    socket = null;
    useWebsocketStore.getState().setStatus('disconnected');
  },

  on: <T>(event: WebSocketEventType | string, handler: EventHandler<T>): (() => void) => {
    if (!eventHandlers.has(event)) {
      eventHandlers.set(event, new Set());
    }
    eventHandlers.get(event)!.add(handler);

    // Return cleanup function
    return () => {
      eventHandlers.get(event)?.delete(handler);
    };
  },

  emit: (event: string, data?: unknown) => {
    if (!socket?.connected) {
      console.warn('[WS] Cannot emit — not connected');
      return;
    }
    socket.emit(event, data);
  },

  get connected() {
    return socket?.connected ?? false;
  },
};

export default socketClient;
