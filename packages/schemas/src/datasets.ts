// Dataset specifications = the machine-readable data dictionary (docs are generated from this).
export type FieldType = 'string' | 'date' | 'period' | 'number' | 'enum';

export interface FieldSpec {
  name: string;
  type: FieldType;
  required: boolean;
  description: string;
  allowed?: string[];
  min?: number;
  sensitive?: boolean; // value is never copied into issue records
  aliases?: string[];
}

export interface DatasetSpec {
  id: 'staff' | 'attendance' | 'overtime';
  schemaVersion: string;
  grain: string;
  key: string[];
  fields: FieldSpec[];
}

export const EMPLOYMENT_STATUSES = ['Active', 'Resigned', 'Terminated', 'Retired'];
export const EMPLOYMENT_TYPES = ['Permanent', 'Contract', 'Intern', 'Temporary'];
export const LEAVE_TYPES = ['ANNUAL', 'SICK', 'UNPLANNED', 'LONG_LEAVE'];

export const STAFF_SPEC: DatasetSpec = {
  id: 'staff',
  schemaVersion: 'staff.v1',
  grain: 'One row per employee per reporting-period snapshot',
  key: ['uid'],
  fields: [
    { name: 'uid', type: 'string', required: true, description: 'Employee UID (join key)', aliases: ['employee_id', 'emp_id', 'staff_id'] },
    { name: 'full_name', type: 'string', required: false, sensitive: true, description: 'Employee name (never logged)', aliases: ['name', 'employee_name'] },
    { name: 'employment_status', type: 'enum', required: true, allowed: EMPLOYMENT_STATUSES, description: 'Status at cut-off', aliases: ['status'] },
    { name: 'employment_type', type: 'enum', required: true, allowed: EMPLOYMENT_TYPES, description: 'Employment type', aliases: ['emp_type', 'contract_type'] },
    { name: 'join_date', type: 'date', required: true, description: 'Date joined (YYYY-MM-DD)', aliases: ['date_joined', 'doj'] },
    { name: 'separation_date', type: 'date', required: false, description: 'Date of separation (YYYY-MM-DD)', aliases: ['exit_date', 'last_working_day'] },
    { name: 'dob', type: 'date', required: false, sensitive: true, description: 'Date of birth (age band derived downstream)', aliases: ['date_of_birth'] },
    { name: 'gender', type: 'enum', required: false, allowed: ['M', 'F'], description: 'Gender (M/F; ASSUMPTION A-07)', aliases: ['sex'] },
    { name: 'grade', type: 'string', required: false, description: 'Grade / band', aliases: ['band'] },
    { name: 'role', type: 'string', required: false, description: 'Role / designation', aliases: ['designation', 'position', 'job_title'] },
    { name: 'manager_uid', type: 'string', required: false, description: 'UID of line manager', aliases: ['manager_id', 'reports_to'] },
    { name: 'division', type: 'string', required: true, description: 'Division name (must match hierarchy)', aliases: ['div'] },
    { name: 'department', type: 'string', required: true, description: 'Department name (must match hierarchy)', aliases: ['dept'] },
    { name: 'unit', type: 'string', required: false, description: 'Unit name (must match hierarchy)', aliases: ['team'] },
    { name: 'location', type: 'string', required: false, description: 'Work location', aliases: ['branch', 'island'] },
  ],
};

export const ATTENDANCE_SPEC: DatasetSpec = {
  id: 'attendance',
  schemaVersion: 'attendance.v1',
  grain: 'One row per employee, period and leave type (ASSUMPTION A-03)',
  key: ['period', 'uid', 'leave_type'],
  fields: [
    { name: 'period', type: 'period', required: true, description: 'Reporting period YYYY-MM', aliases: ['month'] },
    { name: 'uid', type: 'string', required: true, description: 'Employee UID', aliases: ['employee_id', 'emp_id'] },
    { name: 'leave_type', type: 'enum', required: true, allowed: LEAVE_TYPES, description: 'Leave category', aliases: ['type'] },
    { name: 'entitlement_days', type: 'number', required: false, min: 0, description: 'Annual entitlement (days)', aliases: ['entitlement'] },
    { name: 'utilised_days', type: 'number', required: true, min: 0, description: 'Days used in the period', aliases: ['days_used', 'used_days'] },
    { name: 'balance_days', type: 'number', required: false, description: 'Balance at period end (days)', aliases: ['balance'] },
  ],
};

export const OVERTIME_SPEC: DatasetSpec = {
  id: 'overtime',
  schemaVersion: 'overtime.v1',
  grain: 'One row per employee per period',
  key: ['period', 'uid'],
  fields: [
    { name: 'period', type: 'period', required: true, description: 'Reporting period YYYY-MM', aliases: ['month'] },
    { name: 'uid', type: 'string', required: true, description: 'Employee UID', aliases: ['employee_id', 'emp_id'] },
    { name: 'ot_hours', type: 'number', required: true, min: 0, description: 'Overtime hours', aliases: ['hours', 'overtime_hours'] },
    { name: 'ot_cost', type: 'number', required: true, min: 0, description: 'Overtime cost (MVR; ASSUMPTION A-08)', aliases: ['cost', 'overtime_cost', 'amount'] },
    { name: 'division', type: 'string', required: false, description: 'Org info as in file; snapshot is authoritative', aliases: ['div'] },
    { name: 'department', type: 'string', required: false, description: 'Org info as in file', aliases: ['dept'] },
    { name: 'unit', type: 'string', required: false, description: 'Org info as in file', aliases: ['team'] },
  ],
};

export const DATASET_SPECS = { staff: STAFF_SPEC, attendance: ATTENDANCE_SPEC, overtime: OVERTIME_SPEC } as const;
