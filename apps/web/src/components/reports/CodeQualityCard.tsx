import React from 'react';
import { Card, Col, Empty, List, Row, Statistic, Table, Tag, Typography } from 'antd';
import { FileAssessment, useCodeQuality } from '../../lib/api/hooks/analytics';
import { SCORE_COLOR } from '../analytics/analyticsFormat';

const { Text } = Typography;
const KIND_COLOR: Record<string, string> = { syntax: 'red', security: 'volcano', layering: 'magenta', complexity: 'orange', maintainability: 'gold', traceability: 'blue' };

/**
 * Static analysis of the project's generated code (Phase 6, Task 26).
 */
export const CodeQualityCard: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { data, isLoading } = useCodeQuality(projectId);

  return (
    <Card size="small" title="Code quality (static analysis)" loading={isLoading}>
      {!data || data.score === null ? (
        <Empty description="No generated source code yet" />
      ) : (
        <>
          <Row gutter={16}>
            <Col xs={12} md={6}><Statistic title="Score" value={data.score} suffix={`/ 100`} valueStyle={{ color: SCORE_COLOR(data.score, data.threshold) === 'red' ? '#ff4d4f' : undefined }} /></Col>
            <Col xs={12} md={6}>
              <Statistic title="Predicted QA verdict" valueRender={() => <Tag color={data.predictedQaVerdict === 'pass' ? 'green' : 'red'}>{data.predictedQaVerdict?.toUpperCase()}</Tag>} value=" " />
            </Col>
            <Col xs={24} md={12}>
              <Text type="secondary">Findings: </Text>
              {Object.entries(data.totals).filter(([, n]) => n).map(([k, n]) => <Tag key={k} color={KIND_COLOR[k]}>{k} {n}</Tag>)}
              {!Object.values(data.totals).some(Boolean) && <Tag color="green">none</Tag>}
              {data.reasons.length > 0 && <Text type="secondary" style={{ display: 'block' }}>{data.reasons.join('; ')}</Text>}
            </Col>
          </Row>
          <Table
            style={{ marginTop: 12 }} rowKey="path" size="small" pagination={{ pageSize: 8 }} dataSource={data.files}
            expandable={{
              rowExpandable: (f: FileAssessment) => f.findings.length > 0,
              expandedRowRender: (f: FileAssessment) => (
                <List size="small" dataSource={f.findings} renderItem={x => (
                  <List.Item><Tag color={KIND_COLOR[x.kind]}>{x.kind}</Tag><Text code>line {x.line}</Text> {x.message}</List.Item>
                )} />
              ),
            }}
            columns={[
              { title: 'File', dataIndex: 'path', key: 'p', render: (p: string) => <Text code>{p}</Text> },
              { title: 'Score', dataIndex: 'score', key: 's', width: 80, render: (s: number) => <Tag color={SCORE_COLOR(s, data.threshold)}>{s}</Tag> },
              { title: 'LOC', dataIndex: 'loc', key: 'l', width: 70, align: 'right' as const },
              { title: 'Max CC', dataIndex: 'maxComplexity', key: 'c', width: 80, align: 'right' as const },
              { title: 'MI', dataIndex: 'maintainabilityIndex', key: 'mi', width: 70, align: 'right' as const },
              { title: 'Findings', key: 'f', width: 90, align: 'right' as const, render: (_: unknown, f: FileAssessment) => f.findings.length },
            ]}
          />
        </>
      )}
    </Card>
  );
};
