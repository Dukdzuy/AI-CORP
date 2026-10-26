import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { WebSocketEventType } from '@ai-corp/shared-types';
import socketClient from '../../lib/websocket/socket-client';
import { artifactKeys } from '../../lib/api/hooks/artifacts';
import { addWarning, gateFromEvent, GateView, warningFromEvent, WarningView } from './qualityGate';

/**
 * Live quality_gate_result / quality_warning events of a project. They arrive on project_event,
 * so they are kept here (ProjectDetail level) and survive tab switches. Each event also
 * refreshes the artifact queries, because the agent that sent it has just written files.
 */
export function useQualityEvents(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const [gates, setGates] = useState<GateView[]>([]);
  const [warnings, setWarnings] = useState<WarningView[]>([]);

  useEffect(() => {
    if (!projectId) return;
    setGates([]);
    setWarnings([]);
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: artifactKeys.files(projectId) });
      queryClient.invalidateQueries({ queryKey: artifactKeys.metrics(projectId) });
    };
    const offGate = socketClient.on(WebSocketEventType.QUALITY_GATE_RESULT, (event: unknown) => {
      const gate = gateFromEvent(event);
      if (!gate) return;
      setGates(prev => [gate, ...prev.filter(g => g.gateId !== gate.gateId)]);
      queryClient.invalidateQueries({ queryKey: artifactKeys.gates(projectId) });
      refresh();
    });
    const offWarning = socketClient.on(WebSocketEventType.QUALITY_WARNING, (event: unknown) => {
      const warning = warningFromEvent(event);
      if (!warning) return;
      setWarnings(prev => addWarning(prev, warning));
      refresh();
    });
    return () => {
      offGate();
      offWarning();
    };
  }, [projectId, queryClient]);

  return { gates, warnings, dismissWarnings: () => setWarnings([]) };
}
