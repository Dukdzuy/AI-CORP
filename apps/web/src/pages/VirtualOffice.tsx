import React, { useEffect, useState, useCallback } from 'react';
import { Typography, Space, Card, Badge, Row, Col, Tag, Flex } from 'antd';
import { RobotOutlined, TeamOutlined, MessageOutlined } from '@ant-design/icons';
import { WebSocketEventType, AgentThinkingEvent, AgentActionEvent, AgentMessageEvent, AgentRole } from '@ai-corp/shared-types';
import { useWebsocketStore } from '../stores/websocketStore';
import socketClient from '../lib/websocket/socket-client';
import { AgentStatusCard, AgentStatus } from '../components/virtual-office/AgentStatusCard';
import { MeetingRoom, MeetingMessage } from '../components/virtual-office/MeetingRoom';

const { Title, Text } = Typography;

const AGENT_ROLES = [AgentRole.CEO, AgentRole.PM, AgentRole.DEV, AgentRole.QA, AgentRole.MARKETING];

export const VirtualOffice: React.FC = () => {
  const { status } = useWebsocketStore();
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [agentActivities, setAgentActivities] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<MeetingMessage[]>([]);

  const addMessage = useCallback((msg: MeetingMessage) => {
    setMessages((prev) => [...prev.slice(-199), msg]);
  }, []);

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
        });
      }
    );

    const unsubMessage = socketClient.on<AgentMessageEvent>(
      WebSocketEventType.AGENT_MESSAGE,
      (data) => {
        setAgentStatuses((prev) => ({ ...prev, [data.fromAgent]: 'idle' }));
        addMessage({
          id: `msg-${Date.now()}-${data.fromAgent}`,
          fromRole: data.fromAgent,
          toRole: data.toAgent,
          message: data.message,
          type: data.messageType as MeetingMessage['type'],
          timestamp: new Date(data.timestamp),
        });
      }
    );

    return () => {
      unsubThinking();
      unsubAction();
      unsubMessage();
    };
  }, [addMessage]);

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
        <Badge
          color={status === 'connected' ? '#52c41a' : '#ff4d4f'}
          text={
            <Text style={{ color: '#8b949e', textTransform: 'capitalize' }}>
              {status === 'connected' ? 'Live' : status}
            </Text>
          }
        />
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
                  {messages.length} messages
                </Tag>
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
              body: { padding: 16, overflow: 'hidden', height: 'calc(100% - 56px)', display: 'flex', flexDirection: 'column' },
            }}
          >
            <MeetingRoom messages={messages} connected={status === 'connected'} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
