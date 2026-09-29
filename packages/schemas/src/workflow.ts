// Upload batch lifecycle: VALIDATED -> (resolve/override with reason + audit) -> APPROVED (immutable).
// Authorisation is injected as `guard` so this module has no dependency on the auth package; the API layer
// MUST build guard from server-side authorize() (see apps/api).
import { createHash } from 'node:crypto';
import type { AuditInput } from './audit.ts';
import { RULE_BY_CODE } from './rules.ts';
import type { Issue } from './validate.ts';
import type { ValidationResult } from './validate.ts';

export type BatchStatus = 'VALIDATED' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED';
export interface Resolution { kind: 'ACKNOWLEDGED' | 'FORMALLY_RESOLVED'; reason: string; reference: string | null; actorId: string; at: string }
export interface IssueRecord extends Issue { id: string; resolution: Resolution | null }
export interface Batch {
  id: string; periodId: string; dataset: string; version: number; status: BatchStatus;
  checksum: string; snapshotHash: string; schemaVersion: string; rowCount: number; issues: IssueRecord[];
  approvedBy?: string; approvedAt?: string;
}
export interface Actor { id: string; role: string }
export type Guard = (permission: string) => boolean;
export class WorkflowError extends Error { code: string; constructor(code: string, message: string) { super(message); this.code = code; } }

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const canon = (o: unknown): string => JSON.stringify(o, (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v));

/** Deterministic hash of the validated content: same file + same mapping + same schema => same hash. */
export const snapshotHash = (r: ValidationResult) => sha256(canon({ d: r.dataset, s: r.schemaVersion, m: r.mapping, rec: r.records }));

export function registerBatch(args: { id: string; periodId: string; version: number; rawText: string; result: ValidationResult }): { batch: Batch; audit: AuditInput[] } {
  const { id, periodId, version, rawText, result } = args;
  const batch: Batch = {
    id, periodId, dataset: result.dataset, version, status: 'VALIDATED', checksum: sha256(rawText), snapshotHash: snapshotHash(result),
    schemaVersion: result.schemaVersion, rowCount: result.rowCount,
    issues: result.issues.map((i, n) => ({ ...i, value: i.value, id: `${id}:${n + 1}`, resolution: null })),
  };
  return { batch, audit: [] };
}

const isResolved = (i: IssueRecord) => i.resolution !== null;
export const unresolvedBlocking = (b: Batch) => b.issues.filter((i) => i.severity === 'BLOCKING' && !isResolved(i));

export function resolveIssue(batch: Batch, issueId: string, input: { reason: string; reference?: string | null }, actor: Actor, guard: Guard, at: string): { batch: Batch; audit: AuditInput } {
  if (!guard('validation.override')) throw new WorkflowError('FORBIDDEN', 'Not permitted to override validation.');
  if (batch.status !== 'VALIDATED') throw new WorkflowError('BATCH_IMMUTABLE', `Batch is ${batch.status}; corrections require a new version.`);
  const issue = batch.issues.find((i) => i.id === issueId);
  if (!issue) throw new WorkflowError('NOT_FOUND', 'Issue not found.');
  if (issue.resolution) throw new WorkflowError('ALREADY_RESOLVED', 'Issue already has a resolution.');
  const rule = RULE_BY_CODE.get(issue.code)!;
  if (rule.resolution === 'FIX_AND_REUPLOAD') throw new WorkflowError('NOT_OVERRIDABLE', `${issue.code} cannot be overridden; fix the source and re-upload.`);
  const reason = (input.reason ?? '').trim();
  if (reason.length < 10) throw new WorkflowError('REASON_REQUIRED', 'A reason of at least 10 characters is required.');
  const reference = input.reference?.trim() || null;
  if (rule.resolution === 'FORMAL_RESOLUTION' && !reference) throw new WorkflowError('REFERENCE_REQUIRED', 'Formal resolution requires an approval reference.');
  const resolution: Resolution = { kind: rule.resolution === 'FORMAL_RESOLUTION' ? 'FORMALLY_RESOLVED' : 'ACKNOWLEDGED', reason, reference, actorId: actor.id, at };
  const next: Batch = { ...batch, issues: batch.issues.map((i) => (i.id === issueId ? { ...i, resolution } : i)) };
  const details: Record<string, string> = { dataset: batch.dataset, code: issue.code, issueId, severity: issue.severity, reason };
  if (reference) details.reference = reference;
  return { batch: next, audit: { action: 'validation.override', actorId: actor.id, actorRole: actor.role, periodId: batch.periodId, batchId: batch.id, details } };
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') { Object.values(o as object).forEach(deepFreeze); Object.freeze(o); }
  return o;
}

export function approveBatch(batch: Batch, actor: Actor, guard: Guard, at: string, opts: { staffApproved: boolean }): { batch: Batch; audit: AuditInput } {
  if (!guard('upload.approve')) throw new WorkflowError('FORBIDDEN', 'Not permitted to approve.');
  if (batch.status !== 'VALIDATED') throw new WorkflowError('BAD_STATE', `Cannot approve a batch in status ${batch.status}.`);
  if (batch.dataset !== 'staff' && !opts.staffApproved) throw new WorkflowError('STAFF_NOT_APPROVED', 'Approve the Staff snapshot first.');
  const open = unresolvedBlocking(batch);
  if (open.length > 0) throw new WorkflowError('BLOCKING_ISSUES', `${open.length} unresolved blocking issue(s).`);
  const approved = deepFreeze(structuredClone({ ...batch, status: 'APPROVED' as const, approvedBy: actor.id, approvedAt: at }));
  return { batch: approved, audit: { action: 'upload.approve', actorId: actor.id, actorRole: actor.role, periodId: batch.periodId, batchId: batch.id, details: { dataset: batch.dataset, snapshotHash: batch.snapshotHash, checksum: batch.checksum, version: batch.version, blockingCount: batch.issues.filter((i) => i.severity === 'BLOCKING').length, warningCount: batch.issues.filter((i) => i.severity === 'WARNING').length } } };
}

/** Corrections never edit an approved batch: the old one is superseded and a new version is registered. */
export function supersedeBatch(batch: Batch, actor: Actor, guard: Guard, reason: string): { superseded: Batch; audit: AuditInput } {
  if (!guard('upload.approve')) throw new WorkflowError('FORBIDDEN', 'Not permitted.');
  if (reason.trim().length < 10) throw new WorkflowError('REASON_REQUIRED', 'A reason of at least 10 characters is required.');
  return { superseded: deepFreeze({ ...structuredClone(batch), status: 'SUPERSEDED' as const }), audit: { action: 'batch.supersede', actorId: actor.id, actorRole: actor.role, periodId: batch.periodId, batchId: batch.id, details: { dataset: batch.dataset, reason, fromStatus: batch.status, toStatus: 'SUPERSEDED' } } };
}
