// Access matrix: the single source of truth for role x permission. docs/access-matrix.md is generated from this.
export const ROLES = ['HR_ANALYTICS_ADMIN', 'ER_RESTRICTED', 'HR_LEADERSHIP', 'DIVISION_HEAD', 'DEPARTMENT_HEAD', 'READONLY_LEADERSHIP', 'SYSTEM_ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export type DataLevel = 'NONE' | 'METADATA' | 'AGGREGATE' | 'EMPLOYEE_LEVEL';
export interface PermissionSpec {
  permission: string; module: string; description: string; dataLevel: DataLevel;
  scoped: boolean; // true: target org unit must be inside the user's scope
  roles: Role[]; notes: string;
}
const HR: Role[] = ['HR_ANALYTICS_ADMIN'];
export const PERMISSIONS: PermissionSpec[] = [
  { permission: 'period.create', module: 'Reporting periods', description: 'Create/manage reporting periods', dataLevel: 'METADATA', scoped: true, roles: HR, notes: '' },
  { permission: 'upload.create', module: 'Upload Centre', description: 'Upload source files, change mapping, run validation', dataLevel: 'EMPLOYEE_LEVEL', scoped: true, roles: HR, notes: 'Raw files contain employee-level data' },
  { permission: 'issues.view', module: 'Data Quality', description: 'View issue list with row/field detail', dataLevel: 'EMPLOYEE_LEVEL', scoped: true, roles: HR, notes: 'Issue rows reference UIDs' },
  { permission: 'validation.override', module: 'Data Quality', description: 'Acknowledge warnings / formally resolve unknown UIDs (reason required)', dataLevel: 'EMPLOYEE_LEVEL', scoped: true, roles: HR, notes: 'Always audited; hard blocking rules cannot be overridden' },
  { permission: 'upload.approve', module: 'Upload Centre', description: 'Approve source snapshot / supersede with new version', dataLevel: 'EMPLOYEE_LEVEL', scoped: true, roles: HR, notes: 'Approved snapshots immutable' },
  { permission: 'metric.config.edit', module: 'Administration', description: 'Edit metric definitions/thresholds (versioned)', dataLevel: 'METADATA', scoped: true, roles: HR, notes: 'Sign-off status changes need HR leadership sign-off (process, not code)' },
  { permission: 'dashboard.view', module: 'Dashboards', description: 'View PUBLISHED aggregate dashboards', dataLevel: 'AGGREGATE', scoped: true, roles: ['HR_ANALYTICS_ADMIN', 'HR_LEADERSHIP', 'DIVISION_HEAD', 'DEPARTMENT_HEAD', 'READONLY_LEADERSHIP', 'ER_RESTRICTED'], notes: 'Never work-in-progress data. Phase 2+' },
  { permission: 'employee.detail.view', module: 'Dashboards', description: 'Employee-level drill-down', dataLevel: 'EMPLOYEE_LEVEL', scoped: true, roles: ['HR_ANALYTICS_ADMIN', 'HR_LEADERSHIP'], notes: 'Division/Department Heads: aggregate only (ASSUMPTION A-09)' },
  { permission: 'er.aggregate.view', module: 'ER', description: 'Aggregated ER indicators', dataLevel: 'AGGREGATE', scoped: true, roles: ['HR_ANALYTICS_ADMIN', 'HR_LEADERSHIP', 'ER_RESTRICTED'], notes: 'Small-cell suppression PENDING ER sign-off (A-10)' },
  { permission: 'er.employee_level.view', module: 'ER', description: 'Employee-level ER case data', dataLevel: 'EMPLOYEE_LEVEL', scoped: true, roles: ['ER_RESTRICTED'], notes: 'Restricted: HR Analytics Admin does NOT get this by default (A-10)' },
  { permission: 'export.aggregate', module: 'Exports', description: 'Export aggregate published snapshot', dataLevel: 'AGGREGATE', scoped: true, roles: ['HR_ANALYTICS_ADMIN', 'HR_LEADERSHIP', 'DIVISION_HEAD', 'DEPARTMENT_HEAD'], notes: 'Exports audited; include period, time, scope, version' },
  { permission: 'export.employee_level', module: 'Exports', description: 'Employee-level export', dataLevel: 'EMPLOYEE_LEVEL', scoped: true, roles: HR, notes: 'Disabled for non-HR by default' },
  { permission: 'admin.access', module: 'Administration', description: 'Manage users, roles and org scopes', dataLevel: 'METADATA', scoped: false, roles: ['SYSTEM_ADMIN'], notes: 'No business-data privileges; every change audited' },
  { permission: 'audit.view', module: 'Audit', description: 'View audit trail', dataLevel: 'METADATA', scoped: false, roles: ['SYSTEM_ADMIN', 'HR_ANALYTICS_ADMIN'], notes: 'Audit contains no employee data by design' },
];
export const PERMISSION_BY_NAME = new Map(PERMISSIONS.map((p) => [p.permission, p] as const));
