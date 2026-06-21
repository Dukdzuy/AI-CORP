import React from 'react';
import { Typography, Card, Empty } from 'antd';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { AgentCostBreakdown } from '../../lib/api/hooks/cost';

const { Text } = Typography;

const AGENT_COLORS: Record<string, string> = {
  CEO: '#722ed1',
  PM: '#1677ff',
  DEV: '#52c41a',
  QA: '#fa8c16',
  MARKETING: '#eb2f96',
};

interface CostBreakdownChartProps {
  data: AgentCostBreakdown[];
  height?: number;
}

export const CostBreakdownChart: React.FC<CostBreakdownChartProps> = ({
  data,
  height = 280,
}) => {
  if (!data || data.length === 0) {
    return (
      <Card
        style={{
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: 10,
        }}
        styles={{ body: { padding: 12 } }}
      >
        <Empty description={<Text style={{ color: '#484f58' }}>No cost data available</Text>} />
      </Card>
    );
  }

  // Transform data for recharts: each agent becomes a Line
  const agentRoles = data.map((d) => d.agentRole);

  // Build chart data from breakdown (single point in time per agent)
  const chartData = [
    {
      name: 'Current',
      ...Object.fromEntries(data.map((d) => [d.agentRole, Number(d.totalCost.toFixed(4))])),
    },
  ];

  return (
    <Card
      title={<Text style={{ color: '#e6edf3', fontSize: 13 }}>Cost Breakdown by Agent</Text>}
      style={{
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: 10,
      }}
      styles={{ header: { background: '#161b22', borderBottom: '1px solid #30363d' }, body: { padding: 12 } }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
          <XAxis dataKey="name" tick={{ fill: '#8b949e', fontSize: 11 }} />
          <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: '#161b22',
              border: '1px solid #30363d',
              borderRadius: 6,
            }}
            formatter={(value: number) => [`$${value.toFixed(4)}`, '']}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {agentRoles.map((role) => (
            <Line
              key={role}
              type="monotone"
              dataKey={role}
              stroke={AGENT_COLORS[role] ?? '#8b949e'}
              name={role}
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
};
