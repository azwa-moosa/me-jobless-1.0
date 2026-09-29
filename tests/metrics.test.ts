import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateMetrics, bandOf, METRIC_DEFINITIONS } from '../packages/metrics/src/index.ts';
import type { MetricInput } from '../packages/metrics/src/index.ts';
import { validateDataset } from '../packages/schemas/src/index.ts';
import { cleanStaff, expected, golden, org, PERIOD } from './helpers.ts';

function goldenInput(): MetricInput {
  const { result: staff, snapshot } = cleanStaff();
  const att = validateDataset('attendance', golden('attendance.csv'), { period: PERIOD, org, staff: snapshot });
  const ot = validateDataset('overtime', golden('overtime.csv'), { period: PERIOD, org, staff: snapshot });
  return {
    period: PERIOD, cutoff: '2026-09-30', workingDays: 22,
    staff: staff.records as never, attendance: att.records as never, overtime: ot.records as never,
  };
}
const get = (rs: ReturnType<typeof calculateMetrics>['results'], id: string, scope = 'BANK', dim: string | null = null) =>
  rs.find((r) => r.metricId === id && r.scope === scope && r.dimension === dim);
const near = (a: number | undefined, b: number, eps = 1e-9) => assert.ok(a !== undefined && Math.abs(a - b) < eps, `${a} != ${b}`);

test('golden regression: headcount', () => {
  const { results } = calculateMetrics(goldenInput());
  const e = expected('metrics.json').headcount;
  assert.equal(get(results, 'WF-HEADCOUNT')?.value, e.total);
  assert.equal(get(results, 'WF-HEADCOUNT', 'DIVISION:Credit')?.value, e.by_division.Credit);
  assert.equal(get(results, 'WF-HEADCOUNT', 'DIVISION:Finance')?.value, e.by_division.Finance);
});

test('golden regression: overtime', () => {
  const { results } = calculateMetrics(goldenInput());
  const e = expected('metrics.json').overtime;
  near(get(results, 'OT-HOURS')?.value, e.total_hours);
  near(get(results, 'OT-COST')?.value, e.total_cost);
  near(get(results, 'OT-HOURS', 'DIVISION:Credit')?.value, e.hours_by_division.Credit);
  near(get(results, 'OT-HOURS', 'DIVISION:Finance')?.value, e.hours_by_division.Finance);
  near(get(results, 'OT-COST', 'DIVISION:Credit')?.value, e.cost_by_division.Credit);
  near(get(results, 'OT-COST', 'DIVISION:Finance')?.value, e.cost_by_division.Finance);
  near(get(results, 'OT-HOURS-PER-EMP')?.value, e.hours_per_employee_headcount);
  near(get(results, 'OT-COST-PER-EMP')?.value, e.cost_per_employee_headcount);
  for (const b of ['LOW', 'MEDIUM', 'HIGH']) assert.equal(get(results, 'OT-BANDS', 'BANK', b)?.value, e.bands[b]);
});

test('golden regression: absence and leave utilisation', () => {
  const { results } = calculateMetrics(goldenInput());
  const a = expected('metrics.json').absence;
  const abs = get(results, 'ATT-ABSENCE-RATE');
  assert.equal(abs?.numerator, a.numerator_days);
  assert.equal(abs?.denominator, a.denominator_days);
  near(abs?.value, a.rate);
  const l = expected('metrics.json').leave_utilisation_annual;
  const lu = get(results, 'ATT-MANDATORY-UTIL');
  assert.equal(lu?.numerator, l.utilised);
  assert.equal(lu?.denominator, l.entitlement);
  near(lu?.value, l.rate);
});

test('separated employee is excluded from headcount and from absence numerator', () => {
  const { results } = calculateMetrics(goldenInput());
  assert.equal(get(results, 'ATT-ABSENCE-RATE')?.numerator, 6); // U008 sick day excluded
});

test('OT band boundaries are half-open: 19.9 LOW, 20 MEDIUM, 39.9 MEDIUM, 40 HIGH', () => {
  const bands = [{ id: 'LOW', min: 0, max: 20 }, { id: 'MEDIUM', min: 20, max: 40 }, { id: 'HIGH', min: 40, max: null }];
  assert.deepEqual([0, 19.9, 20, 39.9, 40, 500].map((h) => bandOf(h, bands)), ['LOW', 'LOW', 'MEDIUM', 'MEDIUM', 'HIGH', 'HIGH']);
});

test('idempotent: identical input gives identical results and hash', () => {
  const a = calculateMetrics(goldenInput()), b = calculateMetrics(goldenInput());
  assert.equal(JSON.stringify(a.results), JSON.stringify(b.results));
  assert.equal(a.inputHash, b.inputHash);
});

test('input hash changes when the data changes', () => {
  const i = goldenInput();
  const h1 = calculateMetrics(i).inputHash;
  i.overtime[0] = { ...i.overtime[0], ot_hours: i.overtime[0].ot_hours + 1 };
  assert.notEqual(calculateMetrics(i).inputHash, h1);
});

test('every unsigned definition is flagged; none is APPROVED; implemented ones carry version', () => {
  assert.ok(METRIC_DEFINITIONS.length > 50);
  for (const d of METRIC_DEFINITIONS) { assert.notEqual(d.status, 'APPROVED'); assert.match(d.version, /^\d+\.\d+\.\d+$/); }
});

test('changing definition config (e.g. absence leave types) changes the result - it is configuration, not code', () => {
  const base = calculateMetrics(goldenInput()).results.find((r) => r.metricId === 'ATT-ABSENCE-RATE' && r.scope === 'BANK')!;
  const d = METRIC_DEFINITIONS.find((x) => x.id === 'ATT-ABSENCE-RATE')!;
  const saved = d.config.absenceLeaveTypes;
  d.config.absenceLeaveTypes = ['SICK', 'UNPLANNED', 'LONG_LEAVE'];
  try {
    const changed = calculateMetrics(goldenInput()).results.find((r) => r.metricId === 'ATT-ABSENCE-RATE' && r.scope === 'BANK')!;
    assert.equal(changed.numerator, (base.numerator as number) + 10);
  } finally { d.config.absenceLeaveTypes = saved; }
});
