import React from 'react';
import { Result } from 'antd';
import { Permission } from '@ai-corp/shared-types';
import { usePermission } from '../../lib/permissions';

/** Shows the page only to users with the permission (Phase 5); the API enforces it as well */
export const RequirePermission: React.FC<{ permission: Permission; children: React.ReactNode }> = ({ permission, children }) => {
  const allowed = usePermission(permission);
  if (!allowed) return <Result status="403" title="Not allowed" subTitle={`Your role does not have the '${permission}' permission.`} />;
  return <>{children}</>;
};
