import { test } from 'node:test';
import assert from 'node:assert/strict';
import { permissionsFor } from '../lib/permissions.ts';

test('support can edit incidents while minors stay read only; admin always has full access', () => {
  assert.deepEqual(permissionsFor({ access_role: 'incident_editor' }), { editTasks: false, editIncidents: true, manageUsers: false });
  assert.deepEqual(permissionsFor({ access_role: 'viewer' }), { editTasks: false, editIncidents: false, manageUsers: false });
  assert.deepEqual(permissionsFor({ access_role: 'editor' }), { editTasks: true, editIncidents: true, manageUsers: false });
  assert.deepEqual(permissionsFor({ is_superadmin: true, access_role: 'viewer' }), { editTasks: true, editIncidents: true, manageUsers: true });
});
test('profile description cannot override an explicit access role', () => {
  assert.equal(permissionsFor({ access_role: 'incident_editor', role_text: 'admin' }).editTasks, false);
  assert.equal(permissionsFor({ access_role: 'viewer', role_text: '' }).editIncidents, false);
  assert.equal(permissionsFor({ role_text: 'только чтение' }).editTasks, false);
  assert.equal(permissionsFor(null).editTasks, false);
});
