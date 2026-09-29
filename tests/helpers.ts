import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildOrgIndex, parseOrgCsv, toStaffSnapshot, validateDataset } from '../packages/schemas/src/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
export const golden = (name: string) => readFileSync(join(here, '..', 'sample-data', 'golden', name), 'utf8');
export const expected = (name: string) => JSON.parse(golden(`expected/${name}`));
export const PERIOD = '2026-09';
export const org = buildOrgIndex(parseOrgCsv(golden('org_units.csv')));

export function cleanStaff() {
  const r = validateDataset('staff', golden('staff.csv'), { period: PERIOD, org });
  return { result: r, snapshot: toStaffSnapshot(r.records) };
}
type Slim = { row: number | null; field: string | null; code: string; severity: string };
export const slim = (issues: Slim[]) =>
  issues.map((i) => ({ row: i.row, field: i.field, code: i.code, severity: i.severity }))
    .sort((a, b) => (a.row ?? 1e9) - (b.row ?? 1e9) || String(a.field).localeCompare(String(b.field)) || a.code.localeCompare(b.code));
