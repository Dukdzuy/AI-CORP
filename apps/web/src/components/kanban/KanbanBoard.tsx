import React, { useState, useCallback } from 'react';
import { Typography, Tag, Space } from 'antd';
import { Task, TaskStatus } from '@ai-corp/shared-types';
import { useUpdateTask } from '../../lib/api/hooks/tasks';
import { TaskCard } from './TaskCard';

const { Text } = Typography;

const COLUMNS: { key: TaskStatus; title: string; color: string }[] = [
  { key: TaskStatus.TODO, title: 'Todo', color: '#8b949e' },
  { key: TaskStatus.IN_PROGRESS, title: 'In Progress', color: '#1677ff' },
  { key: TaskStatus.REVIEW, title: 'Review', color: '#fa8c16' },
  { key: TaskStatus.DONE, title: 'Done', color: '#52c41a' },
];

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.TODO, TaskStatus.REVIEW],
  [TaskStatus.REVIEW]: [TaskStatus.IN_PROGRESS, TaskStatus.DONE],
  [TaskStatus.DONE]: [TaskStatus.REVIEW],
};

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ tasks, onTaskClick }) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);
  const updateTask = useUpdateTask();

  const handleDragStart = useCallback((taskId: string) => {
    setDraggedTaskId(taskId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedTaskId(null);
    setDropTarget(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(status);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetStatus: TaskStatus) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData('text/plain');
      if (!taskId) return;

      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.status === targetStatus) {
        setDraggedTaskId(null);
        setDropTarget(null);
        return;
      }

      const allowed = VALID_TRANSITIONS[task.status];
      if (!allowed.includes(targetStatus)) {
        setDraggedTaskId(null);
        setDropTarget(null);
        return;
      }

      try {
        await updateTask.mutateAsync({ id: taskId, status: targetStatus });
      } catch {
        // Error handled by mutation
      }

      setDraggedTaskId(null);
      setDropTarget(null);
    },
    [tasks, updateTask]
  );

  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16 }}>
      {COLUMNS.map((col) => {
        const columnTasks = tasks.filter((t) => t.status === col.key);
        const isDropTarget = dropTarget === col.key;

        return (
          <div
            key={col.key}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.key)}
            style={{
              flex: '1 1 0',
              minWidth: 260,
              maxWidth: 340,
              background: isDropTarget ? '#1c2128' : '#161b22',
              border: isDropTarget ? '2px dashed #1677ff' : '1px solid #30363d',
              borderRadius: 10,
              padding: 12,
              transition: 'all 0.15s ease',
            }}
          >
            {/* Column Header */}
            <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
              <Space size={6}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: col.color,
                  }}
                />
                <Text style={{ color: '#e6edf3', fontSize: 13, fontWeight: 600 }}>
                  {col.title}
                </Text>
              </Space>
              <Tag
                style={{
                  background: '#21262d',
                  border: 'none',
                  color: '#8b949e',
                  fontSize: 11,
                  margin: 0,
                }}
              >
                {columnTasks.length}
              </Tag>
            </Space>

            {/* Task List */}
            {columnTasks.length === 0 ? (
              <div
                style={{
                  padding: '24px 0',
                  textAlign: 'center',
                }}
              >
                <Text style={{ color: '#484f58', fontSize: 12 }}>
                  {isDropTarget ? 'Drop here' : 'No tasks'}
                </Text>
              </div>
            ) : (
              columnTasks.map((task) => (
                <div
                  key={task.id}
                  onDragEnd={handleDragEnd}
                  style={{
                    opacity: draggedTaskId === task.id ? 0.4 : 1,
                  }}
                >
                  <TaskCard
                    task={task}
                    onDragStart={handleDragStart}
                    onClick={onTaskClick}
                  />
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
};
