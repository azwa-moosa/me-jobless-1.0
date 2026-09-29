# Data Inventory

Owners and cadences below are **proposals** taken from the Blueprint (section 6) and must be confirmed by HR Analytics (Appendix B, decision 1). "Phase 1" = implemented in this build; others are contract-only.

| # | Dataset | Owner (proposed) | Cadence | Grain | Key | Sensitivity | Phase |
|---|---|---|---|---|---|---|---|
| 1 | Org hierarchy reference (org_units) | HR + HRIS/IT (Appx B #3) | On change, effective-dated | One row per org unit version | unit_id | Low | 1 (seeded reference) |
| 2 | Employee / Staff Master | HR Analytics | Monthly | One row per employee per period snapshot | uid | High (personal) | 1 |
| 3 | Attendance / Leave | HR Operations / divisions | Monthly | Employee-period-leave type (assumption A-03) | period+uid+leave_type | High | 1 |
| 4 | Overtime | Payroll / divisions | Monthly | Employee-period | period+uid | High (cost) | 1 |
| 5 | Recruitment & Movement | Talent Acquisition / HR Ops | Monthly | Event | event id | High | 3 |
| 6 | Turnover / Separation | HR Ops | Monthly | Separation event | uid+separation_date | High | 3 |
| 7 | Recognition | HR / Engagement | Monthly | Award event | event id | Medium | 3 |
| 8 | Training | L&D | Monthly | Attendance event | uid+programme+date | Medium | 3 |
| 9 | ER / Disciplinary | ER leadership | Monthly | Case / letter | case id | **Restricted** | 3 (restricted module) |
| 10 | Engagement | HR / survey owner | Per survey cycle | Survey aggregate (anonymity thresholds) | cycle+org | Medium (small-cell risk) | 3 |
| 11 | Control totals (optional sidecar) | File owner | With each upload | Per file | dataset+period | Low | 1 (overtime) |
| 12 | Working-days calendar | HR Analytics | Yearly / monthly | Period | period | Low | 1 (config, assumption A-11) |

Retention/backup/residency: PENDING IT / Information Security (Blueprint section 12, Appx B #4-5). Raw files are stored with SHA-256 checksum and never overwritten; corrections are new versions.
