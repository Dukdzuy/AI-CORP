import React, { useState } from 'react';
import { Button, Card, Col, Empty, Progress, Row, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import { DownloadOutlined, FileExcelOutlined, FilePdfOutlined, FileTextOutlined } from '@ant-design/icons';
import { ExportFormat, Permission } from '@ai-corp/shared-types';
import { CostBucket, RolePerformance, exportProject, useCostReport, usePerformanceReport } from '../../lib/api/hooks/reports';
import { usePermission } from '../../lib/permissions';

const { Text } = Typography;
const usd = (n: number) => `$${n.toFixed(4)}`;
const pct = (n: number | null) => (n === null ? '–' : `${Math.round(n * 100)}%`);

/**
 * Reports tab of a project (Phase 5, Task 23): cost by agent and model, agent
 * performance, and the JSON / CSV / PDF exports.
 */
export const ReportsTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { data: cost, isLoading: costLoading } = useCostReport(projectId);
  const { data: perf, isLoading: perfLoading } = usePerformanceReport(projectId);
  const canExport = usePermission(Permission.PROJECT_EXPORT);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const download = async (format: ExportFormat) => {
    setExporting(format);
    try {
      message.success(`Downloaded ${await exportProject(projectId, format)}`);
    } catch {
      message.error(`Could not export as ${format.toUpperCase()}`);
    } finally {
      setExporting(null);
    }
  };

  const bucketColumns = (label: string) => [
    { title: label, dataIndex: 'key', key: 'key', render: (k: string) => <Text strong>{k}</Text> },
    { title: 'Calls', dataIndex: 'calls', key: 'calls', width: 80, align: 'right' as const },
    { title: 'Tokens', dataIndex: 'tokens', key: 'tokens', width: 100, align: 'right' as const, render: (t: number) => t.toLocaleString() },
    { title: 'Cost', dataIndex: 'cost', key: 'cost', width: 110, align: 'right' as const, render: usd },
    { title: 'Share', dataIndex: 'share', key: 'share', width: 160, render: (s: number, b: CostBucket) => <Progress percent={Math.round(s * 100)} size="small" format={() => pct(s)} status={b.cost ? 'normal' : 'normal'} /> },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card size="small" title="Export" extra={!canExport && <Text type="secondary">Your role can view reports but not export</Text>}>
        <Space wrap>
          <Button icon={<FilePdfOutlined />} disabled={!canExport} loading={exporting === 'pdf'} onClick={() => download('pdf')}>PDF report</Button>
          <Button icon={<FileExcelOutlined />} disabled={!canExport} loading={exporting === 'csv'} onClick={() => download('csv')}>Tasks (CSV)</Button>
          <Button icon={<FileTextOutlined />} disabled={!canExport} loading={exporting === 'json'} onClick={() => download('json')}>Full data (JSON)</Button>
          <Text type="secondary"><DownloadOutlined /> Weekly reports are written to <Text code>reports/</Text> in the Artifacts tab</Text>
        </Space>
      </Card>

      <Row gutter={16}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="LLM cost" value={cost ? usd(cost.total) : '–'} loading={costLoading} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Budget used" value={cost?.budgetUsed !== null && cost ? pct(cost.budgetUsed) : 'no budget'} loading={costLoading} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="LLM calls" value={cost?.calls ?? 0} suffix={cost?.fallbackCalls ? <Tag color="orange">{cost.fallbackCalls} fallback</Tag> : null} loading={costLoading} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Step success" value={perf ? pct(perf.overallSuccessRate) : '–'} loading={perfLoading} /></Card></Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card size="small" title="Cost by agent">
            {cost?.byAgent.length ? <Table rowKey="key" size="small" pagination={false} dataSource={cost.byAgent} columns={bucketColumns('Agent')} /> : <Empty description="No LLM usage yet" />}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title="Cost by model">
            {cost?.byModel.length ? <Table rowKey="key" size="small" pagination={false} dataSource={cost.byModel} columns={bucketColumns('Model')} /> : <Empty description="No LLM usage yet" />}
          </Card>
        </Col>
      </Row>

      <Card size="small" title="Agent performance (workflow steps)">
        <Table
          rowKey="role"
          size="small"
          loading={perfLoading}
          pagination={false}
          dataSource={perf?.byRole ?? []}
          columns={[
            { title: 'Role / node', dataIndex: 'role', key: 'role', render: (r: string) => (r.startsWith('(') ? <Text type="secondary">{r}</Text> : <Tag color="blue">{r}</Tag>) },
            { title: 'Runs', dataIndex: 'executions', key: 'executions', width: 80, align: 'right' as const },
            { title: 'Success', dataIndex: 'successRate', key: 'successRate', width: 100, align: 'right' as const, render: (s: number | null, r: RolePerformance) => <Text type={r.failed ? 'warning' : undefined}>{pct(s)}</Text> },
            { title: 'Avg', dataIndex: 'avgDurationMs', key: 'avg', width: 100, align: 'right' as const, render: (ms: number) => `${ms} ms` },
            { title: 'p95', dataIndex: 'p95DurationMs', key: 'p95', width: 100, align: 'right' as const, render: (ms: number) => `${ms} ms` },
            { title: 'Retries', dataIndex: 'retries', key: 'retries', width: 80, align: 'right' as const },
          ]}
        />
      </Card>
    </Space>
  );
};
