// Append-only, hash-chained audit trail. Details are whitelisted so no employee data can leak into logs.
import { createHash } from 'node:crypto';

export const AUDIT_ACTIONS = [
  'auth.login', 'period.create', 'upload.create', 'upload.map', 'upload.validate', 'validation.override', 'upload.approve',
  'upload.reject', 'batch.supersede', 'export.create', 'access.change', 'metric.config.change',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// Deliberately excludes any name/UID/DOB style keys. `reason` is free text typed by an HR user: capped in length,
// and the UI must warn users not to paste personal data (see ASSUMPTIONS A-12).
export const ALLOWED_DETAIL_KEYS = [
  'dataset', 'filename', 'checksum', 'snapshotHash', 'schemaVersion', 'rowCount', 'issueCount', 'blockingCount', 'warningCount',
  'code', 'issueId', 'severity', 'reason', 'reference', 'fromStatus', 'toStatus', 'columns', 'role', 'scopeOrgId', 'granted', 'revoked', 'version', 'permission', 'outcome',
] as const;

export type AuditDetailValue = string | number | boolean | string[];
export interface AuditInput { action: AuditAction; actorId: string; actorRole: string; periodId: string | null; batchId: string | null; details: Record<string, AuditDetailValue> }
export interface AuditEvent extends AuditInput { seq: number; at: string; prevHash: string; hash: string }

export class AuditError extends Error {}

export function sanitiseDetails(details: Record<string, AuditDetailValue>): Record<string, AuditDetailValue> {
  const out: Record<string, AuditDetailValue> = {};
  for (const [k, v] of Object.entries(details)) {
    if (!(ALLOWED_DETAIL_KEYS as readonly string[]).includes(k)) throw new AuditError(`Audit detail key not allowed: ${k}`);
    const okType = typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || (Array.isArray(v) && v.every((x) => typeof x === 'string'));
    if (!okType) throw new AuditError(`Audit detail value has unsupported type: ${k}`);
    if (typeof v === 'string' && v.length > 500) throw new AuditError(`Audit detail too long: ${k}`);
    out[k] = v;
  }
  return out;
}

const canon = (o: unknown): string => JSON.stringify(o, (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v));
const GENESIS = '0'.repeat(64);

export function buildAuditEvent(prev: AuditEvent | null, input: AuditInput, at: string): AuditEvent {
  if (!(AUDIT_ACTIONS as readonly string[]).includes(input.action)) throw new AuditError(`Unknown audit action ${input.action}`);
  const body = { ...input, details: sanitiseDetails(input.details), seq: (prev?.seq ?? 0) + 1, at, prevHash: prev?.hash ?? GENESIS };
  const hash = createHash('sha256').update(canon(body)).digest('hex');
  return { ...body, hash };
}

export function verifyAuditChain(events: AuditEvent[]): boolean {
  let prev: AuditEvent | null = null;
  for (const e of events) {
    const { hash, ...body } = e;
    if (body.prevHash !== (prev?.hash ?? GENESIS) || body.seq !== (prev?.seq ?? 0) + 1) return false;
    if (createHash('sha256').update(canon(body)).digest('hex') !== hash) return false;
    prev = e;
  }
  return true;
}
