// Versioned metric definitions. Anything needing HR sign-off is CONFIGURATION, never a hard-coded constant.
export type MetricStatus = 'DRAFT' | 'PENDING_HR_SIGN_OFF' | 'APPROVED';
export interface MetricDefinition {
  id: string; name: string; domain: string; version: string; status: MetricStatus; owner: string;
  definition: string; numerator: string; denominator: string; exclusions: string; grain: string;
  dimensions: string[]; thresholds: string; implemented: boolean; config: Record<string, unknown>;
}
const HRA = 'HR Analytics', ER = 'ER Leadership';
const D = (id: string, domain: string, name: string, definition: string, numerator: string, denominator: string, exclusions: string, dimensions: string[], thresholds: string, owner: string, implemented = false, config: Record<string, unknown> = {}): MetricDefinition =>
  ({ id, name, domain, version: '0.1.0', status: 'PENDING_HR_SIGN_OFF', owner, definition, numerator, denominator, exclusions, grain: 'Reporting period (month)', dimensions, thresholds, implemented, config });
const ORG = ['bank', 'division', 'department', 'unit'];
const TBD = 'PENDING HR SIGN-OFF';

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  // ---- Workforce
  D('WF-HEADCOUNT', 'Workforce', 'Headcount', 'Employees employed at reporting cut-off.', 'Count of staff with join_date <= cut-off and (no separation_date or separation_date > cut-off), employment_type in config', 'n/a (count)', 'Employment types not in config (interns/temporary; PENDING)', [...ORG, 'gender', 'grade', 'employment_type'], TBD, HRA, true, { includeEmploymentTypes: ['Permanent', 'Contract'] }),
  D('WF-RETENTION', 'Workforce', 'Retention', '1 - applicable turnover rate.', '1 - TRN-TURNOVER', 'per TRN-TURNOVER', 'Per turnover definition', ORG, TBD, HRA),
  D('WF-AVG-AGE', 'Workforce', 'Average age', 'Mean age at cut-off.', 'Sum of ages', 'Headcount with DOB', 'Missing DOB', ORG, TBD, HRA),
  D('WF-AVG-SERVICE', 'Workforce', 'Average service', 'Mean years of service at cut-off.', 'Sum of service years', 'Headcount', 'None', ORG, TBD, HRA),
  D('WF-GENERATION', 'Workforce', 'Generation mix', 'Headcount share by generation band (band cut-offs PENDING).', 'Headcount in band', 'Headcount', 'Missing DOB', ORG, TBD, HRA),
  D('WF-GENDER', 'Workforce', 'Gender composition', 'Headcount share by gender.', 'Headcount by gender', 'Headcount', 'Missing gender', ORG, TBD, HRA),
  D('WF-LEADER-GENDER', 'Workforce', 'Leadership gender ratio', 'Gender share within leadership grades (grade list PENDING).', 'Leaders by gender', 'Leaders', 'Non-leadership grades', ORG, TBD, HRA),
  D('WF-EMP-LEADER-RATIO', 'Workforce', 'Employee:leader ratio', 'Non-leaders per leader.', 'Non-leader headcount', 'Leader headcount', 'None', ORG, TBD, HRA),
  D('WF-ORG-MANPOWER', 'Workforce', 'Organisational manpower', 'Headcount per org unit.', 'Headcount', 'n/a', 'As WF-HEADCOUNT', ORG, TBD, HRA),
  // ---- Attendance
  D('ATT-ABSENCE-RATE', 'Attendance', 'Absence rate', 'Absence days / available working days for the headcount population.', 'Utilised days of absence leave types for employees in headcount', 'Headcount x working days in period', 'Leave types not in config (ANNUAL, LONG_LEAVE by default); employees not in headcount; public holidays via working-days config', [...ORG, 'leave_type'], TBD, HRA, true, { absenceLeaveTypes: ['SICK', 'UNPLANNED'] }),
  D('ATT-ABSENCE-FORECAST', 'Attendance', 'Forecast absence rate', 'Model forecast (Phase 5).', 'n/a', 'n/a', 'Insufficient history', ORG, TBD, HRA),
  D('ATT-UNPLANNED-UTIL', 'Attendance', 'Unplanned leave utilisation', 'Unplanned leave used / entitlement (entitlement rule PENDING).', 'UNPLANNED days used', 'Approved entitlement', TBD, ORG, TBD, HRA),
  D('ATT-MANDATORY-UTIL', 'Attendance', 'Mandatory annual leave utilisation', 'Mandatory annual leave used / mandatory entitlement (definition PENDING; Phase 1 uses ANNUAL).', 'ANNUAL days used (headcount)', 'ANNUAL entitlement (headcount)', 'Employees not in headcount; rows without entitlement', ORG, TBD, HRA, true, { leaveType: 'ANNUAL' }),
  D('ATT-LONG-LEAVE-COUNT', 'Attendance', 'Long-leave count', 'Employees with LONG_LEAVE in period.', 'Distinct UIDs with LONG_LEAVE days > 0', 'n/a', TBD, ORG, TBD, HRA),
  D('ATT-LONG-LEAVE-SHARE', 'Attendance', 'Long-leave share', 'Long-leave employees / headcount.', 'ATT-LONG-LEAVE-COUNT', 'Headcount', TBD, ORG, TBD, HRA),
  // ---- Recruitment / mobility
  D('REC-NEW-HIRES', 'Recruitment', 'New hires', 'Hire events in period.', 'Hire events', 'n/a', TBD, ORG, TBD, HRA),
  D('REC-VACANCIES', 'Recruitment', 'Vacancies', 'Open vacancies at cut-off.', 'Open vacancies', 'n/a', TBD, ORG, TBD, HRA),
  D('REC-TRANSFERS-IN', 'Recruitment', 'Transfers in', 'Transfer events into unit.', 'Transfers in', 'n/a', TBD, ORG, TBD, HRA),
  D('REC-TRANSFERS-OUT', 'Recruitment', 'Transfers out', 'Transfer events out of unit.', 'Transfers out', 'n/a', TBD, ORG, TBD, HRA),
  D('REC-PROMOTIONS', 'Recruitment', 'Promotions', 'Promotion events.', 'Promotions', 'n/a', TBD, ORG, TBD, HRA),
  D('REC-TOTAL-PLACEMENTS', 'Recruitment', 'Total placements', 'Hires + transfers in + promotions (composition PENDING).', 'Sum of events', 'n/a', TBD, ORG, TBD, HRA),
  D('REC-MOBILITY-RATE', 'Recruitment', 'Internal mobility rate', 'Movement events / approved population denominator (must be formally agreed).', 'Movement events', TBD, TBD, ORG, TBD, HRA),
  D('REC-TREND', 'Recruitment', 'Monthly recruitment trend', 'Monthly series of placements.', 'REC-TOTAL-PLACEMENTS by month', 'n/a', 'None', ORG, TBD, HRA),
  // ---- Turnover
  D('TRN-TURNOVER', 'Turnover', 'Turnover rate', 'Separations / approved average or period headcount (denominator rule PENDING).', 'Separations in period', TBD, TBD, [...ORG, 'voluntary_involuntary', 'reason'], TBD, HRA),
  D('TRN-EARLY', 'Turnover', 'Early turnover', 'Separations within an early-service threshold (threshold PENDING).', 'Separations with service < threshold', TBD, TBD, ORG, TBD, HRA),
  D('TRN-VOL-INVOL', 'Turnover', 'Voluntary / involuntary counts', 'Separations by type.', 'Separations by type', 'n/a', 'None', ORG, TBD, HRA),
  D('TRN-REASONS', 'Turnover', 'Separation reasons', 'Separations by approved reason group.', 'Separations by reason', 'n/a', 'None', ORG, TBD, HRA),
  D('TRN-SERVICE-AT-EXIT', 'Turnover', 'Service at exit', 'Mean/band of service years at separation.', 'Service years', 'Separations', 'None', ORG, TBD, HRA),
  D('TRN-RESIGNATION-TREND', 'Turnover', 'Resignation trend', 'Monthly resignations.', 'Resignations by month', 'n/a', 'None', ORG, TBD, HRA),
  // ---- ER (restricted)
  D('ER-ACTIVE-CASES', 'ER', 'Active disciplinary cases', 'Open disciplinary cases at cut-off.', 'Open cases', 'n/a', 'Small-cell suppression PENDING', ORG, TBD, ER),
  D('ER-GRIEVANCES', 'ER', 'Grievances', 'Grievance cases.', 'Grievance cases', 'n/a', 'Small-cell suppression PENDING', ORG, TBD, ER),
  D('ER-SUSPENSIONS', 'ER', 'Suspensions', 'Suspension actions.', 'Suspensions', 'n/a', 'Small-cell suppression PENDING', ORG, TBD, ER),
  D('ER-COMPLETED', 'ER', 'Completed cases', 'Closed cases in period.', 'Closed cases', 'n/a', 'Small-cell suppression PENDING', ORG, TBD, ER),
  D('ER-ACTION-TYPE', 'ER', 'Letter/action type', 'Cases by action/letter type.', 'Cases by type', 'n/a', 'Small-cell suppression PENDING', ORG, TBD, ER),
  D('ER-ROOT-CAUSE', 'ER', 'Approved root-cause group', 'Cases by approved root-cause group.', 'Cases by group', 'n/a', 'Small-cell suppression PENDING', ORG, TBD, ER),
  // ---- Overtime
  D('OT-HOURS', 'Overtime', 'Overtime hours', 'Sum of OT hours for employees in headcount.', 'Sum ot_hours', 'n/a', 'Employees not in headcount at cut-off', [...ORG, 'band'], 'OT >= 40 h flagged (band PENDING)', HRA, true),
  D('OT-COST', 'Overtime', 'Overtime cost', 'Sum of OT cost (MVR) for employees in headcount.', 'Sum ot_cost', 'n/a', 'As OT-HOURS', ORG, TBD, HRA, true),
  D('OT-HOURS-PER-EMP', 'Overtime', 'OT hours per employee', 'OT hours / employee denominator (config).', 'OT-HOURS', 'Headcount (default) or employees with OT', 'As OT-HOURS', ORG, TBD, HRA, true, { denominator: 'headcount' }),
  D('OT-COST-PER-EMP', 'Overtime', 'OT cost per employee', 'OT cost / employee denominator (config).', 'OT-COST', 'Headcount (default) or employees with OT', 'As OT-HOURS', ORG, TBD, HRA, true, { denominator: 'headcount' }),
  D('OT-TREND', 'Overtime', 'OT monthly trend', 'Monthly series of OT hours/cost.', 'OT-HOURS by month', 'n/a', 'None', ORG, TBD, HRA),
  D('OT-DEPT-COST', 'Overtime', 'OT department cost', 'OT cost by department.', 'OT-COST by department', 'n/a', 'None', ['department'], TBD, HRA),
  D('OT-BANDS', 'Overtime', 'OT utilisation bands', 'Employees with OT by hours band. Half-open bands [min,max).', 'Employees with OT in band', 'n/a', 'Employees not in headcount', [...ORG, 'band'], 'Bands PENDING HR SIGN-OFF', HRA, true, { bands: [{ id: 'LOW', min: 0, max: 20 }, { id: 'MEDIUM', min: 20, max: 40 }, { id: 'HIGH', min: 40, max: null }] }),
  // ---- Recognition
  D('RCG-UNIQUE', 'Recognition', 'Unique recognised employees', 'Distinct recognised employees.', 'Distinct UIDs recognised', 'n/a', TBD, ORG, TBD, HRA),
  D('RCG-COVERAGE', 'Recognition', 'Recognition coverage', 'Unique recognised / eligible population.', 'RCG-UNIQUE', 'Eligible population (PENDING)', TBD, ORG, TBD, HRA),
  D('RCG-YET', 'Recognition', 'Yet-to-recognise', 'Eligible not yet recognised.', 'Eligible - recognised', 'n/a', TBD, ORG, TBD, HRA),
  D('RCG-INDIV-TEAM', 'Recognition', 'Individual vs team', 'Events by individual/team.', 'Events by type', 'n/a', 'None', ORG, TBD, HRA),
  D('RCG-PROGRAMME', 'Recognition', 'Award/programme breakdown', 'Events by programme.', 'Events by programme', 'n/a', 'None', ORG, TBD, HRA),
  // ---- Training
  D('TRG-PROGRAMMES', 'Training', 'Programmes', 'Distinct programmes delivered.', 'Distinct programmes', 'n/a', 'None', ORG, TBD, HRA),
  D('TRG-ATTENDANCES', 'Training', 'Attendances', 'Participation records.', 'Attendance rows', 'n/a', 'None', ORG, TBD, HRA),
  D('TRG-HOURS', 'Training', 'Training hours', 'Sum of hours.', 'Sum hours', 'n/a', 'None', ORG, TBD, HRA),
  D('TRG-UNIQUE', 'Training', 'Unique participants', 'Distinct participants.', 'Distinct UIDs', 'n/a', 'None', ORG, TBD, HRA),
  D('TRG-REPEAT', 'Training', 'Repeat participants', 'Participants with >1 attendance.', 'Distinct UIDs with >1', 'n/a', 'None', ORG, TBD, HRA),
  D('TRG-MODE', 'Training', 'Internal/external, local/overseas/online', 'Breakdown by delivery type.', 'Attendances by type', 'n/a', 'None', ORG, TBD, HRA),
  // ---- Engagement (anonymity thresholds apply)
  D('ENG-SCORE', 'Engagement', 'Engagement score', 'Survey score (aggregate).', 'Score', 'n/a', 'Below minimum-response threshold (PENDING)', ORG, TBD, HRA),
  D('ENG-PARTICIPATION', 'Engagement', 'Participation', 'Responses / eligible.', 'Responses', 'Eligible', 'Below minimum-response threshold (PENDING)', ORG, TBD, HRA),
  D('ENG-THEMES', 'Engagement', 'Theme scores', 'Scores by theme.', 'Theme score', 'n/a', 'Below minimum-response threshold (PENDING)', ORG, TBD, HRA),
  D('ENG-ORG-COMPARE', 'Engagement', 'Organisational comparison', 'Unit vs parent.', 'Score', 'n/a', 'Below minimum-response threshold (PENDING)', ORG, TBD, HRA),
  D('ENG-ACTION-STATUS', 'Engagement', 'Action-plan status', 'Action plans by status.', 'Actions', 'n/a', 'None', ORG, TBD, HRA),
];
export const DEFINITION_BY_ID = new Map(METRIC_DEFINITIONS.map((d) => [d.id, d] as const));
