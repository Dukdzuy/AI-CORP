import React from 'react';
import { Card, Table, Select, Switch, Tag, Typography, Space, message, Tooltip } from 'antd';
import { CheckOutlined, TeamOutlined } from '@ant-design/icons';
import { Permission } from '@ai-corp/shared-types';
import { ManagedUser, useChangeRole, useRoleMatrix, useSetUserActive, useUsers } from '../lib/api/hooks/users';
import { PERMISSION_LABELS, ROLE_LABELS } from '../lib/permissions';
import { useAuthStore } from '../stores/authStore';

const { Title, Text } = Typography;

const errorText = (e: any) => e?.response?.data?.message || e?.message || 'Request failed';

/**
 * Users & roles (Phase 5, Task 20 — UC-008): assign a role, revoke access, and the
 * role × permission matrix the API enforces. Admin only.
 */
export const UsersPage: React.FC = () => {
  const me = useAuthStore(s => s.user);
  const { data: users = [], isLoading } = useUsers();
  const { data: matrix } = useRoleMatrix();
  const changeRole = useChangeRole();
  const setActive = useSetUserActive();

  const columns = [
    {
      title: 'User',
      key: 'user',
      render: (_: unknown, u: ManagedUser) => (
        <Space direction="vertical" size={0}>
          <Text strong>{u.name}{u.id === me?.id && <Tag style={{ marginLeft: 8 }}>you</Tag>}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{u.email}</Text>
        </Space>
      ),
    },
    {
      title: 'Role',
      key: 'role',
      width: 200,
      render: (_: unknown, u: ManagedUser) => (
        <Select
          value={u.role}
          style={{ width: 170 }}
          disabled={u.id === me?.id}
          loading={changeRole.isPending && changeRole.variables?.id === u.id}
          options={Object.entries(ROLE_LABELS).map(([value, r]) => ({ value, label: r.label }))}
          onChange={role =>
            changeRole.mutate({ id: u.id, role }, {
              onSuccess: () => message.success(`${u.name} is now ${ROLE_LABELS[role]?.label ?? role}`),
              onError: e => message.error(errorText(e)),
            })
          }
        />
      ),
    },
    {
      title: 'Access',
      key: 'active',
      width: 120,
      render: (_: unknown, u: ManagedUser) => (
        <Tooltip title={u.isActive ? 'Revoking access also revokes the user\'s API keys' : 'Access revoked'}>
          <Switch
            checked={u.isActive}
            disabled={u.id === me?.id}
            checkedChildren="active"
            unCheckedChildren="revoked"
            onChange={isActive =>
              setActive.mutate({ id: u.id, isActive }, { onError: e => message.error(errorText(e)) })
            }
          />
        </Tooltip>
      ),
    },
    {
      title: 'Permissions',
      key: 'permissions',
      render: (_: unknown, u: ManagedUser) => <Text type="secondary">{u.permissions.length} of {matrix?.permissions.length ?? 13}</Text>,
    },
    { title: 'Joined', dataIndex: 'createdAt', key: 'createdAt', width: 130, render: (d: string) => new Date(d).toLocaleDateString() },
  ];

  const roles = matrix?.roles ?? [];
  const matrixRows = (matrix?.permissions ?? []).map(p => ({ key: p, permission: p }));
  const matrixColumns = [
    {
      title: 'Permission',
      dataIndex: 'permission',
      key: 'permission',
      render: (p: Permission) => (
        <Space direction="vertical" size={0}>
          <Text>{PERMISSION_LABELS[p] ?? p}</Text>
          <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>{p}</Text>
        </Space>
      ),
    },
    ...roles.map(r => ({
      title: <Tag color={ROLE_LABELS[r.role]?.color}>{ROLE_LABELS[r.role]?.label ?? r.role}</Tag>,
      key: r.role,
      align: 'center' as const,
      width: 140,
      render: (_: unknown, row: { permission: string }) =>
        r.permissions.includes(row.permission) ? <CheckOutlined style={{ color: '#52c41a' }} /> : <Text type="secondary">–</Text>,
    })),
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Title level={4} style={{ margin: 0 }}><TeamOutlined /> Users &amp; Roles</Title>
      <Card title="Users" size="small">
        <Table rowKey="id" dataSource={users} columns={columns} loading={isLoading} pagination={false} size="middle" />
      </Card>
      <Card
        title="Permission matrix"
        size="small"
        extra={<Text type="secondary">Enforced by the API on every request; project changes also require being the owner (or admin)</Text>}
      >
        <Table rowKey="key" dataSource={matrixRows} columns={matrixColumns} pagination={false} size="small" />
      </Card>
    </Space>
  );
};
