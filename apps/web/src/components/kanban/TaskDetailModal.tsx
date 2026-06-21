import React from 'react';
import { Modal, Typography, Space, Tag, Descriptions, Button, Divider, message } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  RobotOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { Task, TaskStatus, TaskPriority, AgentRole } from '@ai-corp/shared-types';
import { useUpdateTask } from '../../lib/api/hooks/tasks';

const { Text, Paragraph } = Typography;

const STATUS_CONFIG: Record<TaskStatus, { color: string; label: string }> = {
  [TaskStatus.TODO]: { color: 'default', label: 'Todo' },
  [TaskStatus.IN_PROGRESS]: { color: 'blue', label: 'In Progress' },
  [TaskStatus.REVIEW]: { color: 'orange', label: 'Review' },
  [TaskStatus.DONE]: { color: 'green', label: 'Done' },
};

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

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.TODO, TaskStatus.REVIEW],
  [TaskStatus.REVIEW]: [TaskStatus.IN_PROGRESS, TaskStatus.DONE],
  [TaskStatus.DONE]: [TaskStatus.REVIEW],
};

interface TaskDetailModalProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ task, open, onClose }) => {
  const updateTask = useUpdateTask();

  if (!task) return null;

  const statusCfg = STATUS_CONFIG[task.status];
  const priorityCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG[TaskPriority.MEDIUM];
  const allowedTransitions = VALID_TRANSITIONS[task.status] ?? [];
  const costExceeded = task.estimatedCost != null && task.actualCost > task.estimatedCost;

  const handleStatusChange = async (newStatus: TaskStatus) => {
    try {
      await updateTask.mutateAsync({ id: task.id, status: newStatus });
      message.success(`Task moved to ${STATUS_CONFIG[newStatus].label}`);
    } catch {
      message.error('Failed to update task status');
    }
  };

  return (
    <Modal
      title={
        <Space>
          <Text style={{ color: '#e6edf3', fontSize: 16, fontWeight: 600 }}>
            {task.title}
          </Text>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={
        allowedTransitions.length > 0
          ? (
            <Space>
              {allowedTransitions.map((status) => (
                <Button
                  key={status}
                  type={status === TaskStatus.DONE ? 'primary' : 'default'}
                  onClick={() => handleStatusChange(status)}
                  loading={updateTask.isPending}
                  style={
                    status === TaskStatus.DONE
                      ? { background: '#52c41a', borderColor: '#52c41a' }
                      : { borderColor: '#30363d' }
                  }
                >
                  Move to {STATUS_CONFIG[status].label}
                </Button>
              ))}
            </Space>
          )
          : null
      }
      width={560}
      styles={{
        content: { background: '#161b22', border: '1px solid #30363d' },
        header: { background: '#161b22', borderBottom: '1px solid #30363d' },
      }}
    >
      <Descriptions
        column={2}
        labelStyle={{ color: '#8b949e', padding: '8px 0' }}
        contentStyle={{ color: '#e6edf3', padding: '8px 0' }}
        style={{ marginTop: 16 }}
      >
        <Descriptions.Item label="Status">
          <Tag color={statusCfg.color}>{statusCfg.label}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Priority">
          <Tag color={priorityCfg.color} icon={priorityCfg.icon}>
            {priorityCfg.label}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Assigned Agent">
          {task.assignedAgent ? (
            <Tag icon={<RobotOutlined />} color={ROLE_COLORS[task.assignedAgent] ?? '#8b949e'}>
              {task.assignedAgent}
            </Tag>
          ) : (
            <Text style={{ color: '#484f58' }}>Unassigned</Text>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Task ID">
          <Text style={{ color: '#8b949e', fontSize: 12, fontFamily: 'monospace' }}>
            {task.id.slice(0, 8)}...
          </Text>
        </Descriptions.Item>
      </Descriptions>

      {task.description && (
        <>
          <Divider style={{ borderColor: '#30363d', margin: '12px 0' }} />
          <Text style={{ color: '#8b949e', fontSize: 12, display: 'block', marginBottom: 4 }}>
            Description
          </Text>
          <Paragraph style={{ color: '#c9d1d9', fontSize: 13 }}>
            {task.description}
          </Paragraph>
        </>
      )}

      <Divider style={{ borderColor: '#30363d', margin: '12px 0' }} />

      <Space size={24}>
        {task.estimatedCost != null && (
          <Descriptions.Item label="Estimated Cost" style={{ padding: 0 }}>
            <Space size={4}>
              <DollarOutlined style={{ color: '#8b949e' }} />
              <Text style={{ color: '#e6edf3' }}>${task.estimatedCost.toFixed(2)}</Text>
            </Space>
          </Descriptions.Item>
        )}
        <Descriptions.Item label="Actual Cost" style={{ padding: 0 }}>
          <Space size={4}>
            <DollarOutlined style={{ color: costExceeded ? '#ff4d4f' : '#8b949e' }} />
            <Text style={{ color: costExceeded ? '#ff4d4f' : '#e6edf3', fontWeight: costExceeded ? 600 : 400 }}>
              ${task.actualCost.toFixed(2)}
            </Text>
          </Space>
        </Descriptions.Item>
      </Space>
    </Modal>
  );
};
