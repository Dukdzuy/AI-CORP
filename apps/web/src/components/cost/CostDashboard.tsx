import React from 'react';
import { Typography, Row, Col, Card, Statistic, Space, Tag, Table, Empty, Skeleton } from 'antd';
import {
  DollarOutlined,
  ThunderboltOutlined,
  CloudOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { useCostSummary, AgentCostBreakdown, ModelUsage } from '../../lib/api/hooks/cost';

const { Title, Text } = Typography;

const AGENT_COLORS: Record<string, string> = {
  CEO: '#722ed1',
  PM: '#1677ff',
  DEV: '#52c41a',
  QA: '#fa8c16',
  MARKETING: '#eb2f96',
};

const PIE_COLORS = ['#722ed1', '#1677ff', '#52c41a', '#fa8c16', '#eb2f96', '#13c2c2'];

interface CostDashboardProps {
  projectId?: string;
}

const StatCard: React.FC<{
  title: string;
  value: string | number;
  prefix?: React.ReactNode;
  color: string;
  suffix?: string;
}> = ({ title, value, prefix, color, suffix }) => (
  <Card
    style={{
      background: '#161b22',
      border: '1px solid #30363d',
      borderRadius: 10,
    }}
    styles={{ body: { padding: '16px 20px' } }}
  >
    <Space align="center" size={12}>
      <div
        style={{
          background: color + '22',
          borderRadius: 8,
          padding: '8px 10px',
          fontSize: 20,
          color,
        }}
      >
        {prefix}
      </div>
      <Statistic
        title={<Text style={{ color: '#8b949e', fontSize: 12 }}>{title}</Text>}
        value={value}
        suffix={suffix}
        valueStyle={{ color: '#e6edf3', fontSize: 20, fontWeight: 600 }}
      />
    </Space>
  </Card>
);

export const CostDashboard: React.FC<CostDashboardProps> = ({ projectId }) => {
  const { data: summary, isLoading } = useCostSummary(projectId);

  if (isLoading) {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }

  if (!summary) return null;

  const hasData = summary.totalTokens > 0;

  const agentPieData = summary.byAgent.map((a) => ({
    name: a.agentRole,
    value: a.totalCost,
  }));

  const agentBarData = summary.byAgent.map((a) => ({
    name: a.agentRole,
    cost: Number(a.totalCost.toFixed(4)),
    tokens: a.totalTokens,
    rtk: a.rtkTokensSaved,
  }));

  const modelBarData = summary.byModel.map((m) => ({
    name: m.model.length > 16 ? m.model.slice(0, 16) + '...' : m.model,
    requests: m.requestCount,
    cost: Number(m.cost.toFixed(4)),
    fallbacks: m.fallbackTriggered,
  }));

  return (
    <div>
      {/* Summary Stats */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col xs={12} md={6}>
          <StatCard
            title="Total Cost"
            value={summary.totalCost.toFixed(4)}
            prefix={<DollarOutlined />}
            color="#faad14"
            suffix="USD"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            title="Total Tokens"
            value={summary.totalTokens.toLocaleString()}
            prefix={<ThunderboltOutlined />}
            color="#1677ff"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            title="RTK Tokens Saved"
            value={summary.rtkTokensSaved.toLocaleString()}
            prefix={<CloudOutlined />}
            color="#52c41a"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            title="Models Used"
            value={summary.byModel.length}
            prefix={<BarChartOutlined />}
            color="#722ed1"
          />
        </Col>
      </Row>

      {hasData ? (
        <Row gutter={[16, 16]}>
          {/* Cost by Agent Pie Chart */}
          <Col xs={24} lg={8}>
            <Card
              title={<Text style={{ color: '#e6edf3', fontSize: 13 }}>Cost by Agent</Text>}
              style={{
                background: '#161b22',
                border: '1px solid #30363d',
                borderRadius: 10,
                height: 320,
              }}
              styles={{ header: { background: '#161b22', borderBottom: '1px solid #30363d' }, body: { padding: 12 } }}
            >
              {agentPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={agentPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {agentPieData.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6 }}
                      formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Empty description={<Text style={{ color: '#484f58' }}>No data</Text>} />
              )}
            </Card>
          </Col>

          {/* Cost by Agent Bar Chart */}
          <Col xs={24} lg={16}>
            <Card
              title={<Text style={{ color: '#e6edf3', fontSize: 13 }}>Token Usage by Agent</Text>}
              style={{
                background: '#161b22',
                border: '1px solid #30363d',
                borderRadius: 10,
                height: 320,
              }}
              styles={{ header: { background: '#161b22', borderBottom: '1px solid #30363d' }, body: { padding: 12 } }}
            >
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={agentBarData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                  <XAxis dataKey="name" tick={{ fill: '#8b949e', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6 }}
                    formatter={(value: number, name: string) => {
                      if (name === 'cost') return [`$${value.toFixed(4)}`, 'Cost'];
                      return [value.toLocaleString(), name === 'rtk' ? 'RTK Saved' : 'Tokens'];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="tokens" fill="#1677ff" name="Tokens" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="rtk" fill="#52c41a" name="RTK Saved" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>

          {/* Model Usage Table */}
          <Col xs={24}>
            <Card
              title={<Text style={{ color: '#e6edf3', fontSize: 13 }}>Model Usage Breakdown</Text>}
              style={{
                background: '#161b22',
                border: '1px solid #30363d',
                borderRadius: 10,
              }}
              styles={{ header: { background: '#161b22', borderBottom: '1px solid #30363d' } }}
            >
              <Table
                dataSource={summary.byModel}
                rowKey="model"
                size="small"
                pagination={false}
                columns={[
                  {
                    title: <Text style={{ color: '#8b949e', fontSize: 12 }}>Model</Text>,
                    dataIndex: 'model',
                    key: 'model',
                    render: (model: string) => (
                      <Text style={{ color: '#e6edf3', fontSize: 12, fontFamily: 'monospace' }}>{model}</Text>
                    ),
                  },
                  {
                    title: <Text style={{ color: '#8b949e', fontSize: 12 }}>Provider</Text>,
                    dataIndex: 'provider',
                    key: 'provider',
                    render: (provider: string) => (
                      <Tag color="blue" style={{ fontSize: 11 }}>{provider}</Tag>
                    ),
                  },
                  {
                    title: <Text style={{ color: '#8b949e', fontSize: 12 }}>Requests</Text>,
                    dataIndex: 'requestCount',
                    key: 'requestCount',
                    render: (v: number) => (
                      <Text style={{ color: '#e6edf3', fontSize: 12 }}>{v}</Text>
                    ),
                  },
                  {
                    title: <Text style={{ color: '#8b949e', fontSize: 12 }}>Tokens</Text>,
                    dataIndex: 'totalTokens',
                    key: 'totalTokens',
                    render: (v: number) => (
                      <Text style={{ color: '#e6edf3', fontSize: 12 }}>{v.toLocaleString()}</Text>
                    ),
                  },
                  {
                    title: <Text style={{ color: '#8b949e', fontSize: 12 }}>Cost</Text>,
                    dataIndex: 'cost',
                    key: 'cost',
                    render: (v: number) => (
                      <Text style={{ color: '#faad14', fontSize: 12 }}>${v.toFixed(4)}</Text>
                    ),
                  },
                  {
                    title: <Text style={{ color: '#8b949e', fontSize: 12 }}>Fallbacks</Text>,
                    dataIndex: 'fallbackTriggered',
                    key: 'fallbackTriggered',
                    render: (v: number) => (
                      <Tag color={v > 0 ? 'orange' : 'default'} style={{ fontSize: 11 }}>{v}</Tag>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>

          {/* Cost Over Time */}
          {summary.costOverTime.length > 0 && (
            <Col xs={24}>
              <Card
                title={<Text style={{ color: '#e6edf3', fontSize: 13 }}>Cost Over Time</Text>}
                style={{
                  background: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: 10,
                }}
                styles={{ header: { background: '#161b22', borderBottom: '1px solid #30363d' }, body: { padding: 12 } }}
              >
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={summary.costOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                    <XAxis dataKey="date" tick={{ fill: '#8b949e', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6 }}
                      formatter={(value: number, name: string) => {
                        if (name === 'cost') return [`$${value.toFixed(4)}`, 'Cost'];
                        return [value.toLocaleString(), 'Tokens'];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="cost" stroke="#faad14" name="Cost" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          )}
        </Row>
      ) : (
        <Card
          style={{
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 10,
          }}
        >
          <Empty description={<Text style={{ color: '#8b949e' }}>No cost data yet. Data will appear when LLM calls are made.</Text>} />
        </Card>
      )}
    </div>
  );
};
