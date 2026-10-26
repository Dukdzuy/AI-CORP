import React, { useState } from 'react';
import { Alert, Button, Card, DatePicker, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import { AuditOutlined, DownloadOutlined, WarningOutlined } from '@ant-design/icons';
import { AuditEntryView, AuditFilter, exportAuditCsv, useAnomalies, useAuditLog } from '../lib/api/hooks/audit';
import { describeChanges } from './auditFormat';

const { Title, Text } = Typography;

const ACTOR_COLORS: Record<string, string> = { user: 'blue', api_key: 'purple', agent: 'cyan', system: 'default', anonymous: 'orange' };

/**
 * Audit log (Phase 5, Task 21 — UC-026): who did what, with before/after, filters,
 * CSV export and security anomalies of the last 24 hours. Admin only.
 */
export const AuditLogPage: React.FC = () => {
  const [filter, setFilter] = useState<AuditFilter>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [range, setRange] = useState<any>(null);
  const { data, isLoading } = useAuditLog(filter, page, pageSize);
  const { data: anomalies = [] } = useAnomalies(24);

  const update = (patch: Partial<AuditFilter>) => {
    setPage(1);
    setFilter(f => ({ ...f, ...patch }));
  };

  const columns = [
    { title: 'Time', dataIndex: 'timestamp', key: 'timestamp', width: 170, render: (t: string) => new Date(t).toLocaleString() },
    {
      title: 'Actor',
      key: 'actor',
      width: 230,
      render: (_: unknown, e: AuditEntryView) => (
        <Space size={4}>
          <Tag color={ACTOR_COLORS[e.actor.type]}>{e.actor.type.replace('_', ' ')}</Tag>
          <Text>{e.actor.label || e.actor.agentRole || e.actor.userId || '—'}</Text>
        </Space>
      ),
    },
    { title: 'Action', dataIndex: 'action', key: 'action', width: 190, render: (a: string) => <Text code>{a}</Text> },
    {
      title: 'Resource',
      key: 'resource',
      render: (_: unknown, e: AuditEntryView) => (
        <Space direction="vertical" size={0}>
          <Text>{e.resourceType}</Text>
          {e.resourceId && <Text type="secondary" style={{ fontSize: 11 }}>{e.resourceId}</Text>}
        </Space>
      ),
    },
    {
      title: 'Result',
      key: 'success',
      width: 220,
      render: (_: unknown, e: AuditEntryView) =>
        e.success ? <Tag color="green">ok</Tag> : (
          <Space direction="vertical" size={0}>
            <Tag color="red">failed</Tag>
            {e.errorMessage && <Text type="danger" style={{ fontSize: 11 }}>{e.errorMessage}</Text>}
          </Space>
        ),
    },
    { title: 'IP', dataIndex: 'ipAddress', key: 'ip', width: 120, render: (ip: string | null) => <Text type="secondary">{ip || '—'}</Text> },
  ];

  const exportCsv = async () => {
    try {
      const name = await exportAuditCsv(filter);
      message.success(`Downloaded ${name}`);
    } catch {
      message.error('Export failed');
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Title level={4} style={{ margin: 0 }}><AuditOutlined /> Audit Log</Title>

      {anomalies.map(a => (
        <Alert
          key={`${a.rule}-${a.subject}`}
          type={a.severity === 'critical' ? 'error' : 'warning'}
          showIcon
          icon={<WarningOutlined />}
          message={`Security anomaly: ${a.rule.replace(/_/g, ' ')}`}
          description={`${a.message} (last at ${new Date(a.lastAt).toLocaleTimeString()})`}
        />
      ))}

      <Card size="small">
        <Space wrap>
          <Input.Search placeholder="Search actor, action, resource id" allowClear style={{ width: 280 }} onSearch={search => update({ search })} />
          <Select
            placeholder="Action"
            allowClear
            style={{ width: 200 }}
            onChange={action => update({ action })}
            options={['auth.*', 'access.denied', 'project.*', 'approval.*', 'workflow.*', 'user.*', 'api_key.*', 'webhook.*', 'agent.*', 'report.*'].map(v => ({ value: v, label: v }))}
          />
          <Select
            placeholder="Result"
            allowClear
            style={{ width: 120 }}
            onChange={success => update({ success })}
            options={[{ value: 'true', label: 'ok' }, { value: 'false', label: 'failed' }]}
          />
          <DatePicker.RangePicker
            showTime
            value={range as any}
            onChange={(v: any) => {
              setRange(v);
              update({ from: v?.[0]?.toISOString(), to: v?.[1]?.toISOString() });
            }}
          />
          <Button icon={<DownloadOutlined />} onClick={exportCsv}>Export CSV</Button>
        </Space>
      </Card>

      <Card size="small">
        <Table
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={data?.items ?? []}
          columns={columns}
          expandable={{
            rowExpandable: e => !!e.changes,
            expandedRowRender: e => <ChangesView entry={e} />,
          }}
          pagination={{
            current: page,
            pageSize,
            total: data?.total ?? 0,
            showSizeChanger: true,
            showTotal: total => `${total} entries`,
            onChange: (p, s) => {
              setPage(p);
              setPageSize(s);
            },
          }}
        />
      </Card>
    </Space>
  );
};

const ChangesView: React.FC<{ entry: AuditEntryView }> = ({ entry }) => {
  const view = describeChanges(entry.changes);
  if (view.kind === 'diff') {
    return (
      <Table
        size="small"
        pagination={false}
        rowKey="field"
        dataSource={view.rows}
        columns={[
          { title: 'Field', dataIndex: 'field', key: 'field', width: 180 },
          { title: 'Before', dataIndex: 'from', key: 'from', render: (v: string) => <Text delete type="secondary">{v}</Text> },
          { title: 'After', dataIndex: 'to', key: 'to', render: (v: string) => <Text strong>{v}</Text> },
        ]}
      />
    );
  }
  return <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>{view.text}</pre>;
};
