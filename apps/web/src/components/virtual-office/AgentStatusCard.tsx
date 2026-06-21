import React from 'react';
import { Card, Avatar, Typography, Space, Badge, Tag } from 'antd';
import { RobotOutlined, LoadingOutlined, BulbOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { AgentRole } from '@ai-corp/shared-types';

const { Text } = Typography;

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

export type AgentStatus = 'idle' | 'thinking' | 'working';

interface AgentStatusCardProps {
  role: AgentRole;
  name: string;
  status: AgentStatus;
  lastActivity?: string;
}

const STATUS_CONFIG: Record<AgentStatus, { color: string; icon: React.ReactNode; label: string }> = {
  idle: { color: '#8b949e', icon: null, label: 'Idle' },
  thinking: { color: '#faad14', icon: <BulbOutlined style={{ fontSize: 10 }} />, label: 'Thinking' },
  working: { color: '#52c41a', icon: <ThunderboltOutlined style={{ fontSize: 10 }} />, label: 'Working' },
};

export const AgentStatusCard: React.FC<AgentStatusCardProps> = ({
  role,
  name,
  status,
  lastActivity,
}) => {
  const roleColor = ROLE_COLORS[role] ?? '#8b949e';
  const statusConfig = STATUS_CONFIG[status];
  const isThinking = status === 'thinking';

  return (
    <Card
      size="small"
      style={{
        background: '#161b22',
        border: `1px solid ${status === 'idle' ? '#30363d' : roleColor + '44'}`,
        borderRadius: 10,
        transition: 'all 0.3s ease',
      }}
      styles={{ body: { padding: '14px 16px' } }}
    >
      <Space align="center" size={12}>
        <Badge dot color={statusConfig.color} offset={[-2, 2]}>
          <Avatar
            size={44}
            icon={isThinking ? <LoadingOutlined /> : <RobotOutlined />}
            style={{
              background: roleColor,
              fontSize: 20,
              transition: 'all 0.3s ease',
            }}
          />
        </Badge>

        <div style={{ flex: 1, minWidth: 0 }}>
          <Space size={6} align="center">
            <Text style={{ color: '#e6edf3', fontSize: 14, fontWeight: 600 }}>
              {role}
            </Text>
            <Tag
              color={statusConfig.color}
              icon={statusConfig.icon}
              style={{ margin: 0, fontSize: 10, lineHeight: '14px', padding: '0 5px' }}
            >
              {statusConfig.label}
            </Tag>
          </Space>
          <div>
            <Text style={{ color: '#8b949e', fontSize: 11 }}>
              {ROLE_LABELS[role] ?? role}
            </Text>
          </div>
          {lastActivity && (
            <div>
              <Text
                ellipsis
                style={{ color: '#484f58', fontSize: 11, display: 'block', maxWidth: 180 }}
              >
                {lastActivity}
              </Text>
            </div>
          )}
        </div>
      </Space>
    </Card>
  );
};
