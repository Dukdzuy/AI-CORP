import React, { useEffect, useState, useCallback } from 'react';
import { Badge, Dropdown, Typography, Space, Button, Tag, Empty, Avatar, message } from 'antd';
import {
  ExclamationCircleOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { WebSocketEventType, ApprovalRequiredEvent } from '@ai-corp/shared-types';
import socketClient from '../../lib/websocket/socket-client';
import { useQueryClient } from '@tanstack/react-query';
import { respondToApproval, approvalErrorMessage, approvalKeys, toPendingApproval, usePendingApprovals } from '../../lib/api/hooks/approvals';
import { ApprovalModal } from './ApprovalModal';
import { approvalSummary } from '../../lib/approvalSummary';

const { Text } = Typography;

export interface PendingApproval {
  approvalId: string;
  workflowRunId: string;
  projectId: string;
  projectName?: string;
  approvalType: string;
  requestData: Record<string, unknown>;
  requestedAt: Date;
}

const APPROVAL_TYPE_LABELS: Record<string, string> = {
  code_merge: 'Code Merge',
  marketing_post: 'Marketing Post',
  milestone_complete: 'Milestone Complete',
  project_completion: 'Project Completion',
  general: 'General Approval',
};

interface ApprovalNotificationProps {
  userId?: string;
}

/**
 * The bell: every approval waiting for the user (loaded from the API, so it survives a reload,
 * and kept fresh by the approval:required socket event). An admin sees everyone's.
 */
export const ApprovalNotification: React.FC<ApprovalNotificationProps> = () => {
  const queryClient = useQueryClient();
  const { data: records = [] } = usePendingApprovals();
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pendingApprovals: PendingApproval[] = records.map(toPendingApproval).filter(a => !answered.has(a.approvalId));

  useEffect(() => {
    const unsub = socketClient.on<ApprovalRequiredEvent>(
      WebSocketEventType.HUMAN_APPROVAL_REQUIRED,
      () => queryClient.invalidateQueries({ queryKey: approvalKeys.all })
    );

    return () => {
      unsub();
    };
  }, [queryClient]);

  const respond = useCallback(async (approvalId: string, decision: 'approve' | 'reject', comment?: string) => {
    setSubmitting(true);
    try {
      await respondToApproval(approvalId, decision, comment);
      setAnswered((prev) => new Set(prev).add(approvalId));
      setModalOpen(false);
      setSelectedApproval(null);
      message.success(decision === 'approve' ? 'Approved, the workflow continues' : 'Rejected, the agents rework it');
    } catch (error) {
      message.error(approvalErrorMessage(error));
    } finally {
      setSubmitting(false);
      queryClient.invalidateQueries({ queryKey: approvalKeys.all });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  }, [queryClient]);
  const handleApprove = useCallback((approvalId: string, comment?: string) => respond(approvalId, 'approve', comment), [respond]);
  const handleReject = useCallback((approvalId: string, comment?: string) => respond(approvalId, 'reject', comment), [respond]);

  const handleOpenApproval = (approval: PendingApproval) => {
    setSelectedApproval(approval);
    setModalOpen(true);
  };

  const dropdownContent = (
    <div
      style={{
        width: 340,
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #30363d' }}>
        <Text style={{ color: '#e6edf3', fontWeight: 600, fontSize: 13 }}>
          Pending Approvals ({pendingApprovals.length})
        </Text>
      </div>

      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {pendingApprovals.length === 0 ? (
          <div style={{ padding: '24px 16px' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<Text style={{ color: '#8b949e' }}>No pending approvals</Text>}
            />
          </div>
        ) : (
          pendingApprovals.map((approval) => (
            <div
              key={approval.approvalId}
              onClick={() => handleOpenApproval(approval)}
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid #21262d',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#1c2128')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Space align="start" size={10}>
                <Avatar
                  size={28}
                  icon={<ExclamationCircleOutlined />}
                  style={{ background: '#faad14', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Space size={6}>
                    <Tag color="warning" style={{ margin: 0, fontSize: 10 }}>
                      {APPROVAL_TYPE_LABELS[approval.approvalType] ?? approval.approvalType}
                    </Tag>
                    <Text style={{ color: '#484f58', fontSize: 10 }}>
                      {approval.requestedAt.toLocaleTimeString()}
                    </Text>
                  </Space>
                  <div>
                    <Text
                      ellipsis
                      style={{ color: '#c9d1d9', fontSize: 12, display: 'block', marginTop: 2 }}
                    >
                      {approval.projectName ? `${approval.projectName}: ` : ''}{approvalSummary(approval.requestData).message}
                    </Text>
                  </div>
                </div>
              </Space>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      <Dropdown
        dropdownRender={() => dropdownContent}
        trigger={['click']}
        placement="bottomRight"
      >
        <Badge count={pendingApprovals.length} size="small" offset={[-2, 2]}>
          <Button
            type="text"
            icon={<BellOutlined />}
            style={{ color: pendingApprovals.length > 0 ? '#faad14' : '#8b949e' }}
          />
        </Badge>
      </Dropdown>

      <ApprovalModal
        approval={selectedApproval}
        open={modalOpen}
        submitting={submitting}
        onClose={() => {
          setModalOpen(false);
          setSelectedApproval(null);
        }}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </>
  );
};
