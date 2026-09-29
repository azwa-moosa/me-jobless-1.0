// Deterministic metric calculators. Pure functions: same input + same definitions => identical output.
import { createHash } from 'node:crypto';
import { DEFINITION_BY_ID } from './definitions.ts';
import type { MetricDefinition } from './definitions.ts';

export interface StaffRow { uid: string; employment_type: string; join_date: string; separation_date: string | null; division: string; department: string }
export interface AttendanceRow { uid: string; leave_type: string; entitlement_days: number | null; utilised_days: number }
export interface OvertimeRow { uid: string; ot_hours: number; ot_cost: number }
export interface MetricInput {
  period: string; cutoff: string; workingDays: number;
  staff: StaffRow[]; attendance: AttendanceRow[]; overtime: OvertimeRow[];
}
export interface MetricResult {
  metricId: string; version: string; status: string; scope: string; dimension: string | null; value: number;
  numerator: number | null; denominator: number | null;
}
export const round = (x: number, dp = 10) => { const f = 10 ** dp; return Math.round(x * f) / f; };
const sum = (xs: number[]) => round(xs.reduce((a, b) => a + b, 0), 9);

export function headcountRows(input: MetricInput, def: MetricDefinition): StaffRow[] {
  const types = def.config.includeEmploymentTypes as string[];
  return input.staff.filter((s) => s.join_date <= input.cutoff && (s.separation_date === null || s.separation_date > input.cutoff) && types.includes(s.employment_type));
}

export function bandOf(hours: number, bands: { id: string; min: number; max: number | null }[]): string | null {
  const b = bands.find((x) => hours >= x.min && (x.max === null || hours < x.max));
  return b ? b.id : null;
}

function def(id: string): MetricDefinition {
  const d = DEFINITION_BY_ID.get(id);
  if (!d || !d.implemented) throw new Error(`Metric ${id} is not implemented`);
  return d;
}
const res = (d: MetricDefinition, scope: string, dimension: string | null, value: number, numerator: number | null = null, denominator: number | null = null): MetricResult =>
  ({ metricId: d.id, version: d.version, status: d.status, scope, dimension, value: round(value), numerator, denominator });

export function calculateMetrics(input: MetricInput): { results: MetricResult[]; inputHash: string } {
  const out: MetricResult[] = [];
  const hd = def('WF-HEADCOUNT');
  const hc = headcountRows(input, hd);
  const hcUids = new Map(hc.map((s) => [s.uid, s] as const));
  const divisions = [...new Set(hc.map((s) => s.division))].sort();
  const scopes: { scope: string; match: (uid: string) => boolean }[] = [
    { scope: 'BANK', match: (u) => hcUids.has(u) },
    ...divisions.map((d) => ({ scope: `DIVISION:${d}`, match: (u: string) => hcUids.get(u)?.division === d })),
  ];

  for (const sc of scopes) {
    const heads = hc.filter((s) => sc.match(s.uid)).length;
    out.push(res(hd, sc.scope, null, heads, heads));

    // Overtime (population = employees in headcount; snapshot org is authoritative)
    const ot = input.overtime.filter((o) => sc.match(o.uid));
    const hours = sum(ot.map((o) => o.ot_hours)), cost = sum(ot.map((o) => o.ot_cost));
    out.push(res(def('OT-HOURS'), sc.scope, null, hours));
    out.push(res(def('OT-COST'), sc.scope, null, cost));
    for (const [id, num] of [['OT-HOURS-PER-EMP', hours], ['OT-COST-PER-EMP', cost]] as const) {
      const d = def(id);
      const den = d.config.denominator === 'ot_employees' ? new Set(ot.map((o) => o.uid)).size : heads;
      if (den > 0) out.push(res(d, sc.scope, null, num / den, num, den));
    }
    const bd = def('OT-BANDS');
    const bands = bd.config.bands as { id: string; min: number; max: number | null }[];
    for (const b of bands) out.push(res(bd, sc.scope, b.id, ot.filter((o) => bandOf(o.ot_hours, bands) === b.id).length));

    // Attendance
    const att = input.attendance.filter((a) => sc.match(a.uid));
    const ad = def('ATT-ABSENCE-RATE');
    const types = ad.config.absenceLeaveTypes as string[];
    const absDays = sum(att.filter((a) => types.includes(a.leave_type)).map((a) => a.utilised_days));
    const absDen = heads * input.workingDays;
    if (absDen > 0) out.push(res(ad, sc.scope, null, absDays / absDen, absDays, absDen));
    const ld = def('ATT-MANDATORY-UTIL');
    const lt = ld.config.leaveType as string;
    const rows = att.filter((a) => a.leave_type === lt && a.entitlement_days !== null);
    const ent = sum(rows.map((a) => a.entitlement_days as number)), used = sum(rows.map((a) => a.utilised_days));
    if (ent > 0) out.push(res(ld, sc.scope, null, used / ent, used, ent));
  }

  // Canonical ordering so output is byte-identical across runs.
  out.sort((a, b) => a.metricId.localeCompare(b.metricId) || a.scope.localeCompare(b.scope) || String(a.dimension).localeCompare(String(b.dimension)));
  const usedDefs = [...new Set(out.map((r) => r.metricId))].sort().map((id) => DEFINITION_BY_ID.get(id));
  const inputHash = createHash('sha256').update(JSON.stringify({ input, defs: usedDefs })).digest('hex');
  return { results: out, inputHash };
}
