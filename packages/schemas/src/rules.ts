// Validation rule registry: single source for severity + resolution mode (docs are generated from it).
export type Severity = 'BLOCKING' | 'WARNING';
// FIX_AND_REUPLOAD: cannot be overridden. ACKNOWLEDGE: warning, needs reason.
// FORMAL_RESOLUTION: blocking, but may be formally resolved with reason + reference by an authorised role.
export type ResolutionMode = 'FIX_AND_REUPLOAD' | 'ACKNOWLEDGE' | 'FORMAL_RESOLUTION';

export interface Rule {
  code: string; severity: Severity; category: string; datasets: string[]; resolution: ResolutionMode;
  description: string; implemented: boolean;
}
const R = (code: string, severity: Severity, category: string, datasets: string[], resolution: ResolutionMode, description: string, implemented = true): Rule =>
  ({ code, severity, category, datasets, resolution, description, implemented });
const B = 'BLOCKING', W = 'WARNING', FIX = 'FIX_AND_REUPLOAD', ACK = 'ACKNOWLEDGE';

export const RULES: Rule[] = [
  R('SCHEMA_MISSING_COLUMN', B, 'Schema', ['all'], FIX, 'A required column is not present/mapped.'),
  R('SCHEMA_VERSION_UNSUPPORTED', B, 'Schema', ['all'], FIX, 'Template/schema version not supported.', false),
  R('SCHEMA_DRIFT', W, 'Change detection', ['all'], ACK, 'Columns changed versus previous approved batch.', false),
  R('ROW_SHAPE', B, 'Schema', ['all'], FIX, 'Row has a different number of cells than the header.'),
  R('REQUIRED_FIELD', B, 'Schema', ['all'], FIX, 'Required value is empty.'),
  R('INVALID_DATE', B, 'Dates', ['all'], FIX, 'Not a real calendar date / period (expected YYYY-MM-DD or YYYY-MM).'),
  R('INVALID_NUMBER', B, 'Range', ['attendance', 'overtime'], FIX, 'Not a number.'),
  R('INVALID_VALUE', B, 'Schema', ['all'], FIX, 'Value not in the allowed list.'),
  R('NEGATIVE_VALUE', B, 'Range', ['attendance', 'overtime'], FIX, 'Value below the field minimum (e.g. negative OT hours).'),
  R('DUPLICATE_UID', B, 'Duplicates', ['staff'], FIX, 'UID appears more than once in the staff file (all involved rows flagged).'),
  R('DUPLICATE_KEY', B, 'Duplicates', ['attendance', 'overtime'], FIX, 'Repeated dataset key (UID-period[-leave type]); all involved rows flagged.'),
  R('UNKNOWN_UID', B, 'Identity', ['attendance', 'overtime'], 'FORMAL_RESOLUTION', 'UID not in the approved employee snapshot. Blocking unless formally resolved.'),
  R('UNKNOWN_ORG', B, 'Organisation', ['staff'], FIX, 'Division/department/unit name not found in the hierarchy.'),
  R('ORG_NOT_EFFECTIVE', B, 'Organisation', ['staff'], FIX, 'Org unit exists but is not effective at the period cut-off.'),
  R('ORG_MISMATCH_SNAPSHOT', W, 'Organisation', ['overtime'], ACK, 'Org fields in the file differ from the staff snapshot (snapshot is used; nothing is corrected silently).'),
  R('PERIOD_MISMATCH', B, 'Dates', ['attendance', 'overtime'], FIX, 'Row period differs from the reporting period.'),
  R('DATE_ORDER', B, 'Dates', ['staff'], FIX, 'Separation date is before join date.'),
  R('MISSING_SEPARATION_DATE', B, 'Cross-field', ['staff'], FIX, 'Status is not Active but no separation date given.'),
  R('ACTIVE_WITH_PAST_SEPARATION', B, 'Cross-field', ['staff'], FIX, 'Status Active but separation date is on/before cut-off.'),
  R('FUTURE_SEPARATION', W, 'Range', ['staff'], ACK, 'Separation date after the period cut-off.'),
  R('MANAGER_NOT_FOUND', W, 'Identity', ['staff'], ACK, 'manager_uid not present in the staff file.'),
  R('DOB_IMPLAUSIBLE', W, 'Range', ['staff'], ACK, 'Age at cut-off below 16 or above 80 (thresholds PENDING HR SIGN-OFF).'),
  R('UTILISED_EXCEEDS_PERIOD', B, 'Range', ['attendance'], FIX, 'Utilised days exceed calendar days in the period.'),
  R('BALANCE_EXCEEDS_ENTITLEMENT', W, 'Range', ['attendance'], ACK, 'Leave balance greater than entitlement.'),
  R('OT_HOURS_OUTLIER', W, 'Range', ['overtime'], ACK, 'OT hours above outlier threshold (200; PENDING HR SIGN-OFF).'),
  R('OT_HOURS_IMPOSSIBLE', B, 'Range', ['overtime'], FIX, 'OT hours exceed the hours in the period.'),
  R('SEPARATED_BEFORE_PERIOD', W, 'Cross-dataset', ['attendance', 'overtime'], ACK, 'Record exists for an employee separated before the period started.'),
  R('CONTROL_TOTAL_MISMATCH', B, 'Reconciliation', ['overtime'], FIX, 'Row count / total hours / total cost differs from the supplied control total.'),
  R('CHANGE_HEADCOUNT_JUMP', W, 'Change detection', ['staff'], ACK, 'Unexpected headcount movement vs previous period.', false),
  R('CHANGE_COST_MOVEMENT', W, 'Change detection', ['overtime'], ACK, 'Large OT cost movement vs previous period.', false),
  R('COMPLETENESS_MISSING_DATASET', B, 'Completeness', ['period'], FIX, 'Expected dataset missing for the cycle.', false),
  R('COMPLETENESS_MISSING_DIVISION', W, 'Completeness', ['period'], ACK, 'Expected division has no rows.', false),
];
export const RULE_BY_CODE = new Map(RULES.map((r) => [r.code, r] as const));
