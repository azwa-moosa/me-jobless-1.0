import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approveBatch, buildAuditEvent, registerBatch, resolveIssue, supersedeBatch, unresolvedBlocking, validateDataset, verifyAuditChain, WorkflowError, sha256 } from '../packages/schemas/src/index.ts';
import type { AuditEvent, Batch } from '../packages/schemas/src/index.ts';
import { cleanStaff, golden, org, PERIOD } from './helpers.ts';

const admin = { id: 'u-hr-admin', role: 'HR_ANALYTICS_ADMIN' };
const allow = () => true, deny = () => false;
const AT = '2026-09-29T10:00:00Z';

function batchFor(file: string, dataset: 'attendance' | 'overtime' = 'attendance'): Batch {
  const { snapshot } = cleanStaff();
  const text = golden(file);
  const result = validateDataset(dataset, text, { period: PERIOD, org, staff: snapshot });
  return registerBatch({ id: 'b1', periodId: PERIOD, version: 1, rawText: text, result }).batch;
}

test('clean batch approves; approved batch is frozen and cannot be resolved/edited', () => {
  const { batch, audit } = approveBatch(batchFor('attendance.csv'), admin, allow, AT, { staffApproved: true });
  assert.equal(batch.status, 'APPROVED');
  assert.equal(audit.action, 'upload.approve');
  assert.throws(() => { (batch as { status: string }).status = 'VALIDATED'; }, TypeError);
  assert.throws(() => resolveIssue(batch, 'b1:1', { reason: 'long enough reason' }, admin, allow, AT), (e: unknown) => e instanceof WorkflowError && e.code === 'BATCH_IMMUTABLE');
});

test('approval blocked while blocking issues are unresolved; error is understandable', () => {
  const b = batchFor('attendance_errors.csv');
  assert.ok(unresolvedBlocking(b).length > 0);
  assert.throws(() => approveBatch(b, admin, allow, AT, { staffApproved: true }), (e: unknown) => e instanceof WorkflowError && e.code === 'BLOCKING_ISSUES' && /unresolved blocking/.test(e.message));
});

test('non-staff batch cannot be approved before the staff snapshot', () => {
  assert.throws(() => approveBatch(batchFor('attendance.csv'), admin, allow, AT, { staffApproved: false }), (e: unknown) => e instanceof WorkflowError && e.code === 'STAFF_NOT_APPROVED');
});

test('unauthorised actor cannot approve or override', () => {
  assert.throws(() => approveBatch(batchFor('attendance.csv'), admin, deny, AT, { staffApproved: true }), (e: unknown) => e instanceof WorkflowError && e.code === 'FORBIDDEN');
  const b = batchFor('attendance_errors.csv');
  assert.throws(() => resolveIssue(b, b.issues[0].id, { reason: 'long enough reason' }, admin, deny, AT), (e: unknown) => e instanceof WorkflowError && e.code === 'FORBIDDEN');
});

test('hard blocking rules cannot be overridden (fix and re-upload)', () => {
  const b = batchFor('attendance_errors.csv');
  const neg = b.issues.find((i) => i.code === 'NEGATIVE_VALUE')!;
  assert.throws(() => resolveIssue(b, neg.id, { reason: 'trust me it is fine' }, admin, allow, AT), (e: unknown) => e instanceof WorkflowError && e.code === 'NOT_OVERRIDABLE');
});

test('unknown UID: blocking until formally resolved with reason AND reference; warnings need reason', () => {
  let b = batchFor('attendance_errors.csv');
  const unk = b.issues.find((i) => i.code === 'UNKNOWN_UID')!;
  assert.throws(() => resolveIssue(b, unk.id, { reason: 'short' }, admin, allow, AT), (e: unknown) => e instanceof WorkflowError && e.code === 'REASON_REQUIRED');
  assert.throws(() => resolveIssue(b, unk.id, { reason: 'Employee on Staff master v2, ticket open' }, admin, allow, AT), (e: unknown) => e instanceof WorkflowError && e.code === 'REFERENCE_REQUIRED');
  const r = resolveIssue(b, unk.id, { reason: 'New joiner confirmed by HRIS team', reference: 'HR-TKT-0001' }, admin, allow, AT);
  b = r.batch;
  assert.equal(b.issues.find((i) => i.id === unk.id)!.resolution?.kind, 'FORMALLY_RESOLVED');
  assert.equal(r.audit.action, 'validation.override');
  assert.equal(r.audit.details.reference, 'HR-TKT-0001');
  const warn = b.issues.find((i) => i.severity === 'WARNING')!;
  const w = resolveIssue(b, warn.id, { reason: 'Reviewed, balance carried forward' }, admin, allow, AT);
  assert.equal(w.batch.issues.find((i) => i.id === warn.id)!.resolution?.kind, 'ACKNOWLEDGED');
});

test('a batch with only a formally resolved unknown UID and acknowledged warnings can be approved', () => {
  const text = 'period,uid,ot_hours,ot_cost\n2026-09,U001,5,250\n2026-09,U777,5,250\n2026-09,U002,250,12500\n';
  const { snapshot } = cleanStaff();
  const result = validateDataset('overtime', text, { period: PERIOD, org, staff: snapshot });
  let b = registerBatch({ id: 'b2', periodId: PERIOD, version: 1, rawText: text, result }).batch;
  for (const i of b.issues) b = resolveIssue(b, i.id, { reason: 'Reviewed and accepted by HR', reference: 'HR-TKT-0002' }, admin, allow, AT).batch;
  assert.equal(approveBatch(b, admin, allow, AT, { staffApproved: true }).batch.status, 'APPROVED');
});

test('corrections create a new version: approved batch superseded, never mutated', () => {
  const { batch } = approveBatch(batchFor('attendance.csv'), admin, allow, AT, { staffApproved: true });
  const { superseded, audit } = supersedeBatch(batch, admin, allow, 'HR corrected leave balances for U003');
  assert.equal(superseded.status, 'SUPERSEDED');
  assert.equal(batch.status, 'APPROVED');
  assert.equal(audit.action, 'batch.supersede');
});

test('idempotent processing: same file twice => identical issues, checksum and snapshot hash', () => {
  const a = batchFor('overtime.csv', 'overtime'), b = batchFor('overtime.csv', 'overtime');
  assert.equal(a.snapshotHash, b.snapshotHash);
  assert.equal(a.checksum, b.checksum);
  assert.equal(a.checksum, sha256(golden('overtime.csv')));
  assert.deepEqual(a.issues, b.issues);
  const approvedA = approveBatch(a, admin, allow, AT, { staffApproved: true }).batch, approvedB = approveBatch(b, admin, allow, AT, { staffApproved: true }).batch;
  assert.deepEqual(approvedA, approvedB);
});

test('changed content changes the snapshot hash', () => {
  const { snapshot } = cleanStaff();
  const t1 = golden('overtime.csv'), t2 = t1.replace('10.0,500.00', '11.0,550.00');
  const h = (t: string) => registerBatch({ id: 'x', periodId: PERIOD, version: 1, rawText: t, result: validateDataset('overtime', t, { period: PERIOD, org, staff: snapshot }) }).batch.snapshotHash;
  assert.notEqual(h(t1), h(t2));
});

test('audit chain: append-only, tamper-evident, whitelisted details, no employee data', () => {
  const a1 = buildAuditEvent(null, { action: 'upload.create', actorId: 'u1', actorRole: 'HR_ANALYTICS_ADMIN', periodId: PERIOD, batchId: 'b1', details: { dataset: 'staff', rowCount: 9, checksum: 'abc' } }, AT);
  const a2 = buildAuditEvent(a1, { action: 'validation.override', actorId: 'u1', actorRole: 'HR_ANALYTICS_ADMIN', periodId: PERIOD, batchId: 'b1', details: { code: 'UNKNOWN_UID', reason: 'Confirmed by HRIS', reference: 'T-1' } }, AT);
  const chain: AuditEvent[] = [a1, a2];
  assert.equal(verifyAuditChain(chain), true);
  assert.equal(verifyAuditChain([{ ...a1, actorId: 'evil' }, a2]), false);
  assert.equal(verifyAuditChain([a2]), false);
  for (const bad of [{ uid: 'U001' }, { full_name: 'X' }, { dob: '1990-01-01' }, { rows: ['U1'] as never }, { reason: 'x'.repeat(501) }]) {
    assert.throws(() => buildAuditEvent(null, { action: 'upload.create', actorId: 'u', actorRole: 'r', periodId: null, batchId: null, details: bad as never }, AT));
  }
});
