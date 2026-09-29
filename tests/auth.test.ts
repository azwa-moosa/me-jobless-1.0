import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorize, filterByScope, requirePermission, ForbiddenError, MockAuthProvider, SEEDED_USERS, PERMISSIONS, ROLES } from '../packages/auth/src/index.ts';
import type { AuthUser } from '../packages/auth/src/index.ts';
import { org } from './helpers.ts';

const user = (id: string) => SEEDED_USERS.find((u) => u.id === id) as AuthUser;
const can = (u: string, perm: string, orgUnitId?: string) => authorize(user(u), perm, orgUnitId ? { orgUnitId } : undefined, org);

test('Division Head (Credit) can view own division, its departments and units', () => {
  for (const t of ['DIV-CR', 'DEP-CR-CORP', 'DEP-CR-RET', 'UNIT-CR-CORP-A']) assert.equal(can('u-dh-credit', 'dashboard.view', t).allowed, true, t);
});

test('Division Head (Credit) CANNOT access Finance division, its department, or the Bank level', () => {
  for (const t of ['DIV-FIN', 'DEP-FIN-CTL', 'BML']) {
    const d = can('u-dh-credit', 'dashboard.view', t);
    assert.equal(d.allowed, false, t);
    assert.equal(d.reason, 'OUT_OF_SCOPE');
  }
  assert.equal(can('u-dh-credit', 'export.aggregate', 'DIV-FIN').allowed, false);
});

test('Division Head (Finance) is symmetrically isolated from Credit', () => {
  assert.equal(can('u-dh-finance', 'dashboard.view', 'DIV-FIN').allowed, true);
  assert.equal(can('u-dh-finance', 'dashboard.view', 'DEP-CR-RET').allowed, false);
});

test('row-level filter never returns another division rows', () => {
  const facts = [{ id: 1, org: 'DEP-CR-RET' }, { id: 2, org: 'DEP-FIN-CTL' }, { id: 3, org: 'UNIT-CR-CORP-A' }, { id: 4, org: 'DIV-FIN' }];
  const visible = filterByScope(user('u-dh-credit'), 'dashboard.view', facts, (f) => f.org, org);
  assert.deepEqual(visible.map((f) => f.id), [1, 3]);
});

test('Division Head has no upload/approve/override/issue/employee-level/ER/admin rights, even in own division', () => {
  for (const p of ['upload.create', 'upload.approve', 'validation.override', 'issues.view', 'employee.detail.view', 'er.employee_level.view', 'er.aggregate.view', 'export.employee_level', 'admin.access', 'metric.config.edit', 'period.create']) {
    assert.equal(can('u-dh-credit', p, 'DIV-CR').allowed, false, p);
  }
});

test('Department Head is limited to own department', () => {
  assert.equal(can('u-dept-retail', 'dashboard.view', 'DEP-CR-RET').allowed, true);
  assert.equal(can('u-dept-retail', 'dashboard.view', 'DEP-CR-CORP').allowed, false);
  assert.equal(can('u-dept-retail', 'dashboard.view', 'DIV-CR').allowed, false);
});

test('only HR Analytics Admin may upload / override / approve; ER employee data only for ER_RESTRICTED', () => {
  for (const p of ['upload.create', 'validation.override', 'upload.approve']) {
    for (const r of ROLES) {
      const u = SEEDED_USERS.find((x) => x.role === r && x.scopes.length > 0);
      if (!u) continue;
      assert.equal(authorize(u, p, { orgUnitId: 'BML' }, org).allowed, r === 'HR_ANALYTICS_ADMIN', `${p} ${r}`);
    }
  }
  assert.equal(can('u-er', 'er.employee_level.view', 'DIV-CR').allowed, true);
  assert.equal(can('u-hr-admin', 'er.employee_level.view', 'DIV-CR').allowed, false);
  assert.equal(can('u-hr-lead', 'er.employee_level.view', 'DIV-CR').allowed, false);
});

test('employee-level export is HR-only; System Admin has no business data access', () => {
  assert.equal(can('u-hr-admin', 'export.employee_level', 'BML').allowed, true);
  for (const u of ['u-hr-lead', 'u-dh-credit', 'u-readonly', 'u-er', 'u-sys-admin']) assert.equal(can(u, 'export.employee_level', 'BML').allowed, false, u);
  for (const p of PERMISSIONS.filter((x) => x.dataLevel !== 'METADATA' && x.scoped)) assert.equal(can('u-sys-admin', p.permission, 'BML').allowed, false, p.permission);
  assert.equal(can('u-sys-admin', 'admin.access').allowed, true);
});

test('fail closed: unknown permission, unknown org, missing target, no user, no scope', () => {
  assert.equal(can('u-hr-admin', 'made.up').reason, 'UNKNOWN_PERMISSION');
  assert.equal(can('u-hr-admin', 'dashboard.view', 'NOPE').reason, 'UNKNOWN_ORG');
  assert.equal(can('u-hr-admin', 'dashboard.view').reason, 'TARGET_REQUIRED');
  assert.equal(authorize(null, 'dashboard.view', { orgUnitId: 'BML' }, org).allowed, false);
  const noScope: AuthUser = { id: 'x', displayName: 'x', role: 'HR_LEADERSHIP', scopes: [] };
  assert.equal(authorize(noScope, 'dashboard.view', { orgUnitId: 'BML' }, org).reason, 'NO_SCOPE');
});

test('requirePermission throws ForbiddenError (what controllers turn into HTTP 403)', () => {
  assert.throws(() => requirePermission(user('u-dh-credit'), 'dashboard.view', { orgUnitId: 'DIV-FIN' }, org), ForbiddenError);
  assert.doesNotThrow(() => requirePermission(user('u-dh-credit'), 'dashboard.view', { orgUnitId: 'DIV-CR' }, org));
});

test('mock auth provider: works locally, refuses production, unknown users get null', async () => {
  const p = new MockAuthProvider({ NODE_ENV: 'development' });
  assert.equal((await p.authenticate({ authorization: 'Mock u-dh-credit' }))?.role, 'DIVISION_HEAD');
  assert.equal(await p.authenticate({ authorization: 'Mock nobody' }), null);
  assert.equal(await p.authenticate({}), null);
  assert.throws(() => new MockAuthProvider({ NODE_ENV: 'production' }));
});
