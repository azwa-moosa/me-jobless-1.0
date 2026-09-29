// Repository port. InMemoryRepository is used by tests; PostgresRepository (postgres-repo.sql.md + adapters) is UNVERIFIED here.
import type { AuditEvent, Batch, TypedRecord } from '../../../packages/schemas/src/index.ts';

export type PeriodStatus = 'DRAFT' | 'UPLOADING' | 'VALIDATION_REQUIRED' | 'READY_FOR_CALCULATION';
export interface ReportingPeriod { id: string; period: string; cutoff: string; createdBy: string; createdAt: string }

export interface Repository {
  createPeriod(p: ReportingPeriod): Promise<void>;
  getPeriod(id: string): Promise<ReportingPeriod | null>;
  listPeriods(): Promise<ReportingPeriod[]>;
  saveBatch(b: Batch): Promise<void>;
  getBatch(id: string): Promise<Batch | null>;
  batchesFor(periodId: string): Promise<Batch[]>;
  saveRaw(batchId: string, text: string): Promise<void>;
  saveRecords(batchId: string, records: TypedRecord[]): Promise<void>;
  getRecords(batchId: string): Promise<TypedRecord[]>;
  appendAudit(e: AuditEvent): Promise<void>;
  listAudit(): Promise<AuditEvent[]>;
}

export class InMemoryRepository implements Repository {
  periods = new Map<string, ReportingPeriod>();
  batches = new Map<string, Batch>();
  raw = new Map<string, string>();
  records = new Map<string, TypedRecord[]>();
  audit: AuditEvent[] = [];
  async createPeriod(p: ReportingPeriod) { this.periods.set(p.id, p); }
  async getPeriod(id: string) { return this.periods.get(id) ?? null; }
  async listPeriods() { return [...this.periods.values()].sort((a, b) => a.period.localeCompare(b.period)); }
  async saveBatch(b: Batch) { this.batches.set(b.id, b); }
  async getBatch(id: string) { return this.batches.get(id) ?? null; }
  async batchesFor(periodId: string) { return [...this.batches.values()].filter((b) => b.periodId === periodId).sort((a, b) => a.version - b.version); }
  async saveRaw(id: string, text: string) { this.raw.set(id, text); }
  async saveRecords(id: string, r: TypedRecord[]) { this.records.set(id, r); }
  async getRecords(id: string) { return this.records.get(id) ?? []; }
  async appendAudit(e: AuditEvent) { this.audit.push(e); }
  async listAudit() { return [...this.audit]; }
}
