import React, { useState } from 'react';
import { Alert, Card, Col, Empty, Row, Segmented, Space, Statistic, Table, Tag, Tooltip, Typography } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, LineChartOutlined, TrophyOutlined } from '@ant-design/icons';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { AgentRow, useAgentAnalytics, useEstimationModel } from '../lib/api/hooks/analytics';
import { duration, heatmapMatrix, pct, successSeries, trendText, trendTone, usd } from '../components/analytics/analyticsFormat';

const { Title, Text } = Typography;

const ROLE_COLORS: Record<string, string> = {
  CEO: '#d4b106', BA: '#13c2c2', ARCHITECT: '#722ed1', PM: '#fa8c16', DEV: '#1677ff', QC: '#52c41a', QA: '#eb2f96', MARKETING: '#a0d911',
};
const TONE_COLOR = { good: '#52c41a', bad: '#ff4d4f', neutral: '#8b949e' };

const Trend: React.FC<{ value: number | null; kind: 'points' | 'relative'; higherIsBetter: boolean }> = ({ value, kind, higherIsBetter }) => {
  const tone = trendTone(value, higherIsBetter);
  if (value === null) return <Text type="secondary">–</Text>;
  return (
    <Text style={{ color: TONE_COLOR[tone], fontSize: 12 }}>
      {value > 0 ? <ArrowUpOutlined /> : value < 0 ? <ArrowDownOutlined /> : null} {trendText(value, kind)}
    </Text>
  );
};

/**
 * Agent performance analytics (Phase 6, Task 24) and the estimation model's accuracy (Task 25).
 */
export const AgentAnalyticsPage: React.FC = () => {
  const [days, setDays] = useState<number>(30);
  const { data, isLoading } = useAgentAnalytics(days);
  const { data: model } = useEstimationModel();

  const series = successSeries(data?.daily ?? []);
  const heatmap = heatmapMatrix(data?.heatmap ?? []);
  const totalRuns = data?.roles.reduce((s, r) => s + r.executionCount, 0) ?? 0;
  const totalCost = data?.roles.reduce((s, r) => s + r.totalCost, 0) ?? 0;
  const finished = data?.roles.reduce((s, r) => s + r.completed + r.failed, 0) ?? 0;
  const completed = data?.roles.reduce((s, r) => s + r.completed, 0) ?? 0;

  const columns = [
    { title: '#', dataIndex: 'rank', key: 'rank', width: 50, render: (r: number) => (r === 1 ? <TrophyOutlined style={{ color: '#d4b106' }} /> : r) },
    { title: 'Agent', dataIndex: 'agentRole', key: 'role', render: (r: string) => <Tag color={ROLE_COLORS[r]}>{r}</Tag> },
    { title: 'Steps', dataIndex: 'executionCount', key: 'n', align: 'right' as const, width: 70 },
    {
      title: 'Success', key: 'success', width: 120,
      render: (_: unknown, r: AgentRow) => <Space direction="vertical" size={0}><Text>{pct(r.successRate)}</Text><Trend value={r.trend.successRateDelta} kind="points" higherIsBetter /></Space>,
    },
    {
      title: 'Avg duration', key: 'dur', width: 130,
      render: (_: unknown, r: AgentRow) => <Space direction="vertical" size={0}><Text>{duration(r.avgDurationMs)}</Text><Trend value={r.trend.avgDurationChange} kind="relative" higherIsBetter={false} /></Space>,
    },
    { title: 'p95', dataIndex: 'p95DurationMs', key: 'p95', width: 90, render: (ms: number) => duration(ms) },
    {
      title: 'Cost / success', key: 'cps', width: 130,
      render: (_: unknown, r: AgentRow) => <Space direction="vertical" size={0}><Text>{usd(r.costPerSuccess)}</Text><Trend value={r.trend.costPerExecutionChange} kind="relative" higherIsBetter={false} /></Space>,
    },
    {
      title: 'Quality', key: 'quality',
      render: (_: unknown, r: AgentRow) => (
        <Tooltip title={`${r.quality.samples} samples`}>
          <Space direction="vertical" size={0}>
            <Text>{pct(r.quality.value)}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{r.quality.basis}</Text>
          </Space>
        </Tooltip>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%', padding: 24 }}>
      <Space style={{ justifyContent: 'space-between', width: '100%' }} wrap>
        <Title level={3} style={{ margin: 0 }}><LineChartOutlined /> Agent Analytics</Title>
        <Segmented value={days} onChange={v => setDays(Number(v))} options={[{ label: '7 days', value: 7 }, { label: '30 days', value: 30 }, { label: '90 days', value: 90 }]} />
      </Space>
      <Text type="secondary">Compared with the {days} days before. Quality is role-specific: QA approvals for DEV, OOAD gate results for the Architect, QC test results for QC, first-attempt success for the others.</Text>

      {data?.anomalies.map(a => (
        <Alert key={`${a.agentRole}-${a.type}`} type={a.severity === 'high' ? 'error' : 'warning'} showIcon message={a.message} description={`Rule: ${a.type.replace(/_/g, ' ')} (threshold ${a.threshold})`} />
      ))}

      <Row gutter={16}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Agent steps" value={totalRuns} loading={isLoading} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Success rate" value={finished ? pct(completed / finished) : '–'} loading={isLoading} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="LLM cost" value={usd(totalCost)} loading={isLoading} /></Card></Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Tooltip title="Static-analysis prediction of the DEV step against the next QA verdict">
              <Statistic title="QA prediction accuracy" value={pct(data?.qaPrediction.accuracy)} suffix={data?.qaPrediction.samples ? <Text type="secondary" style={{ fontSize: 12 }}>({data.qaPrediction.samples})</Text> : null} loading={isLoading} />
            </Tooltip>
          </Card>
        </Col>
      </Row>

      <Card size="small" title="Leaderboard">
        <Table rowKey="agentRole" size="small" loading={isLoading} pagination={false} dataSource={data?.roles ?? []} columns={columns} locale={{ emptyText: <Empty description="No agent steps in this period" /> }} />
      </Card>

      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <Card size="small" title="Success rate per day (%)">
            {series.rows.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={series.rows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                  <XAxis dataKey="date" stroke="#8b949e" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="#8b949e" fontSize={11} />
                  <ChartTooltip contentStyle={{ background: '#1c2128', border: '1px solid #30363d' }} />
                  <Legend />
                  {series.roles.map(role => <Line key={role} type="monotone" dataKey={role} stroke={ROLE_COLORS[role] ?? '#888'} connectNulls dot={{ r: 3 }} />)}
                </LineChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card size="small" title="Cost per successful step">
            {data?.roles.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.roles.map(r => ({ role: r.agentRole, cost: r.costPerSuccess ?? 0 }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                  <XAxis dataKey="role" stroke="#8b949e" fontSize={11} />
                  <YAxis stroke="#8b949e" fontSize={11} />
                  <ChartTooltip contentStyle={{ background: '#1c2128', border: '1px solid #30363d' }} formatter={(v: number) => usd(v)} />
                  <Bar dataKey="cost" fill="#1677ff" />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </Card>
        </Col>
      </Row>

      <Card size="small" title="Activity by day and hour (UTC)">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 11 }}>
            <thead>
              <tr><th />{Array.from({ length: 24 }, (_, h) => <th key={h} style={{ color: '#8b949e', fontWeight: 400, width: 22 }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {heatmap.rows.map(row => (
                <tr key={row.label}>
                  <td style={{ color: '#8b949e', paddingRight: 6 }}>{row.label}</td>
                  {row.counts.map((c, h) => (
                    <td key={h} title={`${row.label} ${h}:00 — ${c} steps`} style={{ width: 22, height: 18, borderRadius: 3, background: c ? `rgba(22,119,255,${0.15 + 0.85 * (c / (heatmap.max || 1))})` : '#21262d' }} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card size="small" title="Effort & cost estimation model" extra={model && <Text type="secondary">trained on {model.trainingProjects} finished projects; regression from {model.minRegressionSamples} samples</Text>}>
        <Row gutter={16}>
          <Col xs={24} lg={12}>
            <Table
              rowKey="role" size="small" pagination={false} dataSource={model?.roles ?? []}
              columns={[
                { title: 'Agent', dataIndex: 'role', key: 'role', render: (r: string) => <Tag color={ROLE_COLORS[r]}>{r}</Tag> },
                { title: 'Samples', dataIndex: 'samples', key: 's', align: 'right' as const },
                { title: 'Method', dataIndex: 'method', key: 'm', render: (m: string) => <Tag>{m}</Tag> },
                { title: 'LOO error (time)', key: 'e', render: (_: unknown, r: any) => pct(r.evaluation.mapeDuration) },
                { title: 'LOO error (cost)', key: 'c', render: (_: unknown, r: any) => pct(r.evaluation.mapeCost) },
              ]}
              locale={{ emptyText: <Empty description="No finished project yet" /> }}
            />
          </Col>
          <Col xs={24} lg={12}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text type="secondary">Forecast made when the workflow started, against the outcome (mean absolute error: time {pct(model?.meanAbsoluteDurationError)}, cost {pct(model?.meanAbsoluteCostError)})</Text>
              <Table
                rowKey="projectId" size="small" pagination={{ pageSize: 5 }} dataSource={model?.accuracy ?? []}
                columns={[
                  { title: 'Project', dataIndex: 'projectName', key: 'p', ellipsis: true },
                  { title: 'Time (pred → actual)', key: 't', render: (_: unknown, a: any) => `${duration(a.predictedDurationMs)} → ${duration(a.actualDurationMs)}` },
                  { title: 'Cost (pred → actual)', key: 'c', render: (_: unknown, a: any) => `${usd(a.predictedCost)} → ${usd(a.actualCost)}` },
                  { title: 'Error', key: 'e', render: (_: unknown, a: any) => trendText(a.durationError, 'relative') },
                ]}
                locale={{ emptyText: <Empty description="No finished project with a forecast yet" /> }}
              />
            </Space>
          </Col>
        </Row>
      </Card>
    </Space>
  );
};
