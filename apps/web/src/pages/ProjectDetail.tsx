import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Space, Card, Button, Spin, Skeleton, Tabs, Empty, Tag, Collapse, Timeline, Badge, Alert } from 'antd';
import { ArrowLeftOutlined, RocketOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, ThunderboltOutlined, FileTextOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { Task, WebSocketEventType, TaskUpdatedEvent, ApprovalRequiredEvent } from '@ai-corp/shared-types';
import { useProject } from '../lib/api/hooks/projects';
import { useTasks, taskKeys } from '../lib/api/hooks/tasks';
import { useMilestones } from '../lib/api/hooks/milestones';
import { usePendingApprovals, approvalKeys } from '../lib/api/hooks/approvals';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { TaskDetailModal } from '../components/kanban/TaskDetailModal';
import socketClient from '../lib/websocket/socket-client';
import { useQueryClient } from '@tanstack/react-query';

const { Title, Text, Paragraph } = Typography;

const STATUS_COLORS: Record<string, string> = {
  completed: '#52c41a',
  failed: '#ff4d4f',
  running: '#1677ff',
  pending: '#faad14',
  cancelled: '#8b949e',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  failed: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
  running: <ClockCircleOutlined style={{ color: '#1677ff' }} />,
  pending: <ClockCircleOutlined style={{ color: '#faad14' }} />,
};

export const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading: projectLoading } = useProject(id ?? null);
  const { data: tasks = [], isLoading: tasksLoading } = useTasks(id ?? null);
  const { data: milestones = [] } = useMilestones(id ?? null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { data: apiApprovals = [] } = usePendingApprovals(id ?? undefined);
  const [wsApprovals, setWsApprovals] = useState<ApprovalRequiredEvent['data'][]>([]);
  const queryClient = useQueryClient();

  // Merge REST API approvals + WebSocket approvals, dedupe by approvalId
  const pendingApprovals = [...apiApprovals.map((a: any) => ({
    approvalId: a.id,
    workflowRunId: a.workflowRunId,
    projectId: a.workflowRun?.projectId || id || '',
    approvalType: a.approvalType,
    requestData: a.requestData as Record<string, unknown>,
    requestedAt: new Date(a.requestedAt),
  })), ...wsApprovals].filter((a, i, arr) =>
    arr.findIndex((b) => b.approvalId === a.approvalId) === i
  );

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

    const unsubApproval = socketClient.on<ApprovalRequiredEvent>(
      WebSocketEventType.HUMAN_APPROVAL_REQUIRED,
      (data) => {
        if (data.projectId === id) {
          setWsApprovals((prev) => [
            ...prev.filter((a) => a.approvalId !== data.approvalId),
            data,
          ]);
        }
      }
    );

    return () => {
      unsubTaskUpdated();
      unsubApproval();
    };
  }, [id, queryClient]);

  const handleApprove = useCallback((approvalId: string) => {
    socketClient.emit('human:approval_response', {
      approvalId,
      status: 'approved',
      respondedAt: new Date().toISOString(),
    });
    setWsApprovals((prev) => prev.filter((a) => a.approvalId !== approvalId));
    queryClient.invalidateQueries({ queryKey: approvalKeys.pending(id) });
  }, [id, queryClient]);

  const handleReject = useCallback((approvalId: string) => {
    socketClient.emit('human:approval_response', {
      approvalId,
      status: 'rejected',
      respondedAt: new Date().toISOString(),
    });
    setWsApprovals((prev) => prev.filter((a) => a.approvalId !== approvalId));
    queryClient.invalidateQueries({ queryKey: approvalKeys.pending(id) });
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

  const workflowRuns = (project as any).workflowRuns || [];
  const completedRun = workflowRuns.find((r: any) => r.status === 'completed');
  const latestContext = completedRun?.context?.variables || {};

  const tabItems = [
    {
      key: 'output',
      label: 'Project Output',
      children: (
        <div>
          {!completedRun ? (
            <Empty description={<Text style={{ color: '#8b949e' }}>No completed workflow yet. Output will appear here after the project finishes.</Text>} />
          ) : (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Alert
                message="Project Completed"
                description={`Workflow run completed at ${new Date(completedRun.completedAt).toLocaleString()}`}
                type="success"
                showIcon
                style={{ background: '#161b22', border: '1px solid #30363d' }}
              />

              {latestContext.productName && (
                <Card size="small" style={{ background: '#161b22', border: '1px solid #30363d' }}>
                  <Text strong style={{ color: '#e6edf3' }}>Product Name</Text>
                  <Paragraph style={{ color: '#8b949e', margin: '4px 0 0' }}>{latestContext.productName}</Paragraph>
                </Card>
              )}

              {latestContext.productDescription && (
                <Card size="small" style={{ background: '#161b22', border: '1px solid #30363d' }}>
                  <Text strong style={{ color: '#e6edf3' }}>Product Description</Text>
                  <Paragraph style={{ color: '#8b949e', margin: '4px 0 0' }}>{latestContext.productDescription}</Paragraph>
                </Card>
              )}

              {latestContext.marketingAnnouncement && (
                <Card size="small" style={{ background: '#161b22', border: '1px solid #30363d' }}>
                  <Text strong style={{ color: '#e6edf3' }}>Marketing Announcement</Text>
                  <Paragraph style={{ color: '#8b949e', margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{latestContext.marketingAnnouncement}</Paragraph>
                </Card>
              )}

              {latestContext.approvalDecision && (
                <Card size="small" style={{ background: '#161b22', border: '1px solid #30363d' }}>
                  <Text strong style={{ color: '#e6edf3' }}>Approval Decision</Text>
                  <Paragraph style={{ color: '#8b949e', margin: '4px 0 0' }}>{latestContext.approvalDecision}</Paragraph>
                </Card>
              )}

              <Card size="small" style={{ background: '#161b22', border: '1px solid #30363d' }}>
                <Text strong style={{ color: '#e6edf3' }}>Full Workflow Context</Text>
                <pre style={{
                  background: '#0d1117',
                  border: '1px solid #30363d',
                  borderRadius: 6,
                  padding: 12,
                  marginTop: 8,
                  fontSize: 12,
                  color: '#8b949e',
                  overflow: 'auto',
                  maxHeight: 400,
                }}>
                  {JSON.stringify(latestContext, null, 2)}
                </pre>
              </Card>
            </Space>
          )}
        </div>
      ),
    },
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
    {
      key: 'workflow',
      label: `Workflow Runs (${workflowRuns.length})`,
      children: workflowRuns.length === 0 ? (
        <Empty description={<Text style={{ color: '#8b949e' }}>No workflow runs yet.</Text>} />
      ) : (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {workflowRuns.map((run: any) => (
            <Collapse
              key={run.id}
              style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8 }}
              items={[{
                key: run.id,
                label: (
                  <Space>
                    {STATUS_ICONS[run.status]}
                    <Text strong style={{ color: '#e6edf3' }}>
                      Run {run.id.slice(0, 8)}...
                    </Text>
                    <Tag color={STATUS_COLORS[run.status]}>{run.status}</Tag>
                    <Text style={{ color: '#8b949e', fontSize: 12 }}>
                      {new Date(run.startedAt).toLocaleString()}
                    </Text>
                    {run.completedAt && (
                      <Text style={{ color: '#8b949e', fontSize: 12 }}>
                        ({Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s)
                      </Text>
                    )}
                  </Space>
                ),
                children: (
                  <Timeline
                    items={(run.steps || []).map((step: any) => ({
                      dot: STATUS_ICONS[step.status],
                      children: (
                        <div>
                          <Space>
                            <Tag>{step.nodeId}</Tag>
                            {step.agentRole && <Tag color="blue">{step.agentRole}</Tag>}
                            <Tag color={STATUS_COLORS[step.status]}>{step.status}</Tag>
                            {step.durationMs && (
                              <Text style={{ color: '#8b949e', fontSize: 12 }}>{step.durationMs}ms</Text>
                            )}
                          </Space>
                          {step.output && (
                            <pre style={{
                              background: '#0d1117',
                              border: '1px solid #30363d',
                              borderRadius: 4,
                              padding: 8,
                              marginTop: 4,
                              fontSize: 11,
                              color: '#8b949e',
                              maxHeight: 150,
                              overflow: 'auto',
                            }}>
                              {typeof step.output === 'string' ? step.output : JSON.stringify(step.output, null, 2)}
                            </pre>
                          )}
                          {step.error && (
                            <Text style={{ color: '#ff4d4f', fontSize: 12, display: 'block', marginTop: 4 }}>
                              Error: {step.error}
                            </Text>
                          )}
                        </div>
                      ),
                    }))}
                  />
                ),
              }]}
            />
          ))}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
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
            background: project.status === 'completed' ? '#52c41a22' : '#1677ff22',
            borderRadius: 10,
            padding: '10px 12px',
            fontSize: 24,
            color: project.status === 'completed' ? '#52c41a' : '#1677ff',
          }}
        >
          {project.status === 'completed' ? <CheckCircleOutlined /> : <RocketOutlined />}
        </div>
        <div>
          <Space>
            <Title level={3} style={{ color: '#e6edf3', margin: 0 }}>
              {project.name}
            </Title>
            <Tag color={STATUS_COLORS[project.status] || '#8b949e'} style={{ fontSize: 13, marginLeft: 8 }}>
              {project.status}
            </Tag>
          </Space>
          <Text style={{ color: '#8b949e', display: 'block' }}>{project.description}</Text>
          {project.goal && (
            <Text style={{ color: '#8b949e', display: 'block', marginTop: 4 }}>
              <ThunderboltOutlined style={{ marginRight: 6 }} />
              {project.goal}
            </Text>
          )}
        </div>
      </Space>

      {pendingApprovals.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message={`${pendingApprovals.length} approval(s) pending`}
          description={
            <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 8 }}>
              {pendingApprovals.map((a) => (
                <Card
                  key={a.approvalId}
                  size="small"
                  style={{ background: '#161b22', border: '1px solid #faad1430', borderRadius: 8 }}
                >
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    <Text style={{ color: '#faad14', fontSize: 12 }}>
                      {a.approvalType} — needs human sign-off
                    </Text>
                    <Text style={{ color: '#8b949e', fontSize: 11, fontFamily: 'monospace' }}>
                      {JSON.stringify(a.requestData).slice(0, 120)}
                    </Text>
                    <Space>
                      <Button
                        size="small"
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        onClick={() => handleApprove(a.approvalId)}
                        style={{ background: '#52c41a', borderColor: '#52c41a' }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="small"
                        danger
                        icon={<CloseCircleOutlined />}
                        onClick={() => handleReject(a.approvalId)}
                      >
                        Reject
                      </Button>
                    </Space>
                  </Space>
                </Card>
              ))}
            </Space>
          }
          style={{ background: '#161b22', border: '1px solid #faad1430', marginBottom: 16 }}
        />
      )}

      <Tabs
        items={tabItems}
        defaultActiveKey={project.status === 'completed' ? 'output' : 'kanban'}
        style={{ color: '#e6edf3' }}
      />

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
