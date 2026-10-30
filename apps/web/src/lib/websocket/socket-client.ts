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

// Project rooms this tab wants; joined again after every (re)connect
const projectRooms = new Set<string>();

// Event types with their own listener below; the generic project_event / user_event copies of
// them are skipped so a handler runs once per event
const directEvents = new Set<string>();

const debug = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log(...args);
};

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
      debug('[WS] Connected to server');
      projectRooms.forEach((projectId) => socket?.emit('subscribe_project', { projectId }));
    });

    socket.on('disconnect', () => {
      wsStore.setStatus('disconnected');
      debug('[WS] Disconnected from server');
    });

    socket.on('connect_error', (err) => {
      console.warn('[WS] Connection error:', err.message);
      if (err.message.includes('jwt') || err.message.includes('expired') || err.message.includes('unauthorized')) {
        console.warn('[WS] Auth error, signing out');
        useAuthStore.getState().expireSession(window.location.pathname + window.location.search);
      }
    });

    socket.on('reconnecting', () => {
      wsStore.setStatus('reconnecting');
      debug('[WS] Reconnecting...');
    });

    socket.on('reconnect', () => {
      wsStore.setStatus('connected');
      debug('[WS] Reconnected to server');
    });

    // Register all AI Corp event listeners
    const registerEvent = <T>(eventType: WebSocketEventType) => {
      directEvents.add(eventType);
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
      debug('[WS] system_event received:', data?.type, data?.payload ? 'has payload' : 'no payload');
      // Dispatch broadcast agent events to their specific handlers; for a project this tab has
      // joined, the room delivers its own copy, so the broadcast one is skipped
      const roomCopy = data?.payload?.projectId && projectRooms.has(data.payload.projectId);
      if (data?.type && data?.payload && !roomCopy) {
        const handlers = eventHandlers.get(data.type);
        debug('[WS] dispatching to', data?.type, 'handlers:', handlers?.size ?? 0);
        handlers?.forEach((handler) => handler(data.payload));
      }
      // Also fire general system_event handlers
      const handlers = eventHandlers.get('system_event');
      handlers?.forEach((handler) => handler(data));
    });

    // Listen for project-level events (agent:thinking, agent:action, workflow:state_changed, etc.)
    socket.on('project_event', (data: any) => {
      wsStore.recordMessage();
      if (data?.type && !directEvents.has(data.type)) {
        const handlers = eventHandlers.get(data.type);
        handlers?.forEach((handler) => handler(data.data ?? data.payload ?? data));
      }
    });

    // Listen for user-specific events (human:approval_required, etc.)
    socket.on('user_event', (data: any) => {
      wsStore.recordMessage();
      if (data?.type && !directEvents.has(data.type)) {
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

  /** Receive a project's events; kept across reconnects until unsubscribeProject */
  subscribeProject: (projectId: string) => {
    projectRooms.add(projectId);
    if (socket?.connected) socket.emit('subscribe_project', { projectId });
  },

  unsubscribeProject: (projectId: string) => {
    projectRooms.delete(projectId);
    if (socket?.connected) socket.emit('unsubscribe_project', { projectId });
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
