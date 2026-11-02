import React, { useEffect, useState } from 'react';
import { Typography, Space, Card, Badge, Row, Col, Tag, Flex, Select } from 'antd';
import { TeamOutlined, MessageOutlined, ClearOutlined } from '@ant-design/icons';
import { WebSocketEventType, AgentThinkingEvent, AgentActionEvent, AgentMessageEvent, ApprovalRequiredEvent, AgentRole } from '@ai-corp/shared-types';
import { useWebsocketStore } from '../stores/websocketStore';
import { useMeetingStore, MeetingMessage } from '../stores/meetingStore';
import { usePendingApprovals } from '../lib/api/hooks/approvals';
import { useProjects } from '../lib/api/hooks/projects';
import socketClient from '../lib/websocket/socket-client';
import { AgentStatusCard, AgentStatus } from '../components/virtual-office/AgentStatusCard';
import { MeetingRoom } from '../components/virtual-office/MeetingRoom';

const { Title, Text } = Typography;

const AGENT_ROLES = [
  AgentRole.CEO,
  AgentRole.BA,
  AgentRole.ARCHITECT,
  AgentRole.PM,
  AgentRole.DEV,
  AgentRole.QC,
  AgentRole.QA,
  AgentRole.MARKETING,
];

export const VirtualOffice: React.FC = () => {
  const { status } = useWebsocketStore();
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [agentActivities, setAgentActivities] = useState<Record<string, string>>({});
  const messages = useMeetingStore((s) => s.messages);
  const addMessage = useMeetingStore((s) => s.addMessage);
  const clearMessages = useMeetingStore((s) => s.clearMessages);
  const { data: apiApprovals = [] } = usePendingApprovals();
  const { data: projects = [] } = useProjects();
  // Which project the office shows; 'all' follows every active project
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const activeProjectIds = projects.filter(p => p.status === 'active').map(p => p.id);
  const watchedIds = projectFilter === 'all' ? activeProjectIds : [projectFilter];
  const watchedKey = watchedIds.join(',');
  const visibleMessages = projectFilter === 'all' ? messages : messages.filter(m => m.projectId === projectFilter);

  // Agent actions and messages are sent to project rooms: join the rooms of the watched projects
  useEffect(() => {
    const ids = watchedKey ? watchedKey.split(',') : [];
    ids.forEach(id => socketClient.subscribeProject(id));
    return () => ids.forEach(id => socketClient.unsubscribeProject(id));
  }, [watchedKey]);

  // Add pending approvals from REST API as meeting room messages on mount
  useEffect(() => {
    if (apiApprovals.length > 0) {
      for (const a of apiApprovals) {
        addMessage({
          id: `approval-${a.id}`,
          fromRole: 'QA' as AgentRole,
          toRole: 'all',
          message: `⚠️ APPROVAL REQUIRED: ${a.approvalType} — QA passed, needs human sign-off.`,
          type: 'approval',
          timestamp: new Date(a.requestedAt),
          approvalId: a.id,
          projectId: a.workflowRun?.projectId || '',
          approvalType: a.approvalType,
          requestData: a.requestData as Record<string, unknown>,
        });
      }
    }
  }, [apiApprovals.length]);

  useEffect(() => {
    const unsubThinking = socketClient.on<AgentThinkingEvent>(
      WebSocketEventType.AGENT_THINKING,
      (data) => {
        setAgentStatuses((prev) => ({ ...prev, [data.agentRole]: 'thinking' }));
        setAgentActivities((prev) => ({ ...prev, [data.agentRole]: data.message }));
        addMessage({
          id: `think-${Date.now()}-${data.agentRole}`,
          fromRole: data.agentRole,
          toRole: 'all',
          message: data.message,
          type: 'thinking',
          timestamp: new Date(),
          projectId: data.projectId,
        });
      }
    );

    const unsubAction = socketClient.on<AgentActionEvent>(
      WebSocketEventType.AGENT_ACTION,
      (data) => {
        setAgentStatuses((prev) => ({ ...prev, [data.agentRole]: 'working' }));
        setAgentActivities((prev) => ({
          ...prev,
          [data.agentRole]: `${data.actionType} via ${data.toolName}`,
        }));
        addMessage({
          id: `action-${Date.now()}-${data.agentRole}`,
          fromRole: data.agentRole,
          toRole: 'all',
          message: `${data.actionType}: ${data.toolName}`,
          type: 'action',
          timestamp: new Date(),
          projectId: data.projectId,
        });
      }
    );

    const unsubMessage = socketClient.on<AgentMessageEvent>(
      WebSocketEventType.AGENT_MESSAGE,
      (data) => {
        setAgentStatuses((prev) => ({ ...prev, [data.fromAgent]: 'idle' }));
        addMessage({
          id: data.id ?? `msg-${Date.now()}-${data.fromAgent}`,
          fromRole: data.fromAgent,
          toRole: data.toAgent || 'all',
          message: data.message,
          type: data.messageType as MeetingMessage['type'],
          timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
          projectId: data.projectId,
          performative: data.performative,
          protocol: data.protocol,
        });
      }
    );

    const unsubApproval = socketClient.on<ApprovalRequiredEvent>(
      WebSocketEventType.HUMAN_APPROVAL_REQUIRED,
      (data) => {
        addMessage({
          id: `approval-${data.approvalId}`,
          fromRole: 'QA' as AgentRole,
          toRole: 'all',
          message: `⚠️ APPROVAL REQUIRED: ${data.approvalType} — QA passed, needs human sign-off.`,
          type: 'approval',
          timestamp: new Date(data.requestedAt),
          approvalId: data.approvalId,
          projectId: data.projectId,
          approvalType: data.approvalType,
          requestData: data.requestData,
        });
      }
    );

    return () => {
      unsubThinking();
      unsubAction();
      unsubMessage();
      unsubApproval();
    };
  }, []);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <Flex justify="space-between" align="center" style={{ width: '100%', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ color: '#e6edf3', margin: 0 }}>
            Virtual Office
          </Title>
          <Text style={{ color: '#8b949e' }}>
            Watch your AI agents collaborate in real-time.
          </Text>
        </div>
        <Space size={16}>
        <Select
          value={projectFilter}
          onChange={setProjectFilter}
          style={{ width: 260 }}
          showSearch
          optionFilterProp="label"
          options={[
            { value: 'all', label: 'All active projects' },
            ...projects.map(p => ({ value: p.id, label: p.name })),
          ]}
        />
        <Badge
          color={status === 'connected' ? '#52c41a' : '#ff4d4f'}
          text={
            <Text style={{ color: '#8b949e', textTransform: 'capitalize' }}>
              {status === 'connected' ? 'Live' : status}
            </Text>
          }
        />
        </Space>
      </Flex>

      {/* Two-column layout */}
      <Row gutter={[16, 16]}>
        {/* Left: Agent Grid */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <TeamOutlined style={{ color: '#1677ff' }} />
                <Text style={{ color: '#e6edf3' }}>Agent Status</Text>
              </Space>
            }
            style={{
              background: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: 12,
              height: 'calc(100vh - 200px)',
              overflow: 'hidden',
            }}
            styles={{
              header: { background: '#161b22', borderBottom: '1px solid #30363d' },
              body: { padding: 12, overflowY: 'auto', height: 'calc(100% - 56px)' },
            }}
          >
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {AGENT_ROLES.map((role) => (
                <AgentStatusCard
                  key={role}
                  role={role}
                  name={`${role} Agent`}
                  status={agentStatuses[role] ?? 'idle'}
                  lastActivity={agentActivities[role]}
                />
              ))}
            </Space>
          </Card>
        </Col>

        {/* Right: Meeting Room */}
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <MessageOutlined style={{ color: '#52c41a' }} />
                <Text style={{ color: '#e6edf3' }}>Meeting Room</Text>
                <Tag style={{ background: '#21262d', border: 'none', color: '#8b949e', fontSize: 11 }}>
                  {visibleMessages.length} messages
                </Tag>
              </Space>
            }
            extra={
              messages.length > 0 ? (
                <ClearOutlined
                  style={{ color: '#8b949e', cursor: 'pointer' }}
                  onClick={clearMessages}
                  title="Clear messages"
                />
              ) : null
            }
            style={{
              background: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: 12,
              height: 'calc(100vh - 200px)',
              overflow: 'hidden',
            }}
            styles={{
              header: { background: '#161b22', borderBottom: '1px solid #30363d' },
              body: { padding: 16, overflow: 'hidden', height: 'calc(100% - 56px)', display: 'flex', flexDirection: 'column' },
            }}
          >
            <MeetingRoom messages={visibleMessages} connected={status === 'connected'} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
