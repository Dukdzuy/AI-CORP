import React, { useEffect, useState } from 'react';
import { Card, Table, Select, Button, Typography, Space, Tag, message, Skeleton } from 'antd';
import { Permission } from '@ai-corp/shared-types';
import { usePermission } from '../lib/permissions';
import { CloudServerOutlined, RobotOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api/client';

const { Title, Text } = Typography;

interface AgentModel {
  role: string;
  name: string;
  modelRouteConfig: { provider: string; model: string; providerId?: string; fallbackProvider: string };
  isActive: boolean;
}

/** A model of a provider configured on the LLM Providers page (providerId null = NINE_ROUTER_URL gateway) */
interface AvailableModel {
  key: string;
  id: string;
  name: string;
  providerId: string | null;
  provider: string;
  category: string;
}

const optionKey = (config?: AgentModel['modelRouteConfig']) =>
  config?.providerId ? `${config.providerId}::${config.model}` : config?.model;

const ROLE_COLORS: Record<string, string> = {
  CEO: '#722ed1',
  PM: '#1677ff',
  DEV: '#52c41a',
  QA: '#fa8c16',
  QC: '#13c2c2',
  BA: '#2f54eb',
  ARCHITECT: '#a0d911',
  MARKETING: '#eb2f96',
};

const CATEGORY_COLORS: Record<string, string> = {
  general: 'blue',
  code: 'green',
  reasoning: 'purple',
  premium: 'gold',
};

export const AgentSettings: React.FC = () => {
  const canConfigure = usePermission(Permission.AGENT_CONFIGURE);
  const navigate = useNavigate();
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
    const option = availableModels.find((m) => m.key === pendingChanges[role]);
    if (!option) return;

    setSaving(true);
    try {
      await apiClient.patch(`/models/${role}`, { model: option.id, ...(option.providerId && { providerId: option.providerId }) });
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

  const groupedModels = Object.entries(
    availableModels.reduce<Record<string, AvailableModel[]>>((groups, model) => {
      (groups[model.provider] ??= []).push(model);
      return groups;
    }, {})
  );

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
        const model = availableModels.find((m) => m.key === optionKey(record.modelRouteConfig));
        return (
          <Space direction="vertical" size={2}>
            <Text style={{ color: '#e6edf3' }}>{model?.name || modelId}</Text>
            <Tag color="geekblue" style={{ fontSize: 11 }}>
              {model?.provider || record.modelRouteConfig?.provider || 'unknown'}
            </Tag>
          </Space>
        );
      },
    },
    {
      title: 'Switch Model',
      key: 'switchModel',
      render: (_: any, record: AgentModel) => {
        const currentValue = pendingChanges[record.role] || optionKey(record.modelRouteConfig);
        const hasChanged = !!pendingChanges[record.role];

        return (
          <Space>
            <Select
              style={{ width: 320 }}
              disabled={!canConfigure}
              value={currentValue}
              onChange={(val) => handleModelChange(record.role, val)}
              placeholder="Select a model"
              showSearch
              optionFilterProp="label"
            >
              {groupedModels.map(([provider, models]) => (
                <Select.OptGroup key={provider} label={provider}>
                  {models.map((model) => (
                    <Select.Option key={model.key} value={model.key} label={`${model.name} ${model.id} ${provider}`}>
                      <Space>
                        <Text>{model.name}</Text>
                        <Tag color={CATEGORY_COLORS[model.category] || 'default'} style={{ fontSize: 10 }}>
                          {model.category}
                        </Tag>
                      </Space>
                    </Select.Option>
                  ))}
                </Select.OptGroup>
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
        <Space>
          {canConfigure && (
            <Button icon={<CloudServerOutlined />} onClick={() => navigate('/providers')}>
              Manage providers & models
            </Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={fetchData}>
            Refresh
          </Button>
        </Space>
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
