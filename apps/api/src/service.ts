// Application service: every method authorises server-side BEFORE touching data. Framework-agnostic.
import { authorize, requirePermission, ForbiddenError } from '../../../packages/auth/src/index.ts';
import type { AuthUser } from '../../../packages/auth/src/index.ts';
import { calculateMetrics } from '../../../packages/metrics/src/index.ts';
import {
  approveBatch, buildAuditEvent, isValidPeriod, periodEnd, profileColumns, parseCsv, registerBatch, resolveIssue, sha256, suggestMapping,
  toStaffSnapshot, validateDataset, WorkflowError, DATASET_SPECS, unresolvedBlocking,
} from '../../../packages/schemas/src/index.ts';
import type { AuditInput, Batch, ControlTotals, OrgIndex } from '../../../packages/schemas/src/index.ts';
import type { PeriodStatus, Repository, ReportingPeriod } from './repo.ts';

export type DatasetId = 'staff' | 'attendance' | 'overtime';
export const DATASETS: DatasetId[] = ['staff', 'attendance', 'overtime'];
const isDataset = (d: string): d is DatasetId => (DATASETS as string[]).includes(d);
export interface Deps { repo: Repository; org: OrgIndex; now: () => string; newId: () => string }

const live = (b: Batch) => b.status === 'VALIDATED' || b.status === 'APPROVED';

export class PlatformService {
  repo: Repository; org: OrgIndex; now: () => string; newId: () => string; root: string;
  constructor(d: Deps) {
    Object.assign(this, d);
    this.root = d.org.units.find((u) => u.level === 'BANK')!.unitId;
  }
  private need(user: AuthUser | null, permission: string, orgUnitId?: string) { requirePermission(user, permission, { orgUnitId: orgUnitId ?? this.root }, this.org); }
  private guard(user: AuthUser) { return (p: string) => authorize(user, p, { orgUnitId: this.root }, this.org).allowed; }
  private async audit(input: AuditInput) {
    const list = await this.repo.listAudit();
    await this.repo.appendAudit(buildAuditEvent(list[list.length - 1] ?? null, input, this.now()));
  }

  async createPeriod(user: AuthUser | null, body: { period?: string }): Promise<ReportingPeriod> {
    this.need(user, 'period.create');
    if (!body.period || !isValidPeriod(body.period)) throw new WorkflowError('INVALID_INPUT', 'period must be YYYY-MM.');
    if ((await this.repo.listPeriods()).some((p) => p.period === body.period)) throw new WorkflowError('ALREADY_EXISTS', 'Reporting period already exists.');
    const p: ReportingPeriod = { id: `P-${body.period}`, period: body.period, cutoff: periodEnd(body.period), createdBy: user!.id, createdAt: this.now() };
    await this.repo.createPeriod(p);
    await this.audit({ action: 'period.create', actorId: user!.id, actorRole: user!.role, periodId: p.id, batchId: null, details: { outcome: 'created' } });
    return p;
  }

  async periodStatus(periodId: string): Promise<PeriodStatus> {
    const latest = await this.latestByDataset(periodId);
    const all = Object.values(latest);
    if (all.length === 0) return 'DRAFT';
    if (DATASETS.every((d) => latest[d]?.status === 'APPROVED')) return 'READY_FOR_CALCULATION';
    if (all.some((b) => b.status === 'VALIDATED' && unresolvedBlocking(b).length > 0)) return 'VALIDATION_REQUIRED';
    return 'UPLOADING';
  }
  private async latestByDataset(periodId: string): Promise<Partial<Record<DatasetId, Batch>>> {
    const out: Partial<Record<DatasetId, Batch>> = {};
    for (const b of await this.repo.batchesFor(periodId)) if (live(b) && isDataset(b.dataset)) out[b.dataset] = b;
    return out;
  }

  async listPeriods(user: AuthUser | null) {
    this.need(user, 'period.create');
    const out = [];
    for (const p of await this.repo.listPeriods()) {
      const latest = await this.latestByDataset(p.id);
      out.push({ ...p, status: await this.periodStatus(p.id), datasets: DATASETS.map((d) => ({ dataset: d, batchId: latest[d]?.id ?? null, status: latest[d]?.status ?? 'MISSING' })) });
    }
    return out;
  }

  /** Column profiling + mapping suggestion without storing anything. */
  async profile(user: AuthUser | null, body: { dataset?: string; text?: string }) {
    this.need(user, 'upload.create');
    if (!body.dataset || !isDataset(body.dataset) || typeof body.text !== 'string') throw new WorkflowError('INVALID_INPUT', 'dataset and text are required.');
    const { headers, rows } = parseCsv(body.text);
    return { dataset: body.dataset, suggestion: suggestMapping(headers, DATASET_SPECS[body.dataset]), columns: profileColumns(headers, rows), rowCount: rows.length };
  }

  async upload(user: AuthUser | null, periodId: string, body: { dataset?: string; filename?: string; text?: string; mapping?: Record<string, string | null>; control?: ControlTotals }) {
    this.need(user, 'upload.create');
    const period = await this.repo.getPeriod(periodId);
    if (!period) throw new WorkflowError('NOT_FOUND', 'Reporting period not found.');
    if (!body.dataset || !isDataset(body.dataset) || typeof body.text !== 'string' || body.text.length === 0) throw new WorkflowError('INVALID_INPUT', 'dataset and text are required.');
    const dataset = body.dataset;
    const latest = await this.latestByDataset(periodId);
    let staffSnapshot;
    if (dataset !== 'staff') {
      const staffBatch = latest.staff;
      if (!staffBatch || staffBatch.status !== 'APPROVED') throw new WorkflowError('STAFF_NOT_APPROVED', 'Approve the Staff snapshot before uploading Attendance or Overtime.');
      staffSnapshot = toStaffSnapshot(await this.repo.getRecords(staffBatch.id));
    }
    const checksum = sha256(body.text);
    const prior = (await this.repo.batchesFor(periodId)).filter((b) => b.dataset === dataset);
    const dup = prior.find((b) => live(b) && b.checksum === checksum);
    if (dup && !body.mapping && !body.control) return { batch: dup, deduplicated: true };
    if (latest[dataset]?.status === 'APPROVED') throw new WorkflowError('BATCH_IMMUTABLE', `An approved ${dataset} snapshot exists; create a correction version (supersede) first.`);
    if (body.mapping) await this.audit({ action: 'upload.map', actorId: user!.id, actorRole: user!.role, periodId, batchId: null, details: { dataset, columns: Object.values(body.mapping).filter((v): v is string => !!v) } });

    const result = validateDataset(dataset, body.text, { period: period.period, org: this.org, staff: staffSnapshot, mapping: body.mapping, control: body.control });
    const id = `B-${this.newId()}`;
    const version = prior.length + 1;
    const { batch } = registerBatch({ id, periodId, version, rawText: body.text, result });
    // A newer upload replaces an earlier un-approved one for the same dataset.
    for (const old of prior) if (old.status === 'VALIDATED') await this.repo.saveBatch({ ...old, status: 'REJECTED' });
    await this.repo.saveBatch(batch);
    await this.repo.saveRaw(id, body.text);
    await this.repo.saveRecords(id, result.records);
    const base = { actorId: user!.id, actorRole: user!.role, periodId, batchId: id };
    await this.audit({ ...base, action: 'upload.create', details: { dataset, filename: (body.filename ?? 'upload.csv').slice(0, 200), checksum, rowCount: result.rowCount, version } });
    await this.audit({ ...base, action: 'upload.validate', details: { dataset, issueCount: result.issues.length, blockingCount: result.blockingCount, warningCount: result.warningCount, schemaVersion: result.schemaVersion } });
    return { batch, deduplicated: false };
  }

  async getBatchWithIssues(user: AuthUser | null, batchId: string) {
    this.need(user, 'issues.view');
    const b = await this.repo.getBatch(batchId);
    if (!b) throw new WorkflowError('NOT_FOUND', 'Batch not found.');
    return { batch: b, unresolvedBlocking: unresolvedBlocking(b).length };
  }

  async resolve(user: AuthUser | null, batchId: string, issueId: string, body: { reason?: string; reference?: string | null }) {
    this.need(user, 'validation.override');
    const b = await this.repo.getBatch(batchId);
    if (!b) throw new WorkflowError('NOT_FOUND', 'Batch not found.');
    const r = resolveIssue(b, issueId, { reason: body.reason ?? '', reference: body.reference }, { id: user!.id, role: user!.role }, this.guard(user!), this.now());
    await this.repo.saveBatch(r.batch);
    await this.audit(r.audit);
    return r.batch;
  }

  async approve(user: AuthUser | null, batchId: string) {
    this.need(user, 'upload.approve');
    const b = await this.repo.getBatch(batchId);
    if (!b) throw new WorkflowError('NOT_FOUND', 'Batch not found.');
    const latest = await this.latestByDataset(b.periodId);
    const r = approveBatch(b, { id: user!.id, role: user!.role }, this.guard(user!), this.now(), { staffApproved: latest.staff?.status === 'APPROVED' });
    await this.repo.saveBatch(r.batch);
    await this.audit(r.audit);
    return r.batch;
  }

  /** P0: calculate KPIs reproducibly from APPROVED batches only. */
  async calculate(user: AuthUser | null, periodId: string, body: { workingDays?: number }) {
    this.need(user, 'upload.approve');
    const period = await this.repo.getPeriod(periodId);
    if (!period) throw new WorkflowError('NOT_FOUND', 'Reporting period not found.');
    if ((await this.periodStatus(periodId)) !== 'READY_FOR_CALCULATION') throw new WorkflowError('BAD_STATE', 'All three datasets must be approved first.');
    if (typeof body.workingDays !== 'number' || body.workingDays <= 0) throw new WorkflowError('INVALID_INPUT', 'workingDays (> 0) is required (A-11).');
    const l = (await this.latestByDataset(periodId)) as Record<DatasetId, Batch>;
    const [staff, attendance, overtime] = await Promise.all(DATASETS.map((d) => this.repo.getRecords(l[d].id)));
    const out = calculateMetrics({ period: period.period, cutoff: period.cutoff, workingDays: body.workingDays, staff: staff as never, attendance: attendance as never, overtime: overtime as never });
    return { ...out, sourceBatches: DATASETS.map((d) => ({ dataset: d, batchId: l[d].id, snapshotHash: l[d].snapshotHash })), notice: 'PENDING HR SIGN-OFF: metric definitions are not approved.' };
  }

  /** Scoped read: only org units inside the caller's scope are returned (server-side row filtering). */
  async listOrgUnits(user: AuthUser | null) {
    if (!user) throw new ForbiddenError('UNKNOWN_PERMISSION');
    return this.org.units.filter((u) => authorize(user, 'dashboard.view', { orgUnitId: u.unitId }, this.org).allowed).map((u) => ({ unitId: u.unitId, level: u.level, name: u.name, parentId: u.parentId }));
  }
  async getOrgUnit(user: AuthUser | null, id: string) {
    this.need(user, 'dashboard.view', id);
    const u = this.org.byId.get(id)!;
    return { unitId: u.unitId, level: u.level, name: u.name, parentId: u.parentId };
  }

  async auditLog(user: AuthUser | null) { this.need(user, 'audit.view'); return this.repo.listAudit(); }
}
