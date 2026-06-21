import React from 'react';
import { Card, Tag, Typography, Space, Tooltip } from 'antd';
import { RobotOutlined, DollarOutlined, ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';
import { Task, TaskPriority } from '@ai-corp/shared-types';

const { Text } = Typography;

const PRIORITY_CONFIG: Record<TaskPriority, { color: string; icon: React.ReactNode; label: string }> = {
  [TaskPriority.HIGH]: { color: '#ff4d4f', icon: <ArrowUpOutlined />, label: 'High' },
  [TaskPriority.MEDIUM]: { color: '#faad14', icon: <MinusOutlined />, label: 'Medium' },
  [TaskPriority.LOW]: { color: '#52c41a', icon: <ArrowDownOutlined />, label: 'Low' },
};

const ROLE_COLORS: Record<string, string> = {
  CEO: '#722ed1',
  PM: '#1677ff',
  DEV: '#52c41a',
  QA: '#fa8c16',
  MARKETING: '#eb2f96',
};

interface TaskCardProps {
  task: Task;
  onDragStart: (taskId: string) => void;
  onClick?: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onDragStart, onClick }) => {
  const priority = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG[TaskPriority.MEDIUM];
  const roleColor = task.assignedAgent ? ROLE_COLORS[task.assignedAgent] ?? '#8b949e' : undefined;
  const costExceeded = task.estimatedCost != null && task.actualCost > task.estimatedCost;

  return (
    <Card
      size="small"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(task.id);
      }}
      onClick={() => onClick?.(task)}
      style={{
        background: '#0d1117',
        border: '1px solid #30363d',
        borderRadius: 8,
        cursor: 'grab',
        transition: 'all 0.15s ease',
        marginBottom: 8,
      }}
      styles={{ body: { padding: '10px 12px' } }}
    >
      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        {/* Title + Priority */}
        <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
          <Text
            style={{ color: '#e6edf3', fontSize: 13, fontWeight: 500, lineHeight: 1.4, flex: 1 }}
          >
            {task.title}
          </Text>
          <Tooltip title={priority.label}>
            <Tag
              color={priority.color}
              icon={priority.icon}
              style={{ margin: 0, fontSize: 10, lineHeight: '14px', padding: '0 4px' }}
            />
          </Tooltip>
        </Space>

        {/* Description */}
        {task.description && (
          <div
            style={{
              color: '#8b949e',
              fontSize: 12,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: '16px',
            }}
          >
            {task.description}
          </div>
        )}

        {/* Footer: Agent + Cost */}
        <Space style={{ width: '100%', justifyContent: 'space-between' }} size={4}>
          {task.assignedAgent ? (
            <Tooltip title={`Assigned to ${task.assignedAgent}`}>
              <Tag
                icon={<RobotOutlined />}
                color={roleColor}
                style={{ margin: 0, fontSize: 11 }}
              >
                {task.assignedAgent}
              </Tag>
            </Tooltip>
          ) : (
            <Text style={{ color: '#484f58', fontSize: 11 }}>Unassigned</Text>
          )}

          {(task.estimatedCost != null || task.actualCost > 0) && (
            <Tooltip
              title={
                task.estimatedCost != null
                  ? `Estimated: $${task.estimatedCost.toFixed(2)} | Actual: $${task.actualCost.toFixed(2)}`
                  : `Actual: $${task.actualCost.toFixed(2)}`
              }
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  background: costExceeded ? '#ff4d4f18' : '#21262d',
                  border: `1px solid ${costExceeded ? '#ff4d4f44' : '#30363d'}`,
                  borderRadius: 4,
                  padding: '1px 5px',
                }}
              >
                <DollarOutlined
                  style={{ color: costExceeded ? '#ff4d4f' : '#8b949e', fontSize: 10 }}
                />
                {task.estimatedCost != null && (
                  <Text style={{ color: '#8b949e', fontSize: 10, textDecoration: 'line-through' }}>
                    {task.estimatedCost.toFixed(2)}
                  </Text>
                )}
                <Text
                  style={{
                    color: costExceeded ? '#ff4d4f' : '#52c41a',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {task.actualCost.toFixed(2)}
                </Text>
              </div>
            </Tooltip>
          )}
        </Space>
      </Space>
    </Card>
  );
};
