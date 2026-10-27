import React from 'react';
import { Card, Col, Empty, Row, Statistic, Table, Tag, Typography } from 'antd';
import { useProjectEstimate } from '../../lib/api/hooks/analytics';
import { duration, trendText, usd } from '../analytics/analyticsFormat';

const { Text } = Typography;
const CONFIDENCE_COLOR = { low: 'red', medium: 'gold', high: 'green' } as const;

/**
 * Effort and cost forecast of a project (Phase 6, Task 25): the current forecast, the
 * forecasts stored when the workflow started and when the PM planned, and the outcome.
 */
export const ForecastCard: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { data, isLoading } = useProjectEstimate(projectId);
  const current = data?.current;

  return (
    <Card size="small" title="Effort & cost forecast" loading={isLoading} extra={current && <Tag color={CONFIDENCE_COLOR[current.confidence]}>{current.confidence} confidence</Tag>}>
      {!current || !current.byRole.length ? (
        <Empty description="No finished project to learn from yet" />
      ) : (
        <>
          <Row gutter={16}>
            <Col xs={12} md={6}><Statistic title="Forecast agent time" value={duration(current.durationMs)} /></Col>
            <Col xs={12} md={6}><Statistic title="Forecast LLM cost" value={usd(current.cost)} /></Col>
            <Col xs={12} md={6}><Statistic title="So far: time" value={duration(data!.actual.durationMs)} /></Col>
            <Col xs={12} md={6}><Statistic title="So far: cost" value={usd(data!.actual.cost)} /></Col>
          </Row>
          <Text type="secondary" style={{ display: 'block', margin: '8px 0' }}>
            From {current.trainingProjects} finished projects; features: {current.features.descriptionLength} characters, {current.features.useCaseCount} use cases
            {current.imputed.length ? ' (use cases not written yet: history median)' : ''}
            {current.unknownRoles.length ? `; no history for ${current.unknownRoles.join(', ')}` : ''}.
          </Text>
          {data!.comparison && (
            <Text style={{ display: 'block', marginBottom: 8 }}>
              Outcome against the <Tag>{data!.comparison.stage}</Tag> forecast: time {trendText(data!.comparison.durationError, 'relative')}, cost {trendText(data!.comparison.costError, 'relative')}
            </Text>
          )}
          <Table
            rowKey="role" size="small" pagination={false} dataSource={current.byRole}
            columns={[
              { title: 'Agent', dataIndex: 'role', key: 'role', render: (r: string) => <Tag color="blue">{r}</Tag> },
              { title: 'Time', dataIndex: 'durationMs', key: 't', render: (ms: number) => duration(ms) },
              { title: 'Cost', dataIndex: 'cost', key: 'c', render: (c: number) => usd(c) },
              { title: 'Method', key: 'm', render: (_: unknown, r: any) => <Text type="secondary">{r.method} ({r.samples})</Text> },
            ]}
          />
          {data!.history.length > 0 && (
            <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              Stored forecasts: {data!.history.map(h => `${h.stage} ${duration(h.durationMs)} / ${usd(h.cost)}`).join(' · ')}
            </Text>
          )}
        </>
      )}
    </Card>
  );
};
