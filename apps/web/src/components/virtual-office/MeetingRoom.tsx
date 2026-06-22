import React, { useEffect, useRef } from 'react';
import { Typography, Space, Avatar, Empty } from 'antd';
import { RobotOutlined, BulbOutlined, ThunderboltOutlined, MessageOutlined } from '@ant-design/icons';
import { AgentRole } from '@ai-corp/shared-types';
import { MeetingMessage } from '../../stores/meetingStore';

const { Text } = Typography;

const ROLE_COLORS: Record<string, string> = {
  CEO: '#722ed1',
  PM: '#1677ff',
  DEV: '#52c41a',
  QA: '#fa8c16',
  MARKETING: '#eb2f96',
};

interface MeetingRoomProps {
  messages: MeetingMessage[];
  connected: boolean;
}

const MessageBubble: React.FC<{ msg: MeetingMessage }> = ({ msg }) => {
  const roleColor = ROLE_COLORS[msg.fromRole] ?? '#8b949e';
  const timeStr = msg.timestamp.toLocaleTimeString();
  const isSystem = msg.type === 'notification';

  if (isSystem) {
    return (
      <div style={{ textAlign: 'center', padding: '6px 0' }}>
        <Text style={{ color: '#484f58', fontSize: 11, fontStyle: 'italic' }}>
          {msg.message}
        </Text>
      </div>
    );
  }

  const typeIcon = {
    thinking: <BulbOutlined style={{ color: '#faad14', fontSize: 11 }} />,
    action: <ThunderboltOutlined style={{ color: '#1677ff', fontSize: 11 }} />,
    chat: <MessageOutlined style={{ color: '#8b949e', fontSize: 11 }} />,
    notification: null,
  }[msg.type];

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: '8px 0',
        borderBottom: '1px solid #21262d',
      }}
    >
      <Avatar
        size={28}
        icon={<RobotOutlined />}
        style={{ background: roleColor, flexShrink: 0, fontSize: 12 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Space size={6} align="center">
          <Text strong style={{ color: roleColor, fontSize: 12 }}>
            {msg.fromRole}
          </Text>
          {typeIcon}
          <Text style={{ color: '#484f58', fontSize: 10 }}>
            → {msg.toRole === 'all' ? 'everyone' : msg.toRole}
          </Text>
          <Text style={{ color: '#484f58', fontSize: 10 }}>{timeStr}</Text>
        </Space>
        <div
          style={{
            background: msg.type === 'thinking' ? '#faad1408' : '#0d1117',
            border: '1px solid #21262d',
            borderRadius: 6,
            padding: '6px 10px',
            marginTop: 4,
          }}
        >
          <Text
            style={{
              color: msg.type === 'thinking' ? '#d4a816' : '#c9d1d9',
              fontSize: 12,
              fontStyle: msg.type === 'thinking' ? 'italic' : 'normal',
            }}
          >
            {msg.message}
          </Text>
        </div>
      </div>
    </div>
  );
};

export const MeetingRoom: React.FC<MeetingRoomProps> = ({ messages, connected }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Message List */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 0',
        }}
      >
        {messages.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Text style={{ color: '#8b949e' }}>
                {connected
                  ? 'Waiting for agent conversations...'
                  : 'Connect to see agent messages.'}
              </Text>
            }
            style={{ padding: '32px 0' }}
          />
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
        )}
      </div>
    </div>
  );
};
