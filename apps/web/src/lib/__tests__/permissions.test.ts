import { describe, expect, it } from 'vitest';
import { Permission } from '@ai-corp/shared-types';
import { PERMISSION_LABELS, ROLE_LABELS, hasPermission } from '../permissions';
import { describeChanges } from '../../pages/auditFormat';

describe('permissions (Phase 5)', () => {
  it('checks the permission list the API sent', () => {
    const viewer = { permissions: ['project:read', 'report:view'] };
    expect(hasPermission(viewer, Permission.PROJECT_READ)).toBe(true);
    expect(hasPermission(viewer, Permission.PROJECT_CREATE)).toBe(false);
    expect(hasPermission(null, Permission.PROJECT_READ)).toBe(false);
    expect(hasPermission({}, Permission.PROJECT_READ)).toBe(false);
  });

  it('has a label for every permission and role', () => {
    expect(Object.keys(PERMISSION_LABELS).sort()).toEqual(Object.values(Permission).sort());
    expect(Object.keys(ROLE_LABELS)).toEqual(['admin', 'board_member', 'viewer']);
  });
});

describe('audit change view (Phase 5)', () => {
  it('shows a field diff as before/after rows', () => {
    expect(describeChanges({ diff: [{ field: 'budget', from: 5, to: 12 }, { field: 'name', from: null, to: { a: 1 } }] })).toEqual({
      kind: 'diff',
      rows: [{ field: 'budget', from: '5', to: '12' }, { field: 'name', from: '—', to: '{"a":1}' }],
    });
  });

  it('falls back to the raw request, and says when nothing changed', () => {
    expect(describeChanges({ diff: [] })).toEqual({ kind: 'raw', text: 'No field changed.' });
    expect(describeChanges({ request: { name: 'x' } })).toEqual({ kind: 'raw', text: '{\n  "request": {\n    "name": "x"\n  }\n}' });
  });
});
