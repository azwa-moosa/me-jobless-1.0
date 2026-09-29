import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { MockAuthProvider } from '../packages/auth/src/index.ts';
import { verifyAuditChain } from '../packages/schemas/src/index.ts';
import { InMemoryRepository } from '../apps/api/src/repo.ts';
import { PlatformService } from '../apps/api/src/service.ts';
import { createApp } from '../apps/api/src/http.ts';
import { expected, golden, org } from './helpers.ts';

let server: Server, base = '';
const repo = new InMemoryRepository();
const logs: string[] = [];
let n = 0;

before(async () => {
  const svc = new PlatformService({ repo, org, now: () => '2026-09-29T10:00:00Z', newId: () => String(++n) });
  server = createApp(svc, new MockAuthProvider({ NODE_ENV: 'test' }), (l) => logs.push(l));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => { server.close(); });

async function call(user: string | null, method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(user ? { authorization: `Mock ${user}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as any };
}
const HR = 'u-hr-admin', P = 'P-2026-09';
const up = (dataset: string, file: string, extra: object = {}) => call(HR, 'POST', `/reporting-periods/${P}/uploads`, { dataset, filename: file, text: golden(file), ...extra });

test('unauthenticated requests get 401', async () => {
  assert.equal((await call(null, 'GET', '/reporting-periods')).status, 401);
  assert.equal((await call('nobody', 'GET', '/reporting-periods')).status, 401);
});

test('create period: validation, duplicates, HR-only', async () => {
  assert.equal((await call('u-dh-credit', 'POST', '/reporting-periods', { period: '2026-09' })).status, 403);
  assert.equal((await call(HR, 'POST', '/reporting-periods', { period: '2026-13' })).status, 400);
  const ok = await call(HR, 'POST', '/reporting-periods', { period: '2026-09' });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.cutoff, '2026-09-30');
  assert.equal((await call(HR, 'POST', '/reporting-periods', { period: '2026-09' })).status, 409);
});

test('attendance/OT cannot be uploaded before the staff snapshot is approved', async () => {
  const r = await up('attendance', 'attendance.csv');
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'STAFF_NOT_APPROVED');
});

test('column profiling suggests mapping and returns no cell values', async () => {
  const r = await call(HR, 'POST', '/uploads/profile', { dataset: 'staff', text: golden('staff.csv') });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.suggestion.missingRequired, []);
  assert.ok(!JSON.stringify(r.body).includes('Test Person'));
});

test('staff with errors: issues listed, approval refused (409 with understandable message), period needs validation', async () => {
  const u = await up('staff', 'staff_errors.csv');
  assert.equal(u.status, 201);
  assert.equal(u.body.batch.issues.length, 10);
  const a = await call(HR, 'POST', `/batches/${u.body.batch.id}/approve`);
  assert.equal(a.status, 409);
  assert.match(a.body.message, /unresolved blocking/);
  const periods = await call(HR, 'GET', '/reporting-periods');
  assert.equal(periods.body[0].status, 'VALIDATION_REQUIRED');
});

test('clean staff re-upload replaces the failed version; identical re-upload is idempotent', async () => {
  const u = await up('staff', 'staff.csv');
  assert.equal(u.status, 201);
  assert.equal(u.body.batch.version, 2);
  assert.equal(u.body.batch.issues.length, 0);
  const again = await up('staff', 'staff.csv');
  assert.equal(again.status, 200);
  assert.equal(again.body.deduplicated, true);
  assert.equal(again.body.batch.id, u.body.batch.id);
  const ap = await call(HR, 'POST', `/batches/${u.body.batch.id}/approve`);
  assert.equal(ap.status, 200);
  assert.equal(ap.body.status, 'APPROVED');
});

test('approved staff snapshot is immutable: re-upload refused', async () => {
  const r = await up('staff', 'staff_errors.csv');
  assert.equal(r.status, 409);
  assert.equal(r.body.error, 'BATCH_IMMUTABLE');
});

test('issue resolution rules over HTTP: hard rules cannot be overridden; unknown UID needs reason + reference; only HR may resolve', async () => {
  const u = await up('attendance', 'attendance_errors.csv');
  assert.equal(u.status, 201);
  const b = u.body.batch;
  const neg = b.issues.find((i: any) => i.code === 'NEGATIVE_VALUE'), unk = b.issues.find((i: any) => i.code === 'UNKNOWN_UID');
  const res = (user: string, id: string, body: object) => call(user, 'POST', `/batches/${b.id}/issues/${encodeURIComponent(id)}/resolve`, body);
  assert.equal((await res('u-dh-credit', unk.id, { reason: 'a long enough reason', reference: 'T-1' })).status, 403);
  assert.equal((await res(HR, neg.id, { reason: 'a long enough reason' })).status, 422);
  assert.equal((await res(HR, unk.id, { reason: 'a long enough reason' })).status, 422);
  const ok = await res(HR, unk.id, { reason: 'Confirmed as new joiner by HRIS team', reference: 'HR-TKT-9' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.issues.find((i: any) => i.id === unk.id).resolution.kind, 'FORMALLY_RESOLVED');
  assert.equal((await call(HR, 'POST', `/batches/${b.id}/approve`)).status, 409); // other blocking issues remain
});

test('full flow to READY_FOR_CALCULATION, then KPIs match the hand-verified golden results, reproducibly', async () => {
  const att = await up('attendance', 'attendance.csv');
  assert.equal(att.body.batch.issues.length, 0);
  assert.equal((await call(HR, 'POST', `/batches/${att.body.batch.id}/approve`)).status, 200);
  const ot = await up('overtime', 'overtime.csv', { control: JSON.parse(golden('overtime.control.json')) });
  assert.equal(ot.body.batch.issues.length, 0);
  assert.equal((await call(HR, 'POST', `/batches/${ot.body.batch.id}/approve`)).status, 200);
  assert.equal((await call(HR, 'GET', '/reporting-periods')).body[0].status, 'READY_FOR_CALCULATION');

  assert.equal((await call(HR, 'POST', `/periods/${P}/calculate`, {})).status, 400); // workingDays required
  const c1 = await call(HR, 'POST', `/periods/${P}/calculate`, { workingDays: 22 });
  const c2 = await call(HR, 'POST', `/periods/${P}/calculate`, { workingDays: 22 });
  assert.equal(c1.status, 200);
  assert.equal(JSON.stringify(c1.body), JSON.stringify(c2.body));
  const g = (id: string, scope = 'BANK', dim: string | null = null) => c1.body.results.find((r: any) => r.metricId === id && r.scope === scope && r.dimension === dim);
  const e = expected('metrics.json');
  assert.equal(g('WF-HEADCOUNT').value, e.headcount.total);
  assert.ok(Math.abs(g('OT-COST').value - e.overtime.total_cost) < 1e-9);
  assert.ok(Math.abs(g('ATT-ABSENCE-RATE').value - e.absence.rate) < 1e-9);
  assert.match(c1.body.notice, /PENDING HR SIGN-OFF/);
  assert.equal((await call('u-dh-credit', 'POST', `/periods/${P}/calculate`, { workingDays: 22 })).status, 403);
});

test('Division Head (Credit) over HTTP: sees only own subtree; other divisions and all HR endpoints are 403', async () => {
  const list = await call('u-dh-credit', 'GET', '/org-units');
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.map((u: any) => u.unitId).sort(), ['DEP-CR-CORP', 'DEP-CR-OLD', 'DEP-CR-RET', 'DIV-CR', 'UNIT-CR-CORP-A']);
  for (const id of ['DIV-CR', 'DEP-CR-RET']) assert.equal((await call('u-dh-credit', 'GET', `/org-units/${id}`)).status, 200);
  for (const id of ['DIV-FIN', 'DEP-FIN-CTL', 'BML']) assert.equal((await call('u-dh-credit', 'GET', `/org-units/${id}`)).status, 403, id);
  assert.equal((await call('u-dh-credit', 'GET', '/org-units/DOES-NOT-EXIST')).status, 403); // indistinguishable from out-of-scope
  for (const [m, p] of [['GET', '/reporting-periods'], ['GET', '/batches/B-1'], ['POST', '/batches/B-1/approve'], ['GET', '/audit'], ['POST', `/reporting-periods/${P}/uploads`]] as const) {
    assert.equal((await call('u-dh-credit', m, p, m === 'POST' ? {} : undefined)).status, 403, `${m} ${p}`);
  }
  const fin = await call('u-dh-finance', 'GET', '/org-units');
  assert.ok(fin.body.every((u: any) => ['BML'].concat(['DIV-FIN', 'DEP-FIN-CTL']).includes(u.unitId)));
});

test('System Admin reads audit only; audit chain is intact and contains no employee data', async () => {
  assert.equal((await call('u-sys-admin', 'GET', '/reporting-periods')).status, 403);
  const a = await call('u-sys-admin', 'GET', '/audit');
  assert.equal(a.status, 200);
  assert.equal(verifyAuditChain(a.body), true);
  const actions = new Set(a.body.map((e: any) => e.action));
  for (const x of ['period.create', 'upload.create', 'upload.validate', 'validation.override', 'upload.approve']) assert.ok(actions.has(x), x);
  const txt = JSON.stringify(a.body);
  assert.ok(!txt.includes('Test Person') && !/"U0\d\d"/.test(txt) && !txt.includes('1985-04-12'));
});

test('server logs contain no request bodies or employee data', () => {
  const txt = logs.join('\n');
  assert.ok(logs.length > 20);
  assert.ok(!txt.includes('Test Person') && !txt.includes('U001') && !txt.includes('1985'));
  assert.match(txt, /GET \/org-units\/DIV-FIN 403 user=u-dh-credit/);
});
