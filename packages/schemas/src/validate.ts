// Validation engine: schema, identity, duplicates, organisation, dates, range, cross-dataset, reconciliation.
// Pure and deterministic. Source data is NEVER modified; problems become issues.
import { parseCsv } from './csv.ts';
import { DATASET_SPECS } from './datasets.ts';
import type { DatasetSpec, FieldSpec } from './datasets.ts';
import { ageAt, daysInPeriod, isValidDate, isValidPeriod, periodEnd, periodStart } from './dates.ts';
import { resolveOrg } from './org.ts';
import type { OrgIndex } from './org.ts';
import { suggestMapping } from './profile.ts';
import { RULE_BY_CODE } from './rules.ts';
import type { Severity } from './rules.ts';

export interface Issue {
  dataset: string; row: number | null; field: string | null; code: string; severity: Severity; message: string; value?: string;
}
export type TypedRecord = Record<string, string | number | null> & { _row: number };
export interface ControlTotals { rows?: number; total_hours?: number; total_cost?: number }
export interface StaffSnapshotEntry {
  uid: string; status: string; employmentType: string; joinDate: string; separationDate: string | null;
  division: string; department: string; unit: string | null;
}
export interface ValidationContext {
  period: string;
  org: OrgIndex;
  staff?: Map<string, StaffSnapshotEntry>; // approved staff snapshot, required for attendance/overtime
  control?: ControlTotals;
  mapping?: Record<string, string | null>; // canonical field -> source column; default = auto suggestion
  otOutlierHours?: number; // PENDING HR SIGN-OFF, default 200
}
export interface ValidationResult {
  dataset: string; schemaVersion: string; rowCount: number; mapping: Record<string, string | null>;
  records: TypedRecord[]; issues: Issue[]; blockingCount: number; warningCount: number;
}

function mk(dataset: string, row: number | null, field: string | null, code: string, message: string, value?: string): Issue {
  const rule = RULE_BY_CODE.get(code);
  if (!rule) throw new Error(`Unknown rule code ${code}`);
  const issue: Issue = { dataset, row, field, code, severity: rule.severity, message };
  if (value !== undefined) issue.value = value;
  return issue;
}

const NUM = /^-?\d+(\.\d+)?$/;

function parseRows(spec: DatasetSpec, headers: string[], rows: string[][], mapping: Record<string, string | null>, issues: Issue[]): TypedRecord[] {
  const colIdx = new Map<string, number>();
  for (const f of spec.fields) { const src = mapping[f.name]; if (src) colIdx.set(f.name, headers.indexOf(src)); }
  const out: TypedRecord[] = [];
  rows.forEach((cells, i) => {
    const rowNo = i + 1;
    if (cells.length !== headers.length) {
      issues.push(mk(spec.id, rowNo, null, 'ROW_SHAPE', `Row has ${cells.length} cells, header has ${headers.length}.`));
      return;
    }
    const rec: TypedRecord = { _row: rowNo };
    for (const f of spec.fields) {
      const idx = colIdx.get(f.name);
      const raw = idx === undefined ? '' : (cells[idx] ?? '').trim();
      rec[f.name] = parseField(spec, f, raw, rowNo, issues);
    }
    out.push(rec);
  });
  return out;
}

function parseField(spec: DatasetSpec, f: FieldSpec, raw: string, rowNo: number, issues: Issue[]): string | number | null {
  const shown = f.sensitive ? undefined : raw.slice(0, 40);
  if (raw === '') {
    if (f.required) issues.push(mk(spec.id, rowNo, f.name, 'REQUIRED_FIELD', `${f.name} is required.`));
    return null;
  }
  switch (f.type) {
    case 'date':
      if (!isValidDate(raw)) { issues.push(mk(spec.id, rowNo, f.name, 'INVALID_DATE', `${f.name} is not a valid date (YYYY-MM-DD).`, shown)); return null; }
      return raw;
    case 'period':
      if (!isValidPeriod(raw)) { issues.push(mk(spec.id, rowNo, f.name, 'INVALID_DATE', `${f.name} is not a valid period (YYYY-MM).`, shown)); return null; }
      return raw;
    case 'number': {
      if (!NUM.test(raw)) { issues.push(mk(spec.id, rowNo, f.name, 'INVALID_NUMBER', `${f.name} is not a number.`, shown)); return null; }
      const n = Number(raw);
      if (f.min !== undefined && n < f.min) { issues.push(mk(spec.id, rowNo, f.name, 'NEGATIVE_VALUE', `${f.name} must be >= ${f.min}.`, shown)); return null; }
      return n;
    }
    case 'enum':
      if (!(f.allowed ?? []).includes(raw)) { issues.push(mk(spec.id, rowNo, f.name, 'INVALID_VALUE', `${f.name} must be one of: ${(f.allowed ?? []).join(', ')}.`, shown)); return null; }
      return raw;
    default:
      return raw;
  }
}

function flagDuplicates(records: TypedRecord[], keyOf: (r: TypedRecord) => string | null, code: string, dataset: string, field: string, issues: Issue[]) {
  const groups = new Map<string, number[]>();
  for (const r of records) { const k = keyOf(r); if (k === null) continue; (groups.get(k) ?? groups.set(k, []).get(k)!).push(r._row); }
  for (const rows of groups.values()) if (rows.length > 1) for (const row of rows) issues.push(mk(dataset, row, field, code, `Duplicate key; appears on rows ${rows.join(', ')}.`));
}

function validateStaff(records: TypedRecord[], ctx: ValidationContext, issues: Issue[]) {
  const cutoff = periodEnd(ctx.period);
  flagDuplicates(records, (r) => (r.uid ? String(r.uid) : null), 'DUPLICATE_UID', 'staff', 'uid', issues);
  const uids = new Set(records.map((r) => r.uid).filter(Boolean) as string[]);
  for (const r of records) {
    const row = r._row;
    const org = resolveOrg(ctx.org, { division: String(r.division ?? ''), department: String(r.department ?? ''), unit: r.unit ? String(r.unit) : null }, cutoff);
    if (r.division && r.department && !org.ok) {
      issues.push(mk('staff', row, org.field, org.code, org.code === 'UNKNOWN_ORG' ? `${org.field} not found in the organisation hierarchy.` : `${org.field} is not effective at ${cutoff}.`));
    }
    const join = r.join_date as string | null, sep = r.separation_date as string | null;
    if (join && sep && sep < join) issues.push(mk('staff', row, 'separation_date', 'DATE_ORDER', 'Separation date is before join date.'));
    const status = r.employment_status as string | null;
    if (status && status !== 'Active' && !sep) issues.push(mk('staff', row, 'separation_date', 'MISSING_SEPARATION_DATE', `Status ${status} requires a separation date.`));
    if (status === 'Active' && sep && sep <= cutoff) issues.push(mk('staff', row, 'separation_date', 'ACTIVE_WITH_PAST_SEPARATION', 'Status is Active but separation date has passed.'));
    if (sep && sep > cutoff && join && sep >= join) issues.push(mk('staff', row, 'separation_date', 'FUTURE_SEPARATION', 'Separation date is after the period cut-off.'));
    const mgr = r.manager_uid as string | null;
    if (mgr && !uids.has(mgr)) issues.push(mk('staff', row, 'manager_uid', 'MANAGER_NOT_FOUND', 'Manager UID is not in this file.'));
    const dob = r.dob as string | null;
    if (dob) { const a = ageAt(dob, cutoff); if (a < 16 || a > 80) issues.push(mk('staff', row, 'dob', 'DOB_IMPLAUSIBLE', 'Age at cut-off is outside 16-80.')); }
  }
}

function checkIdentityAndPeriod(dataset: string, records: TypedRecord[], ctx: ValidationContext, issues: Issue[]) {
  const staff = ctx.staff;
  if (!staff) throw new Error(`${dataset} validation requires an approved staff snapshot`);
  const start = periodStart(ctx.period);
  for (const r of records) {
    if (r.period && r.period !== ctx.period) issues.push(mk(dataset, r._row, 'period', 'PERIOD_MISMATCH', `Row period differs from reporting period ${ctx.period}.`));
    if (!r.uid) continue;
    const s = staff.get(String(r.uid));
    if (!s) { issues.push(mk(dataset, r._row, 'uid', 'UNKNOWN_UID', 'UID is not in the approved staff snapshot.', String(r.uid))); continue; }
    if (s.separationDate && s.separationDate < start) issues.push(mk(dataset, r._row, 'uid', 'SEPARATED_BEFORE_PERIOD', 'Employee separated before this period started.'));
  }
}

function validateAttendance(records: TypedRecord[], ctx: ValidationContext, issues: Issue[]) {
  checkIdentityAndPeriod('attendance', records, ctx, issues);
  flagDuplicates(records, (r) => (r.period && r.uid && r.leave_type ? `${r.period}|${r.uid}|${r.leave_type}` : null), 'DUPLICATE_KEY', 'attendance', 'uid', issues);
  const days = daysInPeriod(ctx.period);
  for (const r of records) {
    if (typeof r.utilised_days === 'number' && r.utilised_days > days) issues.push(mk('attendance', r._row, 'utilised_days', 'UTILISED_EXCEEDS_PERIOD', `Utilised days exceed the ${days} days in the period.`));
    if (typeof r.balance_days === 'number' && typeof r.entitlement_days === 'number' && r.balance_days > r.entitlement_days) issues.push(mk('attendance', r._row, 'balance_days', 'BALANCE_EXCEEDS_ENTITLEMENT', 'Balance is greater than entitlement.'));
  }
}

function validateOvertime(records: TypedRecord[], ctx: ValidationContext, issues: Issue[]) {
  checkIdentityAndPeriod('overtime', records, ctx, issues);
  flagDuplicates(records, (r) => (r.period && r.uid ? `${r.period}|${r.uid}` : null), 'DUPLICATE_KEY', 'overtime', 'uid', issues);
  const maxHours = daysInPeriod(ctx.period) * 24, outlier = ctx.otOutlierHours ?? 200;
  const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
  for (const r of records) {
    if (typeof r.ot_hours === 'number') {
      if (r.ot_hours > maxHours) issues.push(mk('overtime', r._row, 'ot_hours', 'OT_HOURS_IMPOSSIBLE', `OT hours exceed the ${maxHours} hours in the period.`));
      else if (r.ot_hours > outlier) issues.push(mk('overtime', r._row, 'ot_hours', 'OT_HOURS_OUTLIER', `OT hours above ${outlier}.`));
    }
    const s = r.uid ? ctx.staff?.get(String(r.uid)) : undefined;
    if (s) {
      for (const [field, snap] of [['division', s.division], ['department', s.department], ['unit', s.unit]] as const) {
        const given = norm(r[field]);
        if (given !== '' && given !== norm(snap)) { issues.push(mk('overtime', r._row, field, 'ORG_MISMATCH_SNAPSHOT', `${field} in file differs from the staff snapshot; snapshot is used.`)); break; }
      }
    }
  }
  const c = ctx.control;
  if (c) {
    const sum = (k: string) => Math.round(records.reduce((a, r) => a + (typeof r[k] === 'number' ? (r[k] as number) : 0), 0) * 1e6) / 1e6;
    const tol = 0.005;
    if (c.rows !== undefined && c.rows !== records.length) issues.push(mk('overtime', null, 'uid', 'CONTROL_TOTAL_MISMATCH', `Control total rows ${c.rows} != ${records.length}.`));
    if (c.total_hours !== undefined && Math.abs(c.total_hours - sum('ot_hours')) > tol) issues.push(mk('overtime', null, 'ot_hours', 'CONTROL_TOTAL_MISMATCH', `Control total hours ${c.total_hours} != ${sum('ot_hours')}.`));
    if (c.total_cost !== undefined && Math.abs(c.total_cost - sum('ot_cost')) > tol) issues.push(mk('overtime', null, 'ot_cost', 'CONTROL_TOTAL_MISMATCH', `Control total cost ${c.total_cost} != ${sum('ot_cost')}.`));
  }
}

export function validateDataset(datasetId: 'staff' | 'attendance' | 'overtime', csvText: string, ctx: ValidationContext): ValidationResult {
  const spec = DATASET_SPECS[datasetId];
  const { headers, rows } = parseCsv(csvText);
  const issues: Issue[] = [];
  const mapping = ctx.mapping ?? suggestMapping(headers, spec).mapping;
  const missing = spec.fields.filter((f) => f.required && !mapping[f.name]);
  if (missing.length > 0) {
    for (const f of missing) issues.push(mk(datasetId, null, f.name, 'SCHEMA_MISSING_COLUMN', `Required column for ${f.name} is missing or unmapped.`));
    return finish(spec, rows.length, mapping, [], issues);
  }
  const records = parseRows(spec, headers, rows, mapping, issues);
  if (datasetId === 'staff') validateStaff(records, ctx, issues);
  else if (datasetId === 'attendance') validateAttendance(records, ctx, issues);
  else validateOvertime(records, ctx, issues);
  return finish(spec, rows.length, mapping, records, issues);
}

function finish(spec: DatasetSpec, rowCount: number, mapping: Record<string, string | null>, records: TypedRecord[], issues: Issue[]): ValidationResult {
  issues.sort((a, b) => (a.row ?? 1e9) - (b.row ?? 1e9) || String(a.field).localeCompare(String(b.field)) || a.code.localeCompare(b.code));
  return {
    dataset: spec.id, schemaVersion: spec.schemaVersion, rowCount, mapping, records, issues,
    blockingCount: issues.filter((i) => i.severity === 'BLOCKING').length,
    warningCount: issues.filter((i) => i.severity === 'WARNING').length,
  };
}

export function toStaffSnapshot(records: TypedRecord[]): Map<string, StaffSnapshotEntry> {
  const m = new Map<string, StaffSnapshotEntry>();
  for (const r of records) {
    if (!r.uid) continue;
    m.set(String(r.uid), {
      uid: String(r.uid), status: String(r.employment_status), employmentType: String(r.employment_type), joinDate: String(r.join_date),
      separationDate: r.separation_date ? String(r.separation_date) : null, division: String(r.division), department: String(r.department), unit: r.unit ? String(r.unit) : null,
    });
  }
  return m;
}
