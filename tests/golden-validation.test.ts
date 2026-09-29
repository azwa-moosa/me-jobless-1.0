import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDataset, validateHierarchy } from '../packages/schemas/src/index.ts';
import { cleanStaff, expected, golden, org, PERIOD, slim } from './helpers.ts';

test('org hierarchy fixture is structurally valid', () => {
  assert.deepEqual(validateHierarchy(org.units), []);
});

test('clean staff file: no issues', () => {
  const { result } = cleanStaff();
  assert.deepEqual(result.issues, []);
  assert.equal(result.records.length, 9);
});

test('staff_errors.csv matches hand-verified issues', () => {
  const r = validateDataset('staff', golden('staff_errors.csv'), { period: PERIOD, org });
  assert.deepEqual(slim(r.issues), slim(expected('staff_errors.issues.json')));
});

test('clean attendance and overtime files: no issues', () => {
  const { snapshot } = cleanStaff();
  const a = validateDataset('attendance', golden('attendance.csv'), { period: PERIOD, org, staff: snapshot });
  const o = validateDataset('overtime', golden('overtime.csv'), { period: PERIOD, org, staff: snapshot, control: JSON.parse(golden('overtime.control.json')) });
  assert.deepEqual(a.issues, []);
  assert.deepEqual(o.issues, []);
});

test('attendance_errors.csv matches hand-verified issues', () => {
  const { snapshot } = cleanStaff();
  const r = validateDataset('attendance', golden('attendance_errors.csv'), { period: PERIOD, org, staff: snapshot });
  assert.deepEqual(slim(r.issues), slim(expected('attendance_errors.issues.json')));
});

test('overtime_errors.csv matches hand-verified issues', () => {
  const { snapshot } = cleanStaff();
  const r = validateDataset('overtime', golden('overtime_errors.csv'), { period: PERIOD, org, staff: snapshot });
  assert.deepEqual(slim(r.issues), slim(expected('overtime_errors.issues.json')));
});

test('control total mismatch is blocking', () => {
  const { snapshot } = cleanStaff();
  const r = validateDataset('overtime', golden('overtime.csv'), { period: PERIOD, org, staff: snapshot, control: JSON.parse(golden('overtime_bad_control.control.json')) });
  assert.deepEqual(slim(r.issues), slim(expected('overtime_bad_control.issues.json')));
});

test('missing required column is blocking and stops row validation', () => {
  const { snapshot } = cleanStaff();
  const r = validateDataset('overtime', 'period,uid,ot_hours\n2026-09,U001,5\n', { period: PERIOD, org, staff: snapshot });
  assert.deepEqual(r.issues.map((i) => i.code), ['SCHEMA_MISSING_COLUMN']);
  assert.equal(r.blockingCount, 1);
});

test('issue records never carry sensitive values (name/dob)', () => {
  const r = validateDataset('staff', 'uid,full_name,employment_status,employment_type,join_date,dob,division,department\nU1,Jane Secret,Active,Permanent,2020-01-01,not-a-date,Credit,Retail Credit\n', { period: PERIOD, org });
  const bad = r.issues.find((i) => i.field === 'dob');
  assert.ok(bad);
  assert.equal(bad.value, undefined);
  assert.ok(!JSON.stringify(r.issues).includes('Jane Secret'));
});

test('alias headers are mapped, and mapping is reported', () => {
  const { snapshot } = cleanStaff();
  const r = validateDataset('overtime', 'Month,Employee ID,Overtime Hours,Cost\n2026-09,U001,5,250\n', { period: PERIOD, org, staff: snapshot });
  assert.deepEqual(r.issues, []);
  assert.equal(r.mapping.uid, 'Employee ID');
});
