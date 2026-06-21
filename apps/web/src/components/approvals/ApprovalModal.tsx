import React from 'react';
import { Modal, Typography, Space, Tag, Button, Input, Descriptions } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { PendingApproval } from './ApprovalNotification';

const { Text } = Typography;
const { TextArea } = Input;

const APPROVAL_TYPE_LABELS: Record<string, { color: string; label: string }> = {
  code_merge: { color: 'blue', label: 'Code Merge' },
  marketing_post: { color: 'purple', label: 'Marketing Post' },
  milestone_complete: { color: 'green', label: 'Milestone Complete' },
  general: { color: 'orange', label: 'General Approval' },
};

interface ApprovalModalProps {
  approval: PendingApproval | null;
  open: boolean;
  onClose: () => void;
  onApprove: (approvalId: string) => void;
  onReject: (approvalId: string, comment?: string) => void;
}

export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  approval,
  open,
  onClose,
  onApprove,
  onReject,
}) => {
  const [comment, setComment] = React.useState('');

  if (!approval) return null;

  const typeCfg = APPROVAL_TYPE_LABELS[approval.approvalType] ?? { color: 'default', label: approval.approvalType };

  const handleApprove = () => {
    onApprove(approval.approvalId);
    setComment('');
  };

  const handleReject = () => {
    onReject(approval.approvalId, comment || undefined);
    setComment('');
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
      footer={
        <Space>
          <Button
            icon={<CloseCircleOutlined />}
            onClick={handleReject}
            danger
          >
            Reject
          </Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={handleApprove}
            style={{ background: '#52c41a', borderColor: '#52c41a' }}
          >
            Approve
          </Button>
        </Space>
      }
      width={520}
      styles={{
        content: { background: '#161b22', border: '1px solid #30363d' },
        header: { background: '#161b22', borderBottom: '1px solid #30363d' },
      }}
    >
      <Descriptions
        column={1}
        labelStyle={{ color: '#8b949e', padding: '6px 0' }}
        contentStyle={{ color: '#e6edf3', padding: '6px 0' }}
        style={{ marginTop: 16 }}
      >
        <Descriptions.Item label="Type">
          <Tag color={typeCfg.color}>{typeCfg.label}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Approval ID">
          <Text style={{ color: '#8b949e', fontSize: 12, fontFamily: 'monospace' }}>
            {approval.approvalId.slice(0, 12)}...
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="Requested At">
          {approval.requestedAt.toLocaleString()}
        </Descriptions.Item>
      </Descriptions>

      {/* Request Data */}
      <div style={{ marginTop: 12 }}>
        <Text style={{ color: '#8b949e', fontSize: 12, display: 'block', marginBottom: 4 }}>
          Request Details
        </Text>
        <div
          style={{
            background: '#0d1117',
            border: '1px solid #30363d',
            borderRadius: 6,
            padding: '10px 12px',
            maxHeight: 200,
            overflowY: 'auto',
          }}
        >
          <pre style={{ color: '#c9d1d9', fontSize: 12, margin: 0, whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(approval.requestData, null, 2)}
          </pre>
        </div>
      </div>

      {/* Comment */}
      <div style={{ marginTop: 16 }}>
        <Text style={{ color: '#8b949e', fontSize: 12, display: 'block', marginBottom: 4 }}>
          Comment (optional)
        </Text>
        <TextArea
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment for your decision..."
          style={{ background: '#0d1117', borderColor: '#30363d' }}
        />
      </div>
    </Modal>
  );
};
