import { Permission } from '@ai-corp/shared-types';
import { useAuthStore } from '../stores/authStore';

/**
 * What the signed-in user may do (Phase 5, Task 20). The API resolves the permissions from
 * the role and sends them with the user; the web app only hides what would be refused.
 * The API still checks every request.
 */
export function hasPermission(user: { permissions?: string[] } | null | undefined, permission: Permission): boolean {
  return !!user?.permissions?.includes(permission);
}

export function usePermission(permission: Permission): boolean {
  return useAuthStore(state => hasPermission(state.user, permission));
}

export const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin: { label: 'Admin', color: 'magenta' },
  board_member: { label: 'Board member', color: 'blue' },
  viewer: { label: 'Viewer', color: 'default' },
};

/** Short, readable label of a permission for the matrix and the API-key form */
export const PERMISSION_LABELS: Record<Permission, string> = {
  [Permission.PROJECT_CREATE]: 'Create projects',
  [Permission.PROJECT_READ]: 'View projects',
  [Permission.PROJECT_UPDATE]: 'Edit own projects',
  [Permission.PROJECT_DELETE]: 'Delete own projects',
  [Permission.PROJECT_EXPORT]: 'Export projects',
  [Permission.TASK_MANAGE]: 'Manage tasks & milestones',
  [Permission.WORKFLOW_CONTROL]: 'Pause / resume / roll back',
  [Permission.APPROVAL_GRANT]: 'Answer approvals',
  [Permission.AGENT_CONFIGURE]: 'Configure agent models',
  [Permission.REPORT_VIEW]: 'View reports',
  [Permission.USER_MANAGE]: 'Manage users & roles',
  [Permission.AUDIT_VIEW]: 'View audit log',
  [Permission.INTEGRATION_MANAGE]: 'API keys & webhooks',
};
