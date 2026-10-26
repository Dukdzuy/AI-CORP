import React, { useEffect, useMemo, useRef } from 'react';
import { Alert, Form, InputNumber, Input, Select, Skeleton, Space, Switch, Tag, Typography } from 'antd';
import { ApartmentOutlined, BranchesOutlined } from '@ant-design/icons';
import { WorkflowTemplateParameter } from '@ai-corp/shared-types';
import { useTemplatePreview, useWorkflowTemplates } from '../../lib/api/hooks/workflows';
import { parameterDefaults, templateOutline } from './templateOutline';

const { Text } = Typography;
const INK = { primary: '#e6edf3', secondary: '#8b949e' };
const field: React.CSSProperties = { background: '#0d1117', borderColor: '#30363d' };

/** Value of the "no template" option: the platform's default workflow */
export const DEFAULT_WORKFLOW = '__default__';
export const DEFAULT_TEMPLATE_ID = 'ooad-software-project';

const ParameterInput: React.FC<{ param: WorkflowTemplateParameter }> = ({ param }) => {
  const label = <Text style={{ color: INK.secondary }}>{param.label}</Text>;
  const common = { name: ['templateParams', param.name], label, tooltip: param.description, style: { marginBottom: 12 } };
  switch (param.type) {
    case 'boolean':
      return <Form.Item {...common} valuePropName="checked"><Switch /></Form.Item>;
    case 'number':
      return <Form.Item {...common} rules={[{ required: param.required }]}><InputNumber min={param.min} max={param.max} style={{ ...field, width: 120 }} /></Form.Item>;
    case 'enum':
      return (
        <Form.Item {...common} rules={[{ required: param.required }]}>
          <Select options={(param.options || []).map(o => ({ value: o, label: o }))} style={{ width: 200 }} />
        </Form.Item>
      );
    default:
      return <Form.Item {...common} rules={[{ required: param.required }]}><Input style={field} /></Form.Item>;
  }
};

/**
 * Workflow choice for a new project (Task 19): template, its parameters, and a preview of the
 * nodes it will run with sub-workflows and parallel branches expanded. Lives inside the create form
 * and writes `templateId` and `templateParams`.
 */
export const TemplatePicker: React.FC = () => {
  const form = Form.useFormInstance();
  const { data: templates = [], isLoading } = useWorkflowTemplates();
  const templateId: string | undefined = Form.useWatch('templateId', form);
  const rawParams = Form.useWatch('templateParams', form);
  const params = rawParams || {};
  const template = templates.find(t => t.id === templateId);
  const shownTemplate = useRef<string | undefined>();

  // Fill in the template's defaults when the template changes or the form was reset
  useEffect(() => {
    if (!template) return;
    if (shownTemplate.current !== template.id || rawParams === undefined) {
      shownTemplate.current = template.id;
      form.setFieldValue('templateParams', parameterDefaults(template.parameters));
    }
  }, [template, rawParams, form]);

  const previewParams = useMemo(() => (template ? { ...parameterDefaults(template.parameters), ...params } : {}), [template, JSON.stringify(params)]);
  const preview = useTemplatePreview(template?.id, previewParams);
  const outline = useMemo(() => (preview.data ? templateOutline(preview.data) : []), [preview.data]);

  if (isLoading) return <Skeleton active paragraph={{ rows: 1 }} />;

  return (
    <>
      <Form.Item name="templateId" label={<Text style={{ color: INK.secondary }}>Workflow</Text>} initialValue={DEFAULT_TEMPLATE_ID}>
        <Select
          options={[
            ...templates.map(t => ({ value: t.id, label: t.name })),
            { value: DEFAULT_WORKFLOW, label: 'Default workflow (no template)' },
          ]}
        />
      </Form.Item>

      {template && (
        <div style={{ border: '1px solid #30363d', borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <Text style={{ color: INK.secondary, fontSize: 12, display: 'block', marginBottom: 12 }}>{template.description}</Text>
          {template.parameters.map(p => <ParameterInput key={p.name} param={p} />)}

          <Text style={{ color: INK.primary, fontSize: 12, display: 'block', margin: '4px 0 6px' }}>Preview</Text>
          {preview.isError ? (
            <Alert type="error" showIcon message={(preview.error as any)?.response?.data?.message || 'Invalid parameters'} />
          ) : !preview.data ? (
            <Skeleton active paragraph={{ rows: 2 }} />
          ) : (
            <div aria-label="Workflow preview" style={{ background: '#0d1117', borderRadius: 6, padding: 8, maxHeight: 220, overflow: 'auto' }}>
              <Space size={4} style={{ marginBottom: 6 }}>
                <Tag color="purple">{preview.data.definition.id}@{preview.data.definition.version}</Tag>
              </Space>
              {outline.map(row => (
                <div key={row.key} style={{ paddingLeft: row.depth * 16, fontSize: 12, lineHeight: '20px', color: INK.primary }}>
                  {row.type === 'sub_workflow' && <ApartmentOutlined style={{ color: '#b37feb', marginRight: 6 }} />}
                  {row.type === 'parallel' && <BranchesOutlined style={{ color: '#4c9aff', marginRight: 6 }} />}
                  {row.label}
                  {row.role && <Text style={{ color: INK.secondary, fontSize: 11, marginLeft: 6 }}>{row.role}</Text>}
                  {!row.role && row.type !== 'agent_task' && <Text style={{ color: INK.secondary, fontSize: 11, marginLeft: 6 }}>{row.type.replace('_', ' ')}</Text>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};
