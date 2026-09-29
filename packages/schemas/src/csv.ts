// Minimal RFC-4180-style CSV parser (no dependencies). Erasable TypeScript only.
export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export function parseCsv(text: string): ParsedCsv {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const records: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      records.push(row); row = [];
    } else field += c;
  }
  if (field !== '' || row.length > 0) { row.push(field); records.push(row); }
  const nonEmpty = records.filter((r) => !(r.length === 1 && r[0].trim() === ''));
  const headers = (nonEmpty.shift() ?? []).map((h) => h.trim());
  return { headers, rows: nonEmpty };
}
