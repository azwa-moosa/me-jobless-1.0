// Effective-dated organisation hierarchy: Bank -> Division -> Department -> Unit.
import { parseCsv } from './csv.ts';
import { isValidDate } from './dates.ts';

export type OrgLevel = 'BANK' | 'DIVISION' | 'DEPARTMENT' | 'UNIT';
export interface OrgUnitRow {
  unitId: string; level: OrgLevel; name: string; parentId: string | null;
  effectiveFrom: string; effectiveTo: string | null;
}
export interface OrgIndex {
  units: OrgUnitRow[];
  byId: Map<string, OrgUnitRow>;
  ancestorsOf(id: string): string[]; // id itself first, then parents up to the root
}
const ORDER: OrgLevel[] = ['BANK', 'DIVISION', 'DEPARTMENT', 'UNIT'];

export function parseOrgCsv(text: string): OrgUnitRow[] {
  const { headers, rows } = parseCsv(text);
  const ix = (n: string) => headers.indexOf(n);
  return rows.map((r) => ({
    unitId: r[ix('unit_id')].trim(), level: r[ix('level')].trim() as OrgLevel, name: r[ix('name')].trim(),
    parentId: r[ix('parent_id')].trim() || null,
    effectiveFrom: r[ix('effective_from')].trim(), effectiveTo: r[ix('effective_to')].trim() || null,
  }));
}

export function buildOrgIndex(units: OrgUnitRow[]): OrgIndex {
  const byId = new Map(units.map((u) => [u.unitId, u] as const));
  return {
    units, byId,
    ancestorsOf(id: string) {
      const out: string[] = [];
      let cur = byId.get(id);
      const seen = new Set<string>();
      while (cur && !seen.has(cur.unitId)) {
        out.push(cur.unitId); seen.add(cur.unitId);
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
      }
      return out;
    },
  };
}

/** Structural checks on the hierarchy itself (run when the reference is loaded). */
export function validateHierarchy(units: OrgUnitRow[]): string[] {
  const errs: string[] = [];
  const byId = new Map(units.map((u) => [u.unitId, u] as const));
  if (byId.size !== units.length) errs.push('duplicate unit_id');
  for (const u of units) {
    if (!ORDER.includes(u.level)) { errs.push(`${u.unitId}: invalid level`); continue; }
    if (!isValidDate(u.effectiveFrom) || (u.effectiveTo && !isValidDate(u.effectiveTo))) errs.push(`${u.unitId}: invalid effective date`);
    if (u.effectiveTo && u.effectiveTo < u.effectiveFrom) errs.push(`${u.unitId}: effective_to before effective_from`);
    if (u.level === 'BANK') { if (u.parentId) errs.push(`${u.unitId}: bank must have no parent`); continue; }
    const p = u.parentId ? byId.get(u.parentId) : undefined;
    if (!p) { errs.push(`${u.unitId}: parent missing`); continue; }
    if (ORDER.indexOf(p.level) !== ORDER.indexOf(u.level) - 1) errs.push(`${u.unitId}: parent level must be one level above`);
  }
  return errs;
}

export const isEffective = (u: OrgUnitRow, on: string) => u.effectiveFrom <= on && (u.effectiveTo === null || on <= u.effectiveTo);
const norm = (s: string) => s.trim().toLowerCase();

export type OrgResolution =
  | { ok: true; divisionId: string; departmentId: string; unitId: string | null }
  | { ok: false; code: 'UNKNOWN_ORG' | 'ORG_NOT_EFFECTIVE'; field: 'division' | 'department' | 'unit' };

/** Resolve free-text names to hierarchy ids as at `on`. Never guesses: a miss is an error. */
export function resolveOrg(org: OrgIndex, names: { division: string; department: string; unit?: string | null }, on: string): OrgResolution {
  const find = (level: OrgLevel, name: string, parentId: string | null) =>
    org.units.filter((u) => u.level === level && norm(u.name) === norm(name) && (parentId === null || u.parentId === parentId));
  const step = (level: OrgLevel, field: 'division' | 'department' | 'unit', name: string, parentId: string | null) => {
    const cands = find(level, name, parentId);
    if (cands.length === 0) return { fail: { ok: false as const, code: 'UNKNOWN_ORG' as const, field } };
    const eff = cands.find((c) => isEffective(c, on));
    if (!eff) return { fail: { ok: false as const, code: 'ORG_NOT_EFFECTIVE' as const, field } };
    return { unit: eff };
  };
  const root = org.units.find((u) => u.level === 'BANK');
  const d = step('DIVISION', 'division', names.division, root ? root.unitId : null);
  if (d.fail) return d.fail;
  const p = step('DEPARTMENT', 'department', names.department, d.unit!.unitId);
  if (p.fail) return p.fail;
  if (names.unit && names.unit.trim() !== '') {
    const u = step('UNIT', 'unit', names.unit, p.unit!.unitId);
    if (u.fail) return u.fail;
    return { ok: true, divisionId: d.unit!.unitId, departmentId: p.unit!.unitId, unitId: u.unit!.unitId };
  }
  return { ok: true, divisionId: d.unit!.unitId, departmentId: p.unit!.unitId, unitId: null };
}
