import React from 'react';
import { Modal, Typography, Space, Tag, Button, Input, Descriptions, Collapse } from 'antd';
import { Permission } from '@ai-corp/shared-types';
import { usePermission } from '../../lib/permissions';
import { approvalSummary } from '../../lib/approvalSummary';
import { CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { PendingApproval } from './ApprovalNotification';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const APPROVAL_TYPE_LABELS: Record<string, { color: string; label: string }> = {
  code_merge: { color: 'blue', label: 'Code Merge' },
  marketing_post: { color: 'purple', label: 'Marketing Post' },
  milestone_complete: { color: 'green', label: 'Milestone Complete' },
  project_completion: { color: 'green', label: 'Project Completion' },
  general: { color: 'orange', label: 'General Approval' },
};

interface ApprovalModalProps {
  approval: PendingApproval | null;
  open: boolean;
  /** An answer is being sent: both buttons wait, so a double click sends one answer */
  submitting?: boolean;
  onClose: () => void;
  onApprove: (approvalId: string, comment?: string) => void;
  onReject: (approvalId: string, comment?: string) => void;
}

/**
 * An approval with what it is about: the node's message, the QA / QC verdicts, the files written
 * and the latest agent output. Rejecting asks for a reason, which the agents that rework get.
 */
export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  approval,
  open,
  submitting = false,
  onClose,
  onApprove,
  onReject,
}) => {
  const canAnswer = usePermission(Permission.APPROVAL_GRANT);
  const [comment, setComment] = React.useState('');
  const [rejecting, setRejecting] = React.useState(false);

  React.useEffect(() => {
    setComment('');
    setRejecting(false);
  }, [approval?.approvalId]);

  if (!approval) return null;

  const typeCfg = APPROVAL_TYPE_LABELS[approval.approvalType] ?? { color: 'default', label: approval.approvalType };
  const summary = approvalSummary(approval.requestData);
  const reason = comment.trim();

  const handleApprove = () => onApprove(approval.approvalId, reason || undefined);
  const handleReject = () => {
    if (!rejecting) {
      setRejecting(true);
      return;
    }
    if (reason) onReject(approval.approvalId, reason);
  };

  return (
    <Modal
      title={
        <Space>
          <ExclamationCircleOutlined style={{ color: '#faad14' }} />
          <Text style={{ color: '#e6edf3' }}>Approval Required</Text>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={!canAnswer ? <Text type="secondary">Your role cannot answer approvals</Text> :
        <Space>
          <Button
            icon={<CloseCircleOutlined />}
            onClick={handleReject}
            danger
            loading={submitting && rejecting}
            disabled={(submitting && !rejecting) || (rejecting && !reason)}
          >
            {rejecting ? 'Send rejection' : 'Reject'}
          </Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={handleApprove}
            loading={submitting && !rejecting}
            disabled={submitting && rejecting}
            style={{ background: '#52c41a', borderColor: '#52c41a' }}
          >
            Approve
          </Button>
        </Space>
      }
      width={600}
      styles={{
        content: { background: '#161b22', border: '1px solid #30363d' },
        header: { background: '#161b22', borderBottom: '1px solid #30363d' },
      }}
    >
      <Paragraph style={{ color: '#e6edf3', marginTop: 12 }}>{summary.message}</Paragraph>

      <Descriptions
        column={1}
        size="small"
        labelStyle={{ color: '#8b949e', padding: '4px 0' }}
        contentStyle={{ color: '#e6edf3', padding: '4px 0' }}
      >
        <Descriptions.Item label="Type">
          <Tag color={typeCfg.color}>{typeCfg.label}</Tag>
        </Descriptions.Item>
        {approval.projectName && <Descriptions.Item label="Project">{approval.projectName}</Descriptions.Item>}
        {summary.facts.map(fact => (
          <Descriptions.Item key={fact.label} label={fact.label}>
            <Text style={{ color: fact.tone === 'good' ? '#52c41a' : fact.tone === 'bad' ? '#ff4d4f' : '#e6edf3' }}>{fact.value}</Text>
          </Descriptions.Item>
        ))}
        <Descriptions.Item label="Requested at">{approval.requestedAt.toLocaleString()}</Descriptions.Item>
      </Descriptions>

      {summary.excerpt && (
        <div style={{ marginTop: 8 }}>
          <Text style={{ color: '#8b949e', fontSize: 12, display: 'block', marginBottom: 4 }}>Latest agent output</Text>
          <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, padding: '10px 12px', maxHeight: 200, overflowY: 'auto' }}>
            <pre style={{ color: '#c9d1d9', fontSize: 12, margin: 0, whiteSpace: 'pre-wrap' }}>{summary.excerpt}</pre>
          </div>
        </div>
      )}

      <Collapse
        ghost
        size="small"
        style={{ marginTop: 8 }}
        items={[{
          key: 'raw',
          label: <Text style={{ color: '#8b949e', fontSize: 12 }}>Raw request data</Text>,
          children: (
            <pre style={{ color: '#8b949e', fontSize: 11, margin: 0, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>
              {JSON.stringify(approval.requestData, null, 2)}
            </pre>
          ),
        }]}
      />

      {canAnswer && (
        <div style={{ marginTop: 12 }}>
          <Text style={{ color: rejecting && !reason ? '#ff4d4f' : '#8b949e', fontSize: 12, display: 'block', marginBottom: 4 }}>
            {rejecting ? 'What should change? (required, the agents rework with it)' : 'Comment (optional)'}
          </Text>
          <TextArea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={rejecting ? 'e.g. Add input validation to the order form and a test for it' : 'Add a comment for your decision...'}
            style={{ background: '#0d1117', borderColor: rejecting && !reason ? '#ff4d4f' : '#30363d' }}
            autoFocus={rejecting}
          />
        </div>
      )}
    </Modal>
  );
};
