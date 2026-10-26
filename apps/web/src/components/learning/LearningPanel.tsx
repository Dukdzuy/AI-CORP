import React from 'react';
import { Card, Col, Empty, List, Row, Space, Statistic, Tag, Typography } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ExperimentOutlined, RiseOutlined } from '@ant-design/icons';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LearningStats, useAgentLearning } from '../../lib/api/hooks/learning';

const { Text, Paragraph } = Typography;

const SIGNAL_LABELS: Record<string, string> = {
  ooad_gate: 'OOAD gate',
  qc_verification: 'QC tests',
  qa_review: 'QA review',
};

const INK = { primary: '#e6edf3', secondary: '#8b949e', muted: '#484f58', grid: '#21262d' };
const SERIES = '#4c9aff';
const card: React.CSSProperties = { background: '#161b22', border: '1px solid #30363d', borderRadius: 12, marginBottom: 20 };

const RateTooltip: React.FC<any> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as LearningStats['timeline'][number];
  return (
    <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, padding: '6px 10px' }}>
      <div style={{ color: INK.secondary, fontSize: 12 }}>{d.date}</div>
      <div style={{ color: INK.primary, fontSize: 13 }}>{d.successRate}% success</div>
      <div style={{ color: INK.secondary, fontSize: 12 }}>{d.successes} of {d.total} graded executions</div>
    </div>
  );
};

/** Success rate over time and the lessons the agent refined from its outcomes (Task 14) */
export const LearningPanel: React.FC<{ role: string }> = ({ role }) => {
  const { data, isLoading } = useAgentLearning(role);

  return (
    <Card
      loading={isLoading}
      style={card}
      styles={{ header: { background: '#161b22', borderBottom: '1px solid #30363d' } }}
      title={
        <Space>
          <RiseOutlined style={{ color: SERIES }} />
          <Text style={{ color: INK.primary }}>Learning</Text>
          <Text style={{ color: INK.secondary, fontSize: 12 }}>last 30 days</Text>
        </Space>
      }
    >
      {!data || data.outcomes === 0 ? (
        <Empty
          description={
            <Text style={{ color: INK.secondary }}>
              No graded executions yet. Outcomes come from the OOAD gate (BA, Architect), QC tests (DEV) and QA reviews (DEV, QC).
            </Text>
          }
        />
      ) : (
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <Row gutter={16}>
            <Col xs={12} md={6}>
              <Statistic title={<span style={{ color: INK.secondary }}>Success rate</span>} value={data.successRate ?? 0} suffix="%" valueStyle={{ color: INK.primary }} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title={<span style={{ color: INK.secondary }}>Graded executions</span>} value={data.outcomes} valueStyle={{ color: INK.primary }} />
            </Col>
            <Col xs={24} md={12}>
              <Text style={{ color: INK.secondary, fontSize: 14 }}>By signal</Text>
              <div style={{ marginTop: 6 }}>
                {Object.entries(data.bySignal).map(([signal, s]) => (
                  <Tag key={signal} style={{ marginBottom: 4 }}>
                    {SIGNAL_LABELS[signal] || signal}: {s.successes}/{s.total}
                  </Tag>
                ))}
              </div>
            </Col>
          </Row>

          {data.timeline.length > 1 && (
            <div>
              <Text style={{ color: INK.secondary, fontSize: 13 }}>Success rate per day (%)</Text>
              <div style={{ height: 200, marginTop: 8 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.timeline} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                    <CartesianGrid stroke={INK.grid} vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: INK.secondary, fontSize: 11 }} axisLine={{ stroke: INK.grid }} tickLine={false} />
                    <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fill: INK.secondary, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<RateTooltip />} cursor={{ stroke: INK.muted }} />
                    <Line type="linear" dataKey="successRate" stroke={SERIES} strokeWidth={2} dot={{ r: 4, fill: SERIES, stroke: '#161b22', strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div>
            <Space style={{ marginBottom: 8 }}>
              <ExperimentOutlined style={{ color: '#faad14' }} />
              <Text style={{ color: INK.primary }}>Top lessons</Text>
            </Space>
            {data.lessons.length === 0 ? (
              <Text style={{ color: INK.muted, display: 'block' }}>No lessons refined yet (one is written every few graded executions).</Text>
            ) : (
              <List
                size="small"
                dataSource={data.lessons}
                renderItem={lesson => (
                  <List.Item style={{ borderColor: '#21262d' }}>
                    <div>
                      <Paragraph style={{ color: '#c9d1d9', whiteSpace: 'pre-wrap', margin: 0 }}>{lesson.content}</Paragraph>
                      <Text style={{ color: INK.muted, fontSize: 11 }}>{new Date(lesson.createdAt).toLocaleString()}</Text>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </div>

          <div>
            <Text style={{ color: INK.primary }}>Recent outcomes</Text>
            <List
              size="small"
              dataSource={data.recentOutcomes}
              renderItem={o => (
                <List.Item style={{ borderColor: '#21262d' }}>
                  <Space align="start">
                    {o.success ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                    <Text style={{ color: '#c9d1d9', fontSize: 12 }}>{o.content}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </div>
        </Space>
      )}
    </Card>
  );
};
