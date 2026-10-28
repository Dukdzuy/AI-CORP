import React, { useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Tooltip, Typography, message } from 'antd';
import { ApiOutlined, CloudDownloadOutlined, DeleteOutlined, EditOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Permission } from '@ai-corp/shared-types';
import { usePermission } from '../lib/permissions';
import {
  LlmModelView,
  LlmProviderView,
  ProviderInput,
  ProviderKind,
  useLlmProviderMutations,
  useLlmProviders,
  useRemoteModels,
} from '../lib/api/hooks/llmProviders';

const { Title, Text } = Typography;
const errorText = (e: any) => {
  const m = e?.response?.data?.message ?? e?.message ?? 'Request failed';
  return Array.isArray(m) ? m.join('; ') : m;
};

const CATEGORIES = ['general', 'code', 'reasoning', 'premium'];
const CATEGORY_COLORS: Record<string, string> = { general: 'blue', code: 'green', reasoning: 'purple', premium: 'gold' };

/** Common providers: picking one fills kind and base URL; everything stays editable */
const PRESETS: Array<{ label: string; name: string; kind: ProviderKind; baseUrl: string; keyHint: string }> = [
  { label: '9Router (local gateway)', name: '9Router', kind: 'openai-compatible', baseUrl: 'http://localhost:20128/v1', keyHint: 'NINE_ROUTER_API_KEY' },
  { label: 'OpenAI', name: 'OpenAI', kind: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', keyHint: 'sk-...' },
  { label: 'OpenRouter', name: 'OpenRouter', kind: 'openai-compatible', baseUrl: 'https://openrouter.ai/api/v1', keyHint: 'sk-or-...' },
  { label: 'Groq', name: 'Groq', kind: 'openai-compatible', baseUrl: 'https://api.groq.com/openai/v1', keyHint: 'gsk_...' },
  { label: 'DeepSeek', name: 'DeepSeek', kind: 'openai-compatible', baseUrl: 'https://api.deepseek.com/v1', keyHint: 'sk-...' },
  { label: 'Google Gemini (OpenAI API)', name: 'Gemini', kind: 'openai-compatible', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', keyHint: 'AIza...' },
  { label: 'Ollama (local)', name: 'Ollama', kind: 'openai-compatible', baseUrl: 'http://localhost:11434/v1', keyHint: 'not needed' },
  { label: 'Anthropic', name: 'Anthropic', kind: 'anthropic', baseUrl: 'https://api.anthropic.com', keyHint: 'sk-ant-...' },
  { label: 'Other OpenAI-compatible', name: '', kind: 'openai-compatible', baseUrl: '', keyHint: '' },
];

const KIND_LABELS: Record<ProviderKind, string> = { 'openai-compatible': 'OpenAI-compatible', anthropic: 'Anthropic' };

/**
 * LLM providers and their models. Admins add a provider (base URL + API key, stored
 * encrypted on the server), pick models from the provider's own list or type one in,
 * then choose them per agent on the Agent Models page.
 */
export const LlmProvidersPage: React.FC = () => {
  const canConfigure = usePermission(Permission.AGENT_CONFIGURE);
  const { data: providers = [], isLoading, error } = useLlmProviders();
  const m = useLlmProviderMutations();
  const [editing, setEditing] = useState<LlmProviderView | 'new' | null>(null);
  const [browsing, setBrowsing] = useState<LlmProviderView | null>(null);
  const [adding, setAdding] = useState<LlmProviderView | null>(null);

  const runTest = (p: LlmProviderView) => {
    const hide = message.loading(`Testing ${p.name}…`, 0);
    m.test.mutate(p.id, {
      onSuccess: r => {
        hide();
        if (r.ok) message.success(`${p.name}: connected, ${r.modelCount} model(s) available (${r.latencyMs} ms)`);
        else message.error(`${p.name}: ${r.error}`, 6);
      },
      onError: e => { hide(); message.error(errorText(e)); },
    });
  };

  const columns = [
    {
      title: 'Provider',
      key: 'name',
      render: (_: unknown, p: LlmProviderView) => (
        <Space direction="vertical" size={0}>
          <Text strong>{p.name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{KIND_LABELS[p.kind]} · {p.baseUrl || 'default URL'}</Text>
        </Space>
      ),
    },
    {
      title: 'API key',
      key: 'key',
      width: 130,
      render: (_: unknown, p: LlmProviderView) => (p.hasApiKey ? <Text code>{p.apiKeyHint}</Text> : <Text type="secondary">none</Text>),
    },
    {
      title: 'Models',
      key: 'models',
      width: 110,
      render: (_: unknown, p: LlmProviderView) => `${p.models.filter(x => x.isEnabled).length} / ${p.models.length}`,
    },
    {
      title: 'Used by',
      dataIndex: 'usedBy',
      key: 'usedBy',
      render: (roles: string[]) => (roles.length ? <Space size={[4, 4]} wrap>{roles.map(r => <Tag key={r}>{r}</Tag>)}</Space> : <Text type="secondary">—</Text>),
    },
    {
      title: 'Enabled',
      key: 'enabled',
      width: 90,
      render: (_: unknown, p: LlmProviderView) => (
        <Switch
          size="small"
          checked={p.isEnabled}
          disabled={!canConfigure}
          loading={m.update.isPending && m.update.variables?.id === p.id}
          onChange={isEnabled => m.update.mutate({ id: p.id, isEnabled }, { onError: e => message.error(errorText(e)) })}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 240,
      render: (_: unknown, p: LlmProviderView) => (
        <Space size={4}>
          <Tooltip title="Check the URL and API key"><Button size="small" icon={<ThunderboltOutlined />} onClick={() => runTest(p)}>Test</Button></Tooltip>
          <Tooltip title="Pick models from the provider's list"><Button size="small" icon={<CloudDownloadOutlined />} disabled={!canConfigure} onClick={() => setBrowsing(p)}>Fetch models</Button></Tooltip>
          <Button size="small" icon={<EditOutlined />} disabled={!canConfigure} onClick={() => setEditing(p)} />
          <Popconfirm
            title={`Delete ${p.name} and its models?`}
            disabled={!canConfigure}
            onConfirm={() => m.remove.mutate(p.id, { onSuccess: () => message.success(`${p.name} deleted`), onError: e => message.error(errorText(e)) })}
          >
            <Button size="small" danger icon={<DeleteOutlined />} disabled={!canConfigure || p.usedBy.length > 0} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>LLM Providers</Title>
          <Text style={{ color: '#8b949e' }}>
            Connect LLM providers and choose which of their models agents may use. API keys are encrypted on the server and never shown again.
          </Text>
        </div>
        {canConfigure && <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>Add provider</Button>}
      </div>

      {error && <Alert type="error" showIcon message={errorText(error)} style={{ marginBottom: 16 }} />}

      <Card>
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={providers}
          columns={columns}
          pagination={false}
          locale={{ emptyText: <Empty description="No provider yet. Add 9Router, OpenAI, OpenRouter… to give agents models." /> }}
          expandable={{
            expandedRowRender: p => <ModelsTable provider={p} canConfigure={canConfigure} onAdd={() => setAdding(p)} onBrowse={() => setBrowsing(p)} />,
            rowExpandable: () => true,
          }}
        />
      </Card>

      {editing && <ProviderModal provider={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {browsing && <RemoteModelsModal provider={providers.find(p => p.id === browsing.id) ?? browsing} onClose={() => setBrowsing(null)} />}
      {adding && <AddModelModal provider={adding} onClose={() => setAdding(null)} />}
    </div>
  );
};

const ModelsTable: React.FC<{ provider: LlmProviderView; canConfigure: boolean; onAdd: () => void; onBrowse: () => void }> = ({ provider, canConfigure, onAdd, onBrowse }) => {
  const m = useLlmProviderMutations();
  const onError = (e: unknown) => message.error(errorText(e));

  const columns = [
    {
      title: 'Model',
      key: 'model',
      render: (_: unknown, x: LlmModelView) => (
        <Space direction="vertical" size={0}>
          <Text>{x.displayName}</Text>
          {x.displayName !== x.modelId && <Text type="secondary" style={{ fontSize: 11 }} code>{x.modelId}</Text>}
        </Space>
      ),
    },
    {
      title: 'Category',
      key: 'category',
      width: 150,
      render: (_: unknown, x: LlmModelView) => (
        <Select
          size="small"
          style={{ width: 120 }}
          value={x.category}
          disabled={!canConfigure}
          options={CATEGORIES.map(c => ({ value: c, label: <Tag color={CATEGORY_COLORS[c]}>{c}</Tag> }))}
          onChange={category => m.updateModel.mutate({ id: provider.id, modelId: x.id, category }, { onError })}
        />
      ),
    },
    { title: 'Source', dataIndex: 'source', key: 'source', width: 90, render: (s: string) => <Tag>{s === 'synced' ? 'fetched' : 'manual'}</Tag> },
    {
      title: 'Enabled',
      key: 'enabled',
      width: 90,
      render: (_: unknown, x: LlmModelView) => (
        <Switch size="small" checked={x.isEnabled} disabled={!canConfigure} onChange={isEnabled => m.updateModel.mutate({ id: provider.id, modelId: x.id, isEnabled }, { onError })} />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_: unknown, x: LlmModelView) => (
        <Popconfirm title={`Remove ${x.modelId}?`} disabled={!canConfigure} onConfirm={() => m.removeModel.mutate({ id: provider.id, modelId: x.id }, { onError })}>
          <Button size="small" type="text" danger icon={<DeleteOutlined />} disabled={!canConfigure} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: '4px 0' }}>
      <Space style={{ marginBottom: 8 }}>
        <Button size="small" icon={<PlusOutlined />} disabled={!canConfigure} onClick={onAdd}>Add model by id</Button>
        <Button size="small" icon={<CloudDownloadOutlined />} disabled={!canConfigure} onClick={onBrowse}>Fetch from {provider.name}</Button>
      </Space>
      <Table size="small" rowKey="id" dataSource={provider.models} columns={columns} pagination={provider.models.length > 10 ? { pageSize: 10, size: 'small' } : false} />
    </div>
  );
};

const ProviderModal: React.FC<{ provider: LlmProviderView | null; onClose: () => void }> = ({ provider, onClose }) => {
  const [form] = Form.useForm();
  const m = useLlmProviderMutations();
  const [keyHint, setKeyHint] = useState('');
  const isNew = !provider;
  const saving = m.create.isPending || m.update.isPending;

  const applyPreset = (label: string) => {
    const preset = PRESETS.find(p => p.label === label);
    if (!preset) return;
    form.setFieldsValue({ name: preset.name || form.getFieldValue('name'), kind: preset.kind, baseUrl: preset.baseUrl });
    setKeyHint(preset.keyHint);
  };

  const submit = (values: ProviderInput & { clearApiKey?: boolean }) => {
    const body: ProviderInput = { name: values.name, kind: values.kind, baseUrl: values.baseUrl?.trim() ?? '' };
    if (values.apiKey) body.apiKey = values.apiKey;
    if (!isNew && values.clearApiKey) body.clearApiKey = true;
    const done = (p: LlmProviderView) => {
      message.success(isNew ? `${p.name} added. Fetch its models next.` : `${p.name} saved`);
      onClose();
    };
    if (isNew) m.create.mutate(body, { onSuccess: done, onError: e => message.error(errorText(e)) });
    else m.update.mutate({ id: provider!.id, ...body }, { onSuccess: done, onError: e => message.error(errorText(e)) });
  };

  return (
    <Modal title={isNew ? 'Add provider' : `Edit ${provider!.name}`} open onCancel={onClose} onOk={() => form.submit()} okText={isNew ? 'Add' : 'Save'} confirmLoading={saving} destroyOnClose>
      <Form
        form={form}
        layout="vertical"
        onFinish={submit}
        initialValues={provider ? { name: provider.name, kind: provider.kind, baseUrl: provider.baseUrl ?? '' } : { kind: 'openai-compatible' }}
      >
        {isNew && (
          <Form.Item label="Preset">
            <Select placeholder="Start from a known provider (optional)" options={PRESETS.map(p => ({ value: p.label, label: p.label }))} onChange={applyPreset} />
          </Form.Item>
        )}
        <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true, max: 60 }]}>
          <Input placeholder="e.g. OpenRouter" />
        </Form.Item>
        <Form.Item name="kind" label="API type" rules={[{ required: true }]}>
          <Select options={(Object.keys(KIND_LABELS) as ProviderKind[]).map(k => ({ value: k, label: KIND_LABELS[k] }))} />
        </Form.Item>
        <Form.Item name="baseUrl" label="Base URL" extra="Empty uses the API type's default (api.openai.com / api.anthropic.com)" rules={[{ type: 'url', message: 'An http(s) URL' }]}>
          <Input placeholder="https://openrouter.ai/api/v1" />
        </Form.Item>
        <Form.Item
          name="apiKey"
          label="API key"
          extra={provider?.hasApiKey ? `Stored key ${provider.apiKeyHint}. Leave empty to keep it.` : 'Stored encrypted on the server; it is never shown again.'}
        >
          <Input.Password placeholder={keyHint || (provider?.hasApiKey ? 'unchanged' : 'paste the key')} autoComplete="new-password" />
        </Form.Item>
        {provider?.hasApiKey && (
          <Form.Item name="clearApiKey" valuePropName="checked" style={{ marginTop: -8 }}>
            <Switch size="small" checkedChildren="remove stored key" unCheckedChildren="keep stored key" />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

const RemoteModelsModal: React.FC<{ provider: LlmProviderView; onClose: () => void }> = ({ provider, onClose }) => {
  const { data = [], isFetching, error, refetch } = useRemoteModels(provider.id);
  const m = useLlmProviderMutations();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? data.filter(r => r.modelId.toLowerCase().includes(q) || r.displayName?.toLowerCase().includes(q)) : data;
  }, [data, search]);

  const add = (ids: string[]) => {
    const models = data.filter(r => ids.includes(r.modelId)).map(r => ({ modelId: r.modelId, displayName: r.displayName }));
    if (!models.length) return;
    m.addModels.mutate(
      { id: provider.id, models, fromProvider: true },
      {
        onSuccess: () => {
          message.success(`${models.length} model(s) added to ${provider.name}`);
          setSelected([]);
          refetch();
        },
        onError: e => message.error(errorText(e)),
      }
    );
  };

  const notAdded = rows.filter(r => !r.added).map(r => r.modelId);

  return (
    <Modal
      title={<Space><ApiOutlined />Models offered by {provider.name}</Space>}
      open
      width={760}
      onCancel={onClose}
      footer={[
        <Button key="all" disabled={!notAdded.length} loading={m.addModels.isPending} onClick={() => add(notAdded)}>Add all shown ({notAdded.length})</Button>,
        <Button key="sel" type="primary" disabled={!selected.length} loading={m.addModels.isPending} onClick={() => add(selected)}>Add selected ({selected.length})</Button>,
      ]}
    >
      {error ? (
        <Alert type="error" showIcon message="Could not fetch the model list" description={errorText(error)} action={<Button size="small" onClick={() => refetch()}>Retry</Button>} />
      ) : (
        <>
          <Input.Search allowClear placeholder="Filter, e.g. free, gpt, claude" value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 12 }} />
          <Table
            size="small"
            rowKey="modelId"
            loading={isFetching}
            dataSource={rows}
            pagination={{ pageSize: 10, size: 'small', showSizeChanger: false }}
            rowSelection={{
              selectedRowKeys: selected,
              onChange: keys => setSelected(keys as string[]),
              getCheckboxProps: r => ({ disabled: r.added }),
              preserveSelectedRowKeys: true,
            }}
            columns={[
              { title: 'Model id', dataIndex: 'modelId', key: 'modelId', render: (id: string) => <Text code>{id}</Text> },
              { title: 'Name', dataIndex: 'displayName', key: 'displayName', render: (n?: string) => n ?? <Text type="secondary">—</Text> },
              { title: '', key: 'added', width: 80, render: (_: unknown, r) => (r.added ? <Tag color="green">added</Tag> : null) },
            ]}
          />
        </>
      )}
    </Modal>
  );
};

const AddModelModal: React.FC<{ provider: LlmProviderView; onClose: () => void }> = ({ provider, onClose }) => {
  const [form] = Form.useForm();
  const m = useLlmProviderMutations();
  return (
    <Modal title={`Add a model to ${provider.name}`} open onCancel={onClose} onOk={() => form.submit()} okText="Add" confirmLoading={m.addModels.isPending} destroyOnClose>
      <Form
        form={form}
        layout="vertical"
        initialValues={{ category: 'general' }}
        onFinish={values =>
          m.addModels.mutate(
            { id: provider.id, models: [{ modelId: values.modelId.trim(), displayName: values.displayName?.trim() || undefined, category: values.category }] },
            { onSuccess: () => { message.success(`${values.modelId} added`); onClose(); }, onError: e => message.error(errorText(e)) }
          )
        }
      >
        <Form.Item name="modelId" label="Model id" extra="Exactly as the provider expects it in requests" rules={[{ required: true, whitespace: true, max: 200 }]}>
          <Input placeholder="e.g. gpt-4o-mini or openrouter/google/gemma-4-31b-it:free" />
        </Form.Item>
        <Form.Item name="displayName" label="Display name">
          <Input placeholder="optional" />
        </Form.Item>
        <Form.Item name="category" label="Category">
          <Select options={CATEGORIES.map(c => ({ value: c, label: c }))} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
