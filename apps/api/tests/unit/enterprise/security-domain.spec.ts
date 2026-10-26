import { Permission, UserRoleName } from '@ai-corp/shared-types';
import { InvalidRoleError, Principal, RolePolicy, UserRole } from '../../../src/domain/security';

const user = (role: string, id = 'u1') => ({ id, email: `${id}@x.com`, name: id, role });

describe('Phase 5 / Task 20: RBAC domain', () => {
  describe('UserRole', () => {
    it('parses known roles case-insensitively and rejects others', () => {
      expect(UserRole.fromString(' Admin ').name).toBe(UserRoleName.ADMIN);
      expect(UserRole.fromString('viewer').isAdmin()).toBe(false);
      expect(() => UserRole.fromString('agent')).toThrow(InvalidRoleError);
      expect(() => UserRole.fromString('')).toThrow(/Valid roles: admin, board_member, viewer/);
    });
  });

  describe('RolePolicy', () => {
    it('gives admin every permission', () => {
      expect([...RolePolicy.permissionsOf(UserRole.ADMIN)].sort()).toEqual(Object.values(Permission).sort());
    });

    it('keeps user, audit and agent administration away from board members', () => {
      const board = UserRole.BOARD_MEMBER;
      expect(RolePolicy.allows(board, Permission.PROJECT_CREATE)).toBe(true);
      expect(RolePolicy.allows(board, Permission.APPROVAL_GRANT)).toBe(true);
      expect(RolePolicy.allows(board, Permission.INTEGRATION_MANAGE)).toBe(true);
      for (const p of [Permission.USER_MANAGE, Permission.AUDIT_VIEW, Permission.AGENT_CONFIGURE]) {
        expect(RolePolicy.allows(board, p)).toBe(false);
      }
    });

    it('makes viewers read-only', () => {
      expect(RolePolicy.permissionsOf(UserRole.VIEWER)).toEqual([Permission.PROJECT_READ, Permission.REPORT_VIEW]);
    });

    it('describes the whole matrix for the admin UI', () => {
      const matrix = RolePolicy.matrix();
      expect(matrix.map(r => r.role)).toEqual(['admin', 'board_member', 'viewer']);
      expect(matrix[2].permissions).toHaveLength(2);
    });

    it('every permission is granted by at least one role besides admin, or is admin-only by design', () => {
      const adminOnly = Object.values(Permission).filter(p => !RolePolicy.allows(UserRole.BOARD_MEMBER, p) && !RolePolicy.allows(UserRole.VIEWER, p));
      expect(adminOnly.sort()).toEqual([Permission.AGENT_CONFIGURE, Permission.AUDIT_VIEW, Permission.USER_MANAGE].sort());
    });
  });

  describe('Principal', () => {
    it('a user principal has its role permissions', () => {
      const p = Principal.forUser(user('board_member'));
      expect(p.kind).toBe('user');
      expect(p.can(Permission.PROJECT_CREATE)).toBe(true);
      expect(p.can(Permission.AUDIT_VIEW)).toBe(false);
      expect(p.label()).toBe('u1@x.com');
    });

    it('an API-key principal gets the key scopes intersected with the owner role', () => {
      // the key was issued while the owner was a board member; the owner is now a viewer
      const p = Principal.forApiKey(user('viewer'), { id: 'k1', name: 'CI', scopes: [Permission.PROJECT_READ, Permission.PROJECT_CREATE] });
      expect(p.kind).toBe('api_key');
      expect(p.listPermissions()).toEqual([Permission.PROJECT_READ]);
      expect(p.apiKeyId).toBe('k1');
      expect(p.label()).toBe('u1@x.com (key CI)');
    });

    it('owner-or-admin rule', () => {
      expect(Principal.forUser(user('board_member', 'a')).owns('a')).toBe(true);
      expect(Principal.forUser(user('board_member', 'a')).owns('b')).toBe(false);
      expect(Principal.forUser(user('board_member', 'a')).owns(null)).toBe(false);
      expect(Principal.forUser(user('admin', 'root')).owns('b')).toBe(true);
    });
  });
});
