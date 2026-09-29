// Column profiling + mapping suggestion. Never returns sample values (may be personal data).
import type { DatasetSpec } from './datasets.ts';
import { isValidDate, isValidPeriod } from './dates.ts';

export const normaliseHeader = (h: string) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export interface ColumnProfile { column: string; nonEmpty: number; distinct: number; looksLike: 'date' | 'period' | 'number' | 'text' | 'empty' }
export interface MappingSuggestion {
  mapping: Record<string, string | null>; // canonical field -> source column
  matchedBy: Record<string, 'EXACT' | 'ALIAS'>;
  unmappedColumns: string[];
  missingRequired: string[];
}

export function suggestMapping(headers: string[], spec: DatasetSpec): MappingSuggestion {
  const norm = headers.map(normaliseHeader);
  const used = new Set<number>();
  const mapping: Record<string, string | null> = {};
  const matchedBy: Record<string, 'EXACT' | 'ALIAS'> = {};
  for (const f of spec.fields) {
    let idx = norm.findIndex((h, i) => !used.has(i) && h === f.name);
    if (idx >= 0) matchedBy[f.name] = 'EXACT';
    else {
      idx = norm.findIndex((h, i) => !used.has(i) && (f.aliases ?? []).includes(h));
      if (idx >= 0) matchedBy[f.name] = 'ALIAS';
    }
    if (idx >= 0) { used.add(idx); mapping[f.name] = headers[idx]; } else mapping[f.name] = null;
  }
  return {
    mapping, matchedBy,
    unmappedColumns: headers.filter((_, i) => !used.has(i)),
    missingRequired: spec.fields.filter((f) => f.required && mapping[f.name] === null).map((f) => f.name),
  };
}

export function profileColumns(headers: string[], rows: string[][]): ColumnProfile[] {
  return headers.map((column, i) => {
    const vals = rows.map((r) => (r[i] ?? '').trim()).filter((v) => v !== '');
    let looksLike: ColumnProfile['looksLike'] = 'text';
    if (vals.length === 0) looksLike = 'empty';
    else if (vals.every(isValidDate)) looksLike = 'date';
    else if (vals.every(isValidPeriod)) looksLike = 'period';
    else if (vals.every((v) => /^-?\d+(\.\d+)?$/.test(v))) looksLike = 'number';
    return { column, nonEmpty: vals.length, distinct: new Set(vals).size, looksLike };
  });
}
