// UNVERIFIED (not run; needs `pg` and a database). Implements the Repository port over the 0001_init.sql schema.
// Per request the API must run: SET LOCAL app.scope_org_ids = '<comma list of user scope ids>' for row-level security.
import type { Pool } from 'pg';
import type { AuditEvent, Batch, TypedRecord } from '../../../packages/schemas/src/index.ts';
import type { Repository, ReportingPeriod } from './repo.ts';

export class PostgresRepository implements Repository {
  constructor(private readonly pool: Pool) {}
  async createPeriod(p: ReportingPeriod) { await this.pool.query('INSERT INTO reporting_period (id, period, cutoff, created_by, created_at) VALUES ($1,$2,$3,$4,$5)', [p.id, p.period, p.cutoff, p.createdBy, p.createdAt]); }
  async getPeriod(id: string) { const r = await this.pool.query('SELECT id, period, cutoff::text, created_by AS "createdBy", created_at::text AS "createdAt" FROM reporting_period WHERE id=$1', [id]); return r.rows[0] ?? null; }
  async listPeriods() { const r = await this.pool.query('SELECT id, period, cutoff::text, created_by AS "createdBy", created_at::text AS "createdAt" FROM reporting_period ORDER BY period'); return r.rows; }
  async saveBatch(b: Batch) {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(`INSERT INTO upload_batch (id, period_id, dataset, version, status, checksum, snapshot_hash, schema_version, row_count, uploaded_by, approved_by, approved_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'n/a',$10,$11)
        ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, approved_by = EXCLUDED.approved_by, approved_at = EXCLUDED.approved_at`,
        [b.id, b.periodId, b.dataset, b.version, b.status, b.checksum, b.snapshotHash, b.schemaVersion, b.rowCount, b.approvedBy ?? null, b.approvedAt ?? null]);
      for (const i of b.issues) await c.query(`INSERT INTO upload_issue (id, batch_id, row_no, field, code, severity, message, value, resolution_kind, resolution_reason, resolution_reference, resolved_by, resolved_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (id) DO UPDATE SET resolution_kind=EXCLUDED.resolution_kind, resolution_reason=EXCLUDED.resolution_reason, resolution_reference=EXCLUDED.resolution_reference, resolved_by=EXCLUDED.resolved_by, resolved_at=EXCLUDED.resolved_at`,
        [i.id, b.id, i.row, i.field, i.code, i.severity, i.message, i.value ?? null, i.resolution?.kind ?? null, i.resolution?.reason ?? null, i.resolution?.reference ?? null, i.resolution?.actorId ?? null, i.resolution?.at ?? null]);
      await c.query('COMMIT');
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }
  async getBatch(_id: string): Promise<Batch | null> { throw new Error('TODO: assemble Batch + issues from upload_batch/upload_issue'); }
  async batchesFor(_periodId: string): Promise<Batch[]> { throw new Error('TODO'); }
  async saveRaw(_id: string, _text: string) { throw new Error('TODO: write to approved encrypted object storage (Azure Blob / approved store), store key in upload_batch.raw_object_key'); }
  async saveRecords(_id: string, _r: TypedRecord[]) { throw new Error('TODO: insert into employee_snapshot / fact_* with org_path from OrgIndex.ancestorsOf'); }
  async getRecords(_id: string): Promise<TypedRecord[]> { throw new Error('TODO'); }
  async appendAudit(e: AuditEvent) { await this.pool.query('INSERT INTO audit_event (seq, at, action, actor_id, actor_role, period_id, batch_id, details, prev_hash, hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [e.seq, e.at, e.action, e.actorId, e.actorRole, e.periodId, e.batchId, JSON.stringify(e.details), e.prevHash, e.hash]); }
  async listAudit(): Promise<AuditEvent[]> { throw new Error('TODO'); }
}
