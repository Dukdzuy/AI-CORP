import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Space, Card, Button, Spin, Skeleton, Tabs, Empty, Tag, Collapse, Alert, InputNumber, Modal, Popconfirm, message } from 'antd';
import { ArrowLeftOutlined, RocketOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, ThunderboltOutlined, FileTextOutlined, ExclamationCircleOutlined, FolderOpenOutlined, CodeOutlined, PauseCircleOutlined, PlayCircleOutlined, StopOutlined, DollarOutlined } from '@ant-design/icons';
import { Permission, Task, WebSocketEventType, TaskUpdatedEvent, ApprovalRequiredEvent, ProjectStatus } from '@ai-corp/shared-types';
import { projectKeys, useProject, useStartProjectWorkflow, useUpdateProject } from '../lib/api/hooks/projects';
import { apiErrorMessage } from '../lib/api/errors';
import { approvalSummary } from '../lib/approvalSummary';
import { hasPermission } from '../lib/permissions';
import { useAuthStore } from '../stores/authStore';
import { ApprovalModal } from '../components/approvals/ApprovalModal';
import type { PendingApproval } from '../components/approvals/ApprovalNotification';
import { useTasks, taskKeys } from '../lib/api/hooks/tasks';
import { useMilestones } from '../lib/api/hooks/milestones';
import { usePendingApprovals, approvalKeys, respondToApproval, approvalErrorMessage, toPendingApproval } from '../lib/api/hooks/approvals';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { TaskDetailModal } from '../components/kanban/TaskDetailModal';
import socketClient from '../lib/websocket/socket-client';
import { useQueryClient } from '@tanstack/react-query';
import { ArtifactsTab } from '../components/artifacts/ArtifactsTab';
import { useQualityEvents } from '../components/artifacts/useQualityEvents';
import { WorkflowRunView } from '../components/workflow/WorkflowRunView';
import { ReportsTab } from '../components/reports/ReportsTab';

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
  const [wsApprovals, setWsApprovals] = useState<ApprovalRequiredEvent[]>([]);
  const queryClient = useQueryClient();
  const { gates: liveGates, warnings: liveWarnings } = useQualityEvents(id);

  // Merge REST API approvals + WebSocket approvals, dedupe by approvalId
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const pendingApprovals: PendingApproval[] = [...apiApprovals.map(toPendingApproval), ...wsApprovals].filter((a, i, arr) =>
    arr.findIndex((b) => b.approvalId === a.approvalId) === i && !answered.has(a.approvalId)
  );
  const [reviewing, setReviewing] = useState<PendingApproval | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [newBudget, setNewBudget] = useState<number | null>(null);
  const updateProject = useUpdateProject();
  const startWorkflow = useStartProjectWorkflow();
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    if (!id) return;

    // Joins the project's room (again after a reconnect) so its live events reach this page
    socketClient.subscribeProject(id);

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

    // A run moved (node done, paused, finished): refresh the project, its runs and approvals
    const unsubWorkflow = socketClient.on<{ projectId?: string }>(
      WebSocketEventType.WORKFLOW_STATE_CHANGED,
      (data) => {
        if (data?.projectId === id) {
          queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
          queryClient.invalidateQueries({ queryKey: approvalKeys.pending(id) });
        }
      }
    );

    // Budget warnings and other project notices
    const unsubNotice = socketClient.on<{ message?: string; level?: string; severity?: string }>(
      WebSocketEventType.SYSTEM_NOTIFICATION,
      (data) => {
        if (!data?.message) return;
        const level = data.level || data.severity;
        if (level === 'critical' || level === 'error') message.error(data.message, 8);
        else message.warning(data.message, 6);
        queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      }
    );

    return () => {
      unsubTaskUpdated();
      unsubApproval();
      unsubWorkflow();
      unsubNotice();
      socketClient.unsubscribeProject(id);
    };
  }, [id, queryClient]);

  const respond = useCallback(async (approvalId: string, decision: 'approve' | 'reject', comment?: string) => {
    setSubmitting(true);
    try {
      await respondToApproval(approvalId, decision, comment);
      setWsApprovals((prev) => prev.filter((a) => a.approvalId !== approvalId));
      setAnswered((prev) => new Set(prev).add(approvalId));
      setReviewing(null);
      message.success(decision === 'approve' ? 'Approved, the workflow continues' : 'Rejected, the agents rework it with your feedback');
    } catch (error) {
      message.error(approvalErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
    queryClient.invalidateQueries({ queryKey: approvalKeys.all });
    if (id) queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
  }, [id, queryClient]);
  const handleApprove = useCallback((approvalId: string, comment?: string) => respond(approvalId, 'approve', comment), [respond]);
  const handleReject = useCallback((approvalId: string, comment?: string) => respond(approvalId, 'reject', comment), [respond]);

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
  const latestRun = workflowRuns[0];
  // Same rule as the API: the owner of the project or an admin may control it
  const canControl = hasPermission(user, Permission.WORKFLOW_CONTROL)
    && (user?.role === 'admin' || (project as any).createdById === user?.id);
  const canEdit = hasPermission(user, Permission.PROJECT_UPDATE)
    && (user?.role === 'admin' || (project as any).createdById === user?.id);
  const budget = project.budget != null ? Number(project.budget) : null;
  const cost = Number(project.costAccrued ?? 0);
  const overBudget = budget !== null && cost >= budget;
  const workflowStopped = !latestRun || latestRun.status === 'failed' || latestRun.status === 'cancelled';

  const changeStatus = async (status: ProjectStatus, done: string) => {
    try {
      await updateProject.mutateAsync({ id: project.id, status });
      message.success(done);
    } catch (error) {
      message.error(apiErrorMessage(error, 'Could not change the project status'));
    }
  };
  const doStartWorkflow = async () => {
    try {
      const result = await startWorkflow.mutateAsync(project.id);
      if (result.workflowStarted) message.success('Workflow started');
      else message.error(`The workflow did not start: ${result.workflowError || 'unknown error'}`);
    } catch (error) {
      message.error(apiErrorMessage(error, 'Could not start the workflow'));
    }
  };
  const raiseBudget = async () => {
    if (newBudget === null) return;
    try {
      // Raising the budget of a project the budget paused also resumes it
      await updateProject.mutateAsync({
        id: project.id,
        budget: newBudget,
        ...(project.status === ProjectStatus.PAUSED && newBudget > cost ? { status: ProjectStatus.ACTIVE } : {}),
      } as any);
      message.success('Budget updated');
      setBudgetOpen(false);
    } catch (error) {
      message.error(apiErrorMessage(error, 'Could not update the budget'));
    }
  };
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

              {/* Output from agents */}
              {latestContext.output && (
                <Card size="small" style={{ background: '#161b22', border: '1px solid #30363d' }}>
                  <Text strong style={{ color: '#e6edf3' }}>Agent Output</Text>
                  <Paragraph style={{ color: '#8b949e', margin: '4px 0 0', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12, maxHeight: 300, overflow: 'auto' }}>
                    {typeof latestContext.output === 'string' ? latestContext.output : JSON.stringify(latestContext.output, null, 2)}
                  </Paragraph>
                </Card>
              )}

              {/* Files written */}
              {latestContext.filesWritten && Array.isArray(latestContext.filesWritten) && latestContext.filesWritten.length > 0 && (
                <Card
                  size="small"
                  style={{ background: '#161b22', border: '1px solid #30363d' }}
                  title={
                    <Space>
                      <FolderOpenOutlined style={{ color: '#52c41a' }} />
                      <Text style={{ color: '#e6edf3' }}>Files Written ({latestContext.filesWritten.length})</Text>
                    </Space>
                  }
                >
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    {latestContext.filesWritten.map((filePath: string, idx: number) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0d1117', border: '1px solid #21262d', borderRadius: 6, padding: '6px 10px' }}>
                        <Space size={8}>
                          <FileTextOutlined style={{ color: '#1677ff' }} />
                          <Text style={{ color: '#c9d1d9', fontSize: 12, fontFamily: 'monospace' }}>{filePath}</Text>
                        </Space>
                        <Button
                          size="small"
                          type="text"
                          icon={<CodeOutlined />}
                          onClick={() => setActiveTab('artifacts')}
                          style={{ color: '#1677ff', fontSize: 11 }}
                        >
                          Open in Artifacts
                        </Button>
                      </div>
                    ))}
                  </Space>
                </Card>
              )}

              {/* Code content */}
              {latestContext.code && (
                <Card
                  size="small"
                  style={{ background: '#161b22', border: '1px solid #30363d' }}
                  title={
                    <Space>
                      <CodeOutlined style={{ color: '#fa8c16' }} />
                      <Text style={{ color: '#e6edf3' }}>Source Code</Text>
                      <Button
                        size="small"
                        type="text"
                        icon={<FolderOpenOutlined />}
                        onClick={() => {
                          const codeStr = typeof latestContext.code === 'string' ? latestContext.code : JSON.stringify(latestContext.code, null, 2);
                          const blob = new Blob([codeStr], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          // The block holds the code of every file together, so it is not named after one of them
                          a.download = `${project.name.replace(/[^\w-]+/g, '-')}-code.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        style={{ color: '#8b949e', fontSize: 11 }}
                      >
                        Download
                      </Button>
                    </Space>
                  }
                >
                  <pre style={{
                    background: '#0d1117',
                    border: '1px solid #30363d',
                    borderRadius: 6,
                    padding: 12,
                    fontSize: 12,
                    color: '#c9d1d9',
                    overflow: 'auto',
                    maxHeight: 400,
                    margin: 0,
                  }}>
                    {typeof latestContext.code === 'string' ? latestContext.code : JSON.stringify(latestContext.code, null, 2)}
                  </pre>
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
      key: 'artifacts',
      label: 'Artifacts',
      children: <ArtifactsTab projectId={project.id} projectName={project.name} liveGates={liveGates} liveWarnings={liveWarnings} />,
    },
    {
      key: 'reports',
      label: 'Reports',
      children: <ReportsTab projectId={project.id} />,
    },
    {
      key: 'kanban',
      label: 'Kanban Board',
      children: tasksLoading ? (
        <Spin />
      ) : (
        <KanbanBoard
          tasks={tasks}
          onTaskClick={handleTaskClick}
          lockedReason={latestRun?.status === 'running' ? 'The agents are working on these tasks: pause the workflow to move tasks by hand.' : undefined}
        />
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
              destroyInactivePanel
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
                    <Tag color="purple">{run.workflowDefId}@{run.workflowDefVersion || 'latest'}</Tag>
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
                children: <WorkflowRunView runId={run.id} projectId={project.id} />,
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
            {latestRun && latestRun.status !== project.status && (
              <Tag color={STATUS_COLORS[latestRun.status] || '#8b949e'}>workflow {latestRun.status}</Tag>
            )}
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

      {(canControl || canEdit) && (
        <Space wrap style={{ marginBottom: 16 }}>
          {canEdit && project.status === ProjectStatus.ACTIVE && (
            <Button icon={<PauseCircleOutlined />} loading={updateProject.isPending} onClick={() => changeStatus(ProjectStatus.PAUSED, 'Project and workflow paused')}>
              Pause
            </Button>
          )}
          {canEdit && project.status === ProjectStatus.PAUSED && (
            <Button icon={<PlayCircleOutlined />} loading={updateProject.isPending} disabled={overBudget} onClick={() => changeStatus(ProjectStatus.ACTIVE, 'Project and workflow resumed')}>
              Resume
            </Button>
          )}
          {canControl && project.status === ProjectStatus.ACTIVE && workflowStopped && (
            <Button type="primary" icon={<RocketOutlined />} loading={startWorkflow.isPending} onClick={doStartWorkflow}>
              {latestRun ? 'Run workflow again' : 'Start workflow'}
            </Button>
          )}
          {canEdit && (project.status === ProjectStatus.ACTIVE || project.status === ProjectStatus.PAUSED) && (
            <Button icon={<DollarOutlined />} onClick={() => { setNewBudget(budget); setBudgetOpen(true); }}>
              {budget === null ? 'Set budget' : 'Change budget'}
            </Button>
          )}
          {canEdit && (project.status === ProjectStatus.ACTIVE || project.status === ProjectStatus.PAUSED) && (
            <Popconfirm
              title="Cancel this project?"
              description="The workflow stops and pending approvals are cancelled. This cannot be undone."
              okText="Cancel project"
              okButtonProps={{ danger: true }}
              cancelText="Keep it"
              onConfirm={() => changeStatus(ProjectStatus.CANCELLED, 'Project cancelled')}
            >
              <Button danger icon={<StopOutlined />}>Cancel project</Button>
            </Popconfirm>
          )}
        </Space>
      )}

      {overBudget && project.status !== ProjectStatus.COMPLETED && project.status !== ProjectStatus.CANCELLED && (
        <Alert
          type="error"
          showIcon
          message={`Budget used up: $${cost.toFixed(2)} of $${budget!.toFixed(2)}`}
          description="The workflow is paused and will not start another step until the budget is raised."
          action={canEdit ? <Button size="small" onClick={() => { setNewBudget(Math.ceil(cost * 1.5)); setBudgetOpen(true); }}>Raise budget</Button> : undefined}
          style={{ background: '#161b22', border: '1px solid #ff4d4f55', marginBottom: 16 }}
        />
      )}

      {project.status === ProjectStatus.ACTIVE && !latestRun && (
        <Alert
          type="warning"
          showIcon
          message="The workflow of this project has not started"
          description={canControl ? 'Start it with the button above.' : 'Ask the project owner to start it.'}
          style={{ background: '#161b22', border: '1px solid #faad1430', marginBottom: 16 }}
        />
      )}

      <Modal
        title="Project budget"
        open={budgetOpen}
        onCancel={() => setBudgetOpen(false)}
        onOk={raiseBudget}
        okText="Save"
        confirmLoading={updateProject.isPending}
      >
        <Text style={{ color: '#8b949e', display: 'block', marginBottom: 8 }}>
          Spent so far: ${cost.toFixed(2)}{project.status === ProjectStatus.PAUSED ? '. A budget above that resumes the workflow.' : ''}
        </Text>
        <InputNumber prefix="$" min={1} precision={2} value={newBudget ?? undefined} onChange={v => setNewBudget(typeof v === 'number' ? v : null)} style={{ width: '100%' }} />
      </Modal>

      <ApprovalModal
        approval={reviewing}
        open={!!reviewing}
        submitting={submitting}
        onClose={() => setReviewing(null)}
        onApprove={handleApprove}
        onReject={handleReject}
      />

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
                    <Text style={{ color: '#c9d1d9', fontSize: 13 }}>
                      {approvalSummary(a.requestData).message}
                    </Text>
                    <Button size="small" type="primary" icon={<FileTextOutlined />} onClick={() => setReviewing(a)}>
                      Review and decide
                    </Button>
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
        activeKey={activeTab ?? (project.status === 'completed' ? 'output' : latestRun ? 'workflow' : 'kanban')}
        onChange={setActiveTab}
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
