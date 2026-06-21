import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Tag, Statistic, Typography, Space, Table, Badge, Skeleton, Alert } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { useHealthStatus } from '../lib/api/hooks/health';
import socketClient from '../lib/websocket/socket-client';

const { Title, Text } = Typography;

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  healthy: { color: 'green', icon: <CheckCircleOutlined /> },
  degraded: { color: 'orange', icon: <WarningOutlined /> },
  unhealthy: { color: 'red', icon: <CloseCircleOutlined /> },
};

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  database: <DatabaseOutlined />,
  ninerouter: <ApiOutlined />,
};

const columns = [
  {
    title: 'Service',
    dataIndex: 'name',
    key: 'name',
    render: (name: string) => (
      <Space>
        {SERVICE_ICONS[name] || <CloudServerOutlined />}
        <Text strong>{name}</Text>
      </Space>
    ),
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status: string) => {
      const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.healthy;
      return <Badge status={status === 'healthy' ? 'success' : status === 'degraded' ? 'warning' : 'error'} text={<Tag color={cfg.color} icon={cfg.icon}>{status}</Tag>} />;
    },
  },
  {
    title: 'Latency',
    dataIndex: 'latencyMs',
    key: 'latencyMs',
    render: (ms?: number) => ms !== undefined ? `${ms}ms` : '-',
  },
  {
    title: 'Error',
    dataIndex: 'error',
    key: 'error',
    render: (error?: string) => error ? <Text type="danger">{error}</Text> : '-',
  },
];

export const AdminDashboard: React.FC = () => {
  const { data: health, isLoading, error } = useHealthStatus();
  const [healthAlerts, setHealthAlerts] = useState<Array<{ type: string; payload: any }>>([]);

  useEffect(() => {
    const unsubCircuitOpen = socketClient.on('system_event', (data: any) => {
      if (data.type === 'health:circuit_breaker_opened' || data.type === 'health:service_degraded') {
        setHealthAlerts((prev) => [...prev.slice(-4), data]);
      }
      if (data.type === 'health:circuit_breaker_closed') {
        setHealthAlerts((prev) => prev.filter((a) => a.payload?.service !== data.payload?.service));
      }
    });

    return () => {
      unsubCircuitOpen();
    };
  }, []);

  if (isLoading) {
    return <Skeleton active paragraph={{ rows: 4 }} />;
  }

  if (error) {
    return (
      <Card>
        <Text type="danger">Failed to load health status</Text>
      </Card>
    );
  }

  const overallStatus = health?.status || 'unhealthy';
  const overallCfg = STATUS_CONFIG[overallStatus];

  return (
    <div>
      <Title level={4}>System Health</Title>

      {healthAlerts.map((alert, i) => (
        <Alert
          key={i}
          type={alert.type === 'health:circuit_breaker_opened' ? 'error' : 'warning'}
          message={alert.type === 'health:circuit_breaker_opened' ? 'Circuit Breaker Opened' : 'Service Degraded'}
          description={`${alert.payload?.service}: ${alert.payload?.error || 'Service is degraded'}`}
          showIcon
          closable
          onClose={() => setHealthAlerts((prev) => prev.filter((_, idx) => idx !== i))}
          style={{ marginBottom: 8 }}
        />
      ))}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Overall Status"
              value={overallStatus}
              prefix={overallCfg?.icon}
              valueStyle={{ color: overallStatus === 'healthy' ? '#52c41a' : overallStatus === 'degraded' ? '#faad14' : '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Services"
              value={health?.checks?.length || 0}
              suffix={`/ ${health?.checks?.filter((c: { status: string }) => c.status === 'healthy').length || 0} healthy`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Last Check"
              value={health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : '-'}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Service Details" style={{ marginTop: 16 }}>
        <Table
          dataSource={health?.checks || []}
          columns={columns}
          rowKey="name"
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );
};
