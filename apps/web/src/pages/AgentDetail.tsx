import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Space, Card, Tag, Button, Avatar, Descriptions, Timeline, Badge, Spin } from 'antd';
import { ArrowLeftOutlined, RobotOutlined, LoadingOutlined, BulbOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { AgentRole, WebSocketEventType, AgentThinkingEvent, AgentActionEvent } from '@ai-corp/shared-types';
import socketClient from '../lib/websocket/socket-client';

const { Title, Text } = Typography;

const ROLE_COLORS: Record<string, string> = {
  CEO: '#722ed1',
  PM: '#1677ff',
  DEV: '#52c41a',
  QA: '#fa8c16',
  MARKETING: '#eb2f96',
};

const ROLE_LABELS: Record<string, string> = {
  CEO: 'Chief Executive Officer',
  PM: 'Product Manager',
  DEV: 'Developer',
  QA: 'Quality Assurance',
  MARKETING: 'Marketing Lead',
};

interface ActivityEntry {
  type: 'thinking' | 'action';
  message: string;
  toolName?: string;
  timestamp: Date;
}

export const AgentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const agentRole = (id?.toUpperCase() ?? 'CEO') as string;
  const roleColor = ROLE_COLORS[agentRole] ?? '#8b949e';
  const roleLabel = ROLE_LABELS[agentRole] ?? agentRole;

  const [isThinking, setIsThinking] = useState(false);
  const [currentTask, setCurrentTask] = useState<string>('');
  const [activities, setActivities] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    const unsubThinking = socketClient.on<AgentThinkingEvent>(
      WebSocketEventType.AGENT_THINKING,
      (data) => {
        if (data.agentRole === agentRole) {
          setIsThinking(true);
          setCurrentTask(data.message);
          setActivities((prev) => [
            { type: 'thinking', message: data.message, timestamp: new Date() },
            ...prev.slice(0, 19),
          ]);
        }
      }
    );

    const unsubAction = socketClient.on<AgentActionEvent>(
      WebSocketEventType.AGENT_ACTION,
      (data) => {
        if (data.agentRole === agentRole) {
          setIsThinking(false);
          setCurrentTask('');
          setActivities((prev) => [
            { type: 'action', message: data.actionType, toolName: data.toolName, timestamp: new Date() },
            ...prev.slice(0, 19),
          ]);
        }
      }
    );

    return () => {
      unsubThinking();
      unsubAction();
    };
  }, [agentRole]);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ color: '#8b949e', marginBottom: 16 }}
      >
        Back
      </Button>

      {/* Agent Header */}
      <Space align="center" size={20} style={{ marginBottom: 32 }}>
        <Badge dot color={isThinking ? '#faad14' : '#52c41a'} offset={[-4, 4]}>
          <Avatar
            size={72}
            icon={isThinking ? <LoadingOutlined /> : <RobotOutlined />}
            style={{ background: roleColor, fontSize: 32 }}
          />
        </Badge>
        <div>
          <Title level={2} style={{ color: '#e6edf3', margin: 0 }}>
            {agentRole} Agent
          </Title>
          <Space size={8} style={{ marginTop: 6 }}>
            <Tag color={roleColor}>{agentRole}</Tag>
            <Tag color={isThinking ? 'warning' : 'success'}>
              {isThinking ? 'Thinking...' : 'Idle'}
            </Tag>
          </Space>
        </div>
      </Space>

      {/* Info Card */}
      <Card
        style={{
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: 12,
          marginBottom: 20,
        }}
        styles={{ body: { padding: 24 } }}
      >
        <Descriptions
          column={2}
          labelStyle={{ color: '#8b949e' }}
          contentStyle={{ color: '#e6edf3' }}
        >
          <Descriptions.Item label="Agent ID">{id}</Descriptions.Item>
          <Descriptions.Item label="Role">{roleLabel}</Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={isThinking ? 'warning' : 'success'}>
              {isThinking ? 'Thinking' : 'Idle'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Memory Namespace">{agentRole.toLowerCase()}_memories</Descriptions.Item>
          <Descriptions.Item label="Current Task" span={2}>
            {currentTask ? (
              <Text style={{ color: '#faad14', fontStyle: 'italic' }}>{currentTask}</Text>
            ) : (
              <Text style={{ color: '#484f58' }}>No active task</Text>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Recent Activity */}
      <Card
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#1677ff' }} />
            <Text style={{ color: '#e6edf3' }}>Recent Activity</Text>
            <Tag style={{ background: '#21262d', border: 'none', color: '#8b949e', fontSize: 11 }}>
              {activities.length}
            </Tag>
          </Space>
        }
        style={{
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: 12,
        }}
        styles={{ header: { background: '#161b22', borderBottom: '1px solid #30363d' } }}
      >
        {activities.length === 0 ? (
          <Text style={{ color: '#484f58' }}>
            No recent activity. Activity will appear here when the agent is invoked.
          </Text>
        ) : (
          <Timeline
            items={activities.map((entry) => ({
              color: entry.type === 'thinking' ? 'warning' : 'blue',
              children: (
                <div>
                  <Space size={6}>
                    {entry.type === 'thinking' ? (
                      <BulbOutlined style={{ color: '#faad14' }} />
                    ) : (
                      <ThunderboltOutlined style={{ color: '#1677ff' }} />
                    )}
                    <Text style={{ color: '#8b949e', fontSize: 11 }}>
                      {entry.timestamp.toLocaleTimeString()}
                    </Text>
                  </Space>
                  <div>
                    <Text style={{ color: '#e6edf3', fontSize: 13 }}>
                      {entry.message}
                    </Text>
                    {entry.toolName && (
                      <Tag color="blue" style={{ marginLeft: 6, fontSize: 11 }}>
                        {entry.toolName}
                      </Tag>
                    )}
                  </div>
                </div>
              ),
            }))}
          />
        )}
      </Card>
    </div>
  );
};
