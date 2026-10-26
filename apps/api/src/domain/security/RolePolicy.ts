/**
 * RolePolicy (Phase 5, Task 20)
 *
 * The single source of truth for "which role may do what". Controllers declare the
 * permission an endpoint needs; they never compare role names.
 *
 *  - admin:        everything
 *  - board_member: run projects (create, update/delete their own, approve, control workflows),
 *                  export, reports and their own integrations
 *  - viewer:       read-only access to projects and reports
 *
 * @pattern Policy (Strategy over a static rule table)
 * @principle Open/Closed - a new permission is one line in the table
 */
import { Permission, UserRoleName } from '@ai-corp/shared-types';
import { UserRole } from './UserRole';

const ALL_PERMISSIONS = Object.values(Permission) as Permission[];

const ROLE_PERMISSIONS: Readonly<Record<UserRoleName, readonly Permission[]>> = Object.freeze({
  [UserRoleName.ADMIN]: ALL_PERMISSIONS,
  [UserRoleName.BOARD_MEMBER]: [
    Permission.PROJECT_CREATE,
    Permission.PROJECT_READ,
    Permission.PROJECT_UPDATE,
    Permission.PROJECT_DELETE,
    Permission.PROJECT_EXPORT,
    Permission.TASK_MANAGE,
    Permission.WORKFLOW_CONTROL,
    Permission.APPROVAL_GRANT,
    Permission.REPORT_VIEW,
    Permission.INTEGRATION_MANAGE,
  ],
  [UserRoleName.VIEWER]: [Permission.PROJECT_READ, Permission.REPORT_VIEW],
});

export class RolePolicy {
  static permissionsOf(role: UserRole): readonly Permission[] {
    return ROLE_PERMISSIONS[role.name];
  }

  static allows(role: UserRole, permission: Permission): boolean {
    return ROLE_PERMISSIONS[role.name].includes(permission);
  }

  static allPermissions(): readonly Permission[] {
    return ALL_PERMISSIONS;
  }

  /** Role x permission matrix for the admin UI */
  static matrix(): Array<{ role: UserRoleName; permissions: Permission[] }> {
    return (Object.values(UserRoleName) as UserRoleName[]).map(role => ({
      role,
      permissions: [...ROLE_PERMISSIONS[role]],
    }));
  }
}
