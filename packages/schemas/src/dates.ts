export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
export function isValidPeriod(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}
export function periodStart(period: string): string { return `${period}-01`; }
export function daysInPeriod(period: string): number {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
export function periodEnd(period: string): string {
  return `${period}-${String(daysInPeriod(period)).padStart(2, '0')}`;
}
// ISO date strings compare correctly as strings.
export const lte = (a: string, b: string) => a <= b;
export function ageAt(dob: string, on: string): number {
  const [by, bm, bd] = dob.split('-').map(Number);
  const [oy, om, od] = on.split('-').map(Number);
  let age = oy - by;
  if (om < bm || (om === bm && od < bd)) age--;
  return age;
}
