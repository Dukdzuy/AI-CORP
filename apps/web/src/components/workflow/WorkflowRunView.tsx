import React, { useMemo, useState } from 'react';
import { Breadcrumb, Button, Empty, List, Popconfirm, Skeleton, Space, Tag, Tooltip, Typography, message } from 'antd';
import { ApartmentOutlined, CaretDownOutlined, CaretRightOutlined, HistoryOutlined, PauseCircleOutlined, PlayCircleOutlined, RollbackOutlined } from '@ant-design/icons';
import { usePauseRun, useResumeRun, useRollbackRun, useRunSnapshots, useWorkflowRun } from '../../lib/api/hooks/workflows';
import { usePendingApprovals } from '../../lib/api/hooks/approvals';
import { apiErrorMessage } from '../../lib/api/errors';
import { Permission } from '@ai-corp/shared-types';
import { usePermission } from '../../lib/permissions';
import { ganttLayout, overlappingKeys, pathTo, timelineRows, WorkflowRunTree } from './runTree';

const { Text } = Typography;

const INK = { primary: '#e6edf3', secondary: '#8b949e', muted: '#484f58', grid: '#21262d' };
const STATUS_COLORS: Record<string, string> = {
  completed: '#52c41a',
  failed: '#ff4d4f',
  running: '#1677ff',
  paused: '#faad14',
  pending: '#faad14',
  cancelled: '#8b949e',
};
const box: React.CSSProperties = { background: '#0d1117', border: '1px solid #30363d', borderRadius: 8, padding: 12 };

const fmtDuration = (ms: number) => (ms < 1000 ? `${ms} ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms / 60000)} min`);

/** Execution timeline: one bar per step, sub-workflow runs nested and collapsible (Tasks 16, 18) */
const RunTimeline: React.FC<{ tree: WorkflowRunTree; onOpenRun: (runId: string) => void }> = ({ tree, onOpenRun }) => {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const rows = useMemo(() => ganttLayout(timelineRows(tree, collapsed)), [tree, collapsed]);
  const parallel = useMemo(() => overlappingKeys(rows), [rows]);

  if (rows.length === 0) {
    return <Empty description={<Text style={{ color: INK.secondary }}>No steps recorded yet.</Text>} />;
  }
  const toggle = (key: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div style={box} role="table" aria-label="Execution timeline">
      {rows.map(row => (
        <div key={row.key} role="row" style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 26 }}>
          <div role="cell" style={{ width: 260, flexShrink: 0, paddingLeft: row.depth * 18, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
            {row.kind === 'sub_workflow' ? (
              <Button
                type="text"
                size="small"
                aria-label={collapsed.has(row.key) ? `Expand ${row.label}` : `Collapse ${row.label}`}
                icon={collapsed.has(row.key) ? <CaretRightOutlined /> : <CaretDownOutlined />}
                onClick={() => toggle(row.key)}
                style={{ color: INK.secondary, width: 20, minWidth: 20, padding: 0 }}
              />
            ) : (
              <span style={{ width: 20 }} />
            )}
            {row.kind === 'sub_workflow' && <ApartmentOutlined style={{ color: '#b37feb' }} />}
            <Text style={{ color: INK.primary, fontSize: 12, whiteSpace: 'nowrap' }} ellipsis>{row.label}</Text>
            {row.agentRole && <Tag style={{ fontSize: 10, lineHeight: '16px', marginInlineEnd: 0 }}>{row.agentRole}</Tag>}
            {row.kind === 'sub_workflow' && row.runId && (
              <Button type="link" size="small" style={{ padding: 0, fontSize: 11 }} onClick={() => onOpenRun(row.runId!)}>
                open
              </Button>
            )}
          </div>
          <div role="cell" style={{ position: 'relative', flex: 1, height: 14, background: INK.grid, borderRadius: 3 }}>
            <Tooltip title={`${row.label}: ${row.status}, ${fmtDuration(row.end - row.start)}${parallel.has(row.key) ? ' (ran in parallel)' : ''}`}>
              <div
                style={{
                  position: 'absolute',
                  left: `${row.left}%`,
                  width: `${row.width}%`,
                  top: 0,
                  bottom: 0,
                  borderRadius: 3,
                  background: row.kind === 'sub_workflow' ? '#b37feb55' : STATUS_COLORS[row.status] || INK.secondary,
                  border: row.kind === 'sub_workflow' ? '1px solid #b37feb' : 'none',
                  outline: parallel.has(row.key) ? '1px dashed #e6edf3' : 'none',
                }}
              />
            </Tooltip>
          </div>
          <Text role="cell" style={{ width: 64, textAlign: 'right', color: INK.secondary, fontSize: 11 }}>{fmtDuration(row.end - row.start)}</Text>
        </div>
      ))}
      <Text style={{ color: INK.muted, fontSize: 11, display: 'block', marginTop: 8 }}>
        Purple bars are sub-workflows; a dashed outline marks steps that ran in parallel.
      </Text>
    </div>
  );
};

/** Snapshots taken before each node, with rollback (Task 17) */
const SnapshotPanel: React.FC<{ runId: string; projectId: string; status: string }> = ({ runId, projectId, status }) => {
  // Phase 5: controlling a run needs workflow:control (and owning the project, checked by the API)
  const canControl = usePermission(Permission.WORKFLOW_CONTROL);
  const { data: snapshots = [], isLoading } = useRunSnapshots(runId);
  const rollback = useRollbackRun();
  const resume = useResumeRun();
  const pause = usePauseRun();
  const canRollback = canControl && (status === 'paused' || status === 'failed');
  // A run paused at an approval continues when the approval is answered; Resume would ask again
  const { data: approvals = [] } = usePendingApprovals(projectId);
  const awaitingApproval = approvals.some(a => a.workflowRunId === runId);

  const doRollback = async (snapshotId: string) => {
    try {
      const result = await rollback.mutateAsync({ runId, projectId, body: { snapshotId } });
      message.success(result.message);
    } catch (error: any) {
      message.error(apiErrorMessage(error, 'Rollback failed'));
    }
  };
  const doResume = async () => {
    try {
      await resume.mutateAsync({ runId, projectId });
      message.success('Workflow resumed');
    } catch (error: any) {
      message.error(apiErrorMessage(error, 'Resume failed'));
    }
  };
  const doPause = async () => {
    try {
      await pause.mutateAsync({ runId, projectId });
      message.success('Workflow paused');
    } catch (error) {
      message.error(apiErrorMessage(error, 'Pause failed'));
    }
  };

  return (
    <div style={box}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
        <Space>
          <HistoryOutlined style={{ color: INK.secondary }} />
          <Text style={{ color: INK.primary }}>Snapshots</Text>
          <Text style={{ color: INK.secondary, fontSize: 12 }}>
            {canRollback ? 'roll back to the state before a node ran' : 'rollback is available when the run is paused or failed'}
          </Text>
        </Space>
        {canControl && status === 'running' && (
          <Button size="small" icon={<PauseCircleOutlined />} loading={pause.isPending} onClick={doPause}>
            Pause
          </Button>
        )}
        {canControl && status === 'paused' && (awaitingApproval ? (
          <Tooltip title="This run waits for an approval: approve or reject it to continue">
            <Button size="small" icon={<PlayCircleOutlined />} disabled>Resume</Button>
          </Tooltip>
        ) : (
          <Button size="small" icon={<PlayCircleOutlined />} loading={resume.isPending} onClick={doResume}>
            Resume
          </Button>
        ))}
      </Space>
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 2 }} />
      ) : snapshots.length === 0 ? (
        <Text style={{ color: INK.secondary, fontSize: 12 }}>No snapshots yet.</Text>
      ) : (
        <List
          size="small"
          dataSource={[...snapshots].reverse()}
          renderItem={snapshot => (
            <List.Item
              style={{ borderBlockEnd: '1px solid #21262d', padding: '4px 0' }}
              actions={[
                <Popconfirm
                  key="rollback"
                  title={`Roll back to before "${snapshot.nodeId}"?`}
                  description="The run is paused there with the variables it had then. Later snapshots are discarded."
                  onConfirm={() => doRollback(snapshot.id)}
                  disabled={!canRollback}
                >
                  <Button size="small" type="text" icon={<RollbackOutlined />} disabled={!canRollback} loading={rollback.isPending}>
                    Roll back
                  </Button>
                </Popconfirm>,
              ]}
            >
              <Space>
                <Text style={{ color: INK.secondary, fontSize: 12, width: 28, display: 'inline-block' }}>#{snapshot.sequence}</Text>
                <Tag>{snapshot.nodeId}</Tag>
                <Text style={{ color: INK.secondary, fontSize: 12 }}>{new Date(snapshot.createdAt).toLocaleTimeString()}</Text>
              </Space>
            </List.Item>
          )}
        />
      )}
    </div>
  );
};

/**
 * A workflow run: version, breadcrumb through the sub-workflow hierarchy, execution timeline and
 * snapshots (Phase 4). Opening a sub-workflow run drills into it; the breadcrumb goes back up.
 */
export const WorkflowRunView: React.FC<{ runId: string; projectId: string }> = ({ runId, projectId }) => {
  const { data: tree, isLoading } = useWorkflowRun(runId, true);
  const [focusId, setFocusId] = useState<string | null>(null);

  if (isLoading || !tree) return <Skeleton active paragraph={{ rows: 4 }} />;

  const path = focusId ? pathTo(tree, focusId) : [tree];
  const focus = path[path.length - 1] || tree;

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space wrap>
        <Breadcrumb
          items={path.map((node, i) => ({
            title: i === path.length - 1 ? (
              <Text style={{ color: INK.primary }}>{node.definition?.name || node.run.workflowDefId}</Text>
            ) : (
              <a onClick={() => setFocusId(i === 0 ? null : node.run.id)}>{node.definition?.name || node.run.workflowDefId}</a>
            ),
          }))}
        />
        <Tag color="purple">{focus.run.workflowDefId}@{focus.run.workflowDefVersion || 'latest'}</Tag>
        <Tag color={STATUS_COLORS[focus.run.status]}>{focus.run.status}</Tag>
        {focus.run.currentNodeId && focus.run.status !== 'completed' && (
          <Text style={{ color: INK.secondary, fontSize: 12 }}>at {focus.run.currentNodeId}</Text>
        )}
      </Space>
      <RunTimeline tree={focus} onOpenRun={setFocusId} />
      {!focus.run.parentRunId && <SnapshotPanel runId={focus.run.id} projectId={projectId} status={focus.run.status} />}
    </Space>
  );
};
