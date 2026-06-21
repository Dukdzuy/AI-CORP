import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Space, Card, Button, Spin, Skeleton, Tabs, Empty } from 'antd';
import { ArrowLeftOutlined, RocketOutlined } from '@ant-design/icons';
import { Task, WebSocketEventType, TaskUpdatedEvent } from '@ai-corp/shared-types';
import { useProject } from '../lib/api/hooks/projects';
import { useTasks, taskKeys } from '../lib/api/hooks/tasks';
import { useMilestones } from '../lib/api/hooks/milestones';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { TaskDetailModal } from '../components/kanban/TaskDetailModal';
import socketClient from '../lib/websocket/socket-client';
import { useQueryClient } from '@tanstack/react-query';

const { Title, Text } = Typography;

export const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading: projectLoading } = useProject(id ?? null);
  const { data: tasks = [], isLoading: tasksLoading } = useTasks(id ?? null);
  const { data: milestones = [] } = useMilestones(id ?? null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!id) return;

    socketClient.emit('subscribe_project', id);

    const unsubTaskUpdated = socketClient.on<TaskUpdatedEvent>(
      WebSocketEventType.TASK_UPDATED,
      (data) => {
        if (data.projectId === id) {
          queryClient.invalidateQueries({ queryKey: taskKeys.list(id) });
        }
      }
    );

    return () => {
      unsubTaskUpdated();
    };
  }, [id, queryClient]);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setModalOpen(true);
  };

  if (projectLoading) {
    return (
      <div style={{ padding: 40 }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 80 }}>
        <Empty description={<Text style={{ color: '#8b949e' }}>Project not found.</Text>} />
        <Button type="primary" onClick={() => navigate('/')} style={{ marginTop: 16 }}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const tabItems = [
    {
      key: 'kanban',
      label: 'Kanban Board',
      children: tasksLoading ? (
        <Spin />
      ) : (
        <KanbanBoard tasks={tasks} onTaskClick={handleTaskClick} />
      ),
    },
    {
      key: 'milestones',
      label: `Milestones (${milestones.length})`,
      children: milestones.length === 0 ? (
        <Empty description={<Text style={{ color: '#8b949e' }}>No milestones yet.</Text>} />
      ) : (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {milestones.map((m) => (
            <Card
              key={m.id}
              size="small"
              style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8 }}
            >
              <Text strong style={{ color: '#e6edf3' }}>{m.name}</Text>
              {m.description && (
                <Text style={{ color: '#8b949e', display: 'block', fontSize: 13 }}>{m.description}</Text>
              )}
            </Card>
          ))}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Back + Header */}
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/')}
        style={{ color: '#8b949e', marginBottom: 16 }}
      >
        Back to Dashboard
      </Button>

      <Space align="start" style={{ width: '100%', marginBottom: 24 }}>
        <div
          style={{
            background: '#1677ff22',
            borderRadius: 10,
            padding: '10px 12px',
            fontSize: 24,
            color: '#1677ff',
          }}
        >
          <RocketOutlined />
        </div>
        <div>
          <Title level={3} style={{ color: '#e6edf3', margin: 0 }}>
            {project.name}
          </Title>
          <Text style={{ color: '#8b949e' }}>{project.description}</Text>
        </div>
      </Space>

      {/* Tabs */}
      <Tabs
        items={tabItems}
        style={{ color: '#e6edf3' }}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedTask(null);
        }}
      />
    </div>
  );
};
