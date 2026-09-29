# Open Questions (mapped to Blueprint Appendix B)

Nothing here is decided. Defaults used in the build are in `ASSUMPTIONS.md`. "Cost of wrong guess": Low = config change; High = rework of data model or process.

## B1. Final source datasets and monthly owners (HR Analytics + source teams)
- Q1.1 Confirm owner, cadence and delivery format (CSV vs Excel) for each dataset in data-inventory.md. Phase 1 accepts UTF-8 CSV only. (Med)
- Q1.2 **Attendance grain**: per employee-period-leave type (assumed) or leave transactions? (**High**)
- Q1.3 Will source teams provide control totals (rows/hours/cost)? Format? (Low)
- Q1.4 Allowed values for employment status, employment type, gender, leave types (A-07). (Low)

## B2. Formal KPI definitions and exclusions (HR Analytics / ER / HR functions) - ALL PENDING HR SIGN-OFF
- Q2.1 Headcount: include interns/contractors/temporary? (default Permanent+Contract, A-13). (Low)
- Q2.2 Retention and turnover: numerator, denominator (average vs period headcount), period rule (monthly/annualised/YTD), early-turnover threshold. (Low, but affects every comparison)
- Q2.3 Absence rate: which leave types count, denominator (headcount x working days assumed), holiday handling, treatment of part-month staff. (Low)
- Q2.4 Leave utilisation: "unplanned" and "mandatory annual" definitions and entitlement basis. (Low)
- Q2.5 Internal mobility: numerator events and population denominator. (Low)
- Q2.6 Overtime: bands (0-19/20-39/40+ assumed as half-open [0,20), [20,40), [40,inf)), per-employee denominator (headcount vs employees with OT), outlier limit (200 h assumed), cost currency (MVR). (Low)
- Q2.7 Legacy dashboards contain wording/calculation inconsistencies (Blueprint s7, Appx A): which figures should be reconciled in UAT? (Med)

## B3. Organisation hierarchy source of truth (HR + HRIS/IT)
- Q3.1 Is the hierarchy maintained manually in the platform or fed from HRIS? Who approves changes? (**High**)
- Q3.2 Mid-period restructures: which date defines placement (cut-off assumed, A-14)? (Med)
- Q3.3 Do all divisions use Unit level? (Low)

## B4. Production technology stack (IT Architecture + InfoSec + HR)
- Q4.1 Approve Next.js + NestJS + PostgreSQL + worker queue + Docker, or ASP.NET/Azure SQL/Power Platform? All Phase 1 code is written for the assumed stack (A-01). (**High** if rejected)
- Q4.2 Approved language/runtime versions and CI/CD. (Med)

## B5. Hosting / data residency / AI approval (IT / InfoSec / Risk)
- Q5.1 Hosting tenant, residency, encryption, retention, backup RPO/RTO, log retention. (Med)
- Q5.2 Approved AI endpoint (needed only from Phase 4). (Low now)

## B6. User roles and scope matrix (HR leadership + IT IAM)
- Q6.1 Confirm role list and the matrix in access-matrix.md; Entra group -> role/scope mapping. (Med)
- Q6.2 May Division/Department Heads see employee-level detail? (default: no, A-09). (Med)
- Q6.3 Can HR Analytics Admin see employee-level ER data? (default: no, A-10). (Med)
- Q6.4 Who approves validation overrides and unknown-UID resolutions (single approver vs four-eyes)? (Med)

## B7. Engagement anonymity rules (HR / survey owner)
- Q7.1 Minimum response count for drill-down; suppression method. (Low now; Phase 3)

## B8. ER aggregation and restricted-access rules (ER leadership)
- Q8.1 Small-cell suppression threshold, allowed aggregate categories, who may see ageing. (Low now; Phase 3)

## B9. Pilot divisions and UAT periods (HR)
- Q9.1 Which divisions/periods will HR reconcile against manual dashboards? Who signs UAT? (Low)

## B10. Publication and correction governance (HR leadership)
- Q10.1 Who may reopen a published month, required approver and reason wording; how are recipients notified of restatements? (Med; Phase 3)

## Additional gaps found in the Blueprint (not in Appendix B)
- Q11.1 Schema/template version format and how templates are distributed.
- Q11.2 Who may add a missing employee to Staff (unknown-UID resolution path) and what evidence is required.
- Q11.3 Is UID considered personal data for issue-list display and audit references?
- Q11.4 Approval level: per batch (built) vs per period as well (state machine in Blueprint s17). Current build: period ready when Staff, Attendance and OT batches are each approved.
