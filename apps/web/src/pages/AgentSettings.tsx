import React, { useEffect, useState } from 'react';
import { Card, Table, Select, Button, Typography, Space, Tag, message, Skeleton } from 'antd';
import { RobotOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { apiClient } from '../lib/api/client';

const { Title, Text } = Typography;

interface AgentModel {
  role: string;
  name: string;
  modelRouteConfig: { provider: string; model: string; fallbackProvider: string };
  isActive: boolean;
}

interface AvailableModel {
  id: string;
  name: string;
  provider: string;
  category: string;
}

const ROLE_COLORS: Record<string, string> = {
  CEO: '#722ed1',
  PM: '#1677ff',
  DEV: '#52c41a',
  QA: '#fa8c16',
  MARKETING: '#eb2f96',
};

const PROVIDER_COLORS: Record<string, string> = {
  openrouter: '#1677ff',
  cx: '#722ed1',
  deepseek: '#52c41a',
  groq: '#fa8c16',
};

export const AgentSettings: React.FC = () => {
  const [agents, setAgents] = useState<AgentModel[]>([]);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [agentsRes, modelsRes] = await Promise.all([
        apiClient.get('/models'),
        apiClient.get('/models/available'),
      ]);
      setAgents(agentsRes.data);
      setAvailableModels(modelsRes.data);
      setPendingChanges({});
    } catch (err) {
      message.error('Failed to load agent configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleModelChange = (role: string, newModel: string) => {
    setPendingChanges((prev) => ({ ...prev, [role]: newModel }));
  };

  const handleSave = async (role: string) => {
    const model = pendingChanges[role];
    if (!model) return;

    setSaving(true);
    try {
      await apiClient.patch(`/models/${role}`, { model });
      message.success(`${role} agent model updated`);
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[role];
        return next;
      });
      fetchData();
    } catch (err) {
      message.error(`Failed to update ${role} agent`);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: 'Agent',
      dataIndex: 'role',
      key: 'role',
      render: (role: string, record: AgentModel) => (
        <Space>
          <RobotOutlined style={{ color: ROLE_COLORS[role] || '#8b949e' }} />
          <div>
            <Text strong style={{ color: ROLE_COLORS[role] }}>{role}</Text>
            <br />
            <Text style={{ color: '#8b949e', fontSize: 12 }}>{record.name}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Current Model',
      key: 'currentModel',
      render: (_: any, record: AgentModel) => {
        const modelId = record.modelRouteConfig?.model || 'N/A';
        const model = availableModels.find((m) => m.id === modelId);
        return (
          <Space direction="vertical" size={2}>
            <Text style={{ color: '#e6edf3' }}>{model?.name || modelId}</Text>
            <Tag color={PROVIDER_COLORS[record.modelRouteConfig?.provider] || 'default'} style={{ fontSize: 11 }}>
              {record.modelRouteConfig?.provider || 'unknown'}
            </Tag>
          </Space>
        );
      },
    },
    {
      title: 'Switch Model',
      key: 'switchModel',
      render: (_: any, record: AgentModel) => {
        const currentValue = pendingChanges[record.role] || record.modelRouteConfig?.model;
        const hasChanged = !!pendingChanges[record.role];

        return (
          <Space>
            <Select
              style={{ width: 280 }}
              value={currentValue}
              onChange={(val) => handleModelChange(record.role, val)}
              placeholder="Select a model"
              showSearch
              optionFilterProp="label"
            >
              {availableModels.map((model) => (
                <Select.Option key={model.id} value={model.id} label={model.name}>
                  <Space>
                    <Text>{model.name}</Text>
                    <Tag color={PROVIDER_COLORS[model.provider] || 'default'} style={{ fontSize: 10 }}>
                      {model.category}
                    </Tag>
                  </Space>
                </Select.Option>
              ))}
            </Select>
            {hasChanged && (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                size="small"
                loading={saving}
                onClick={() => handleSave(record.role)}
              >
                Save
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  if (loading) {
    return <Skeleton active paragraph={{ rows: 4 }} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Agent Models</Title>
          <Text style={{ color: '#8b949e' }}>
            Configure which LLM model each agent uses. Changes take effect on the next workflow run.
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchData}>
          Refresh
        </Button>
      </div>

      <Card>
        <Table
          dataSource={agents}
          columns={columns}
          rowKey="role"
          pagination={false}
        />
      </Card>
    </div>
  );
};
