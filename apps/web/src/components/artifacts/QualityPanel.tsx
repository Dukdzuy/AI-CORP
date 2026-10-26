import React from 'react';
import { Alert, Card, Col, List, Progress, Row, Space, Statistic, Tag, Typography } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { OoadProjectMetrics } from '../../lib/api/hooks/artifacts';
import { describeCheck, GateView, WarningView } from './qualityGate';

const { Text } = Typography;
const card: React.CSSProperties = { background: '#161b22', border: '1px solid #30363d' };
const label = (text: string) => <span style={{ color: '#8b949e' }}>{text}</span>;

/** ooadMetadata summary: what the BA, Architect and QC produced */
export const OoadSummary: React.FC<{ metrics: OoadProjectMetrics | null | undefined }> = ({ metrics }) => {
  if (!metrics) return null;
  const trace = metrics.traceability;
  return (
    <Card size="small" style={card} title={<Text style={{ color: '#e6edf3' }}>OOAD summary</Text>}>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={4}><Statistic title={label('Use cases')} value={metrics.useCaseCount} valueStyle={{ color: '#e6edf3' }} /></Col>
        <Col xs={12} md={4}><Statistic title={label('Entities')} value={metrics.entityCount} valueStyle={{ color: '#e6edf3' }} /></Col>
        <Col xs={12} md={4}><Statistic title={label('Patterns')} value={metrics.patternCount} valueStyle={{ color: '#e6edf3' }} /></Col>
        <Col xs={12} md={4}><Statistic title={label('Gate pass rate')} value={metrics.gatePassRate} suffix="%" valueStyle={{ color: '#e6edf3' }} /></Col>
        <Col xs={24} md={8}>
          <Text style={{ color: '#8b949e', fontSize: 14 }}>Use case test coverage</Text>
          {metrics.testCoverage === null ? (
            <div><Text style={{ color: '#8b949e' }}>Not verified yet</Text></div>
          ) : (
            <Progress
              percent={metrics.testCoverage}
              status={metrics.testCoverage < 80 ? 'exception' : trace?.failingUseCases.length ? 'normal' : 'success'}
            />
          )}
          {trace && (
            <Space size={4} wrap>
              <Tag color={trace.executed ? 'blue' : 'default'}>{trace.executed ? 'tests executed' : 'tests not executed'}</Tag>
              {trace.executed && <Tag color="green">{trace.testsPassed} passed</Tag>}
              {trace.executed && trace.testsFailed > 0 && <Tag color="red">{trace.testsFailed} failed</Tag>}
              {trace.failingUseCases.map(id => <Tag key={id} color="red">{id} failing</Tag>)}
              {trace.missingUseCases.map(id => <Tag key={id} color="orange">{id} missing</Tag>)}
            </Space>
          )}
        </Col>
      </Row>
    </Card>
  );
};

export const QualityGateList: React.FC<{ gates: GateView[] }> = ({ gates }) => {
  if (gates.length === 0) return null;
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {gates.map(gate => (
        <Card
          key={`${gate.gateId}-${gate.at}`}
          size="small"
          style={card}
          title={
            <Space wrap>
              {gate.passed ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
              <Text style={{ color: '#e6edf3' }}>Quality gate: {gate.gateId}</Text>
              <Tag color={gate.passed ? 'green' : 'red'}>{gate.passed ? 'passed' : 'failed'}</Tag>
              <Tag>{gate.score}%</Tag>
              {gate.live && <Tag color="blue">live</Tag>}
              <Text style={{ color: '#8b949e', fontSize: 12 }}>{new Date(gate.at).toLocaleString()}</Text>
            </Space>
          }
        >
          <List
            size="small"
            dataSource={gate.checklist}
            renderItem={item => (
              <List.Item style={{ borderColor: '#21262d', padding: '4px 0' }}>
                <Space>
                  {item.passed ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                  <Text style={{ color: '#c9d1d9' }}>{item.name}</Text>
                  <Text style={{ color: '#8b949e', fontSize: 12 }}>{describeCheck(item)}</Text>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      ))}
    </Space>
  );
};

export const QualityWarnings: React.FC<{ warnings: WarningView[] }> = ({ warnings }) => (
  <>
    {warnings.map((w, i) => (
      <Alert
        key={`${w.at}-${i}`}
        type={w.severity === 'error' ? 'error' : w.severity === 'info' ? 'info' : 'warning'}
        showIcon
        icon={<WarningOutlined />}
        message={w.message}
        description={[
          w.failingUseCases?.length ? `Failing: ${w.failingUseCases.join(', ')}` : '',
          w.missingUseCases?.length ? `Missing tests: ${w.missingUseCases.join(', ')}` : '',
        ].filter(Boolean).join(' · ') || undefined}
        style={{ background: '#161b22', border: '1px solid #faad1430' }}
      />
    ))}
  </>
);
