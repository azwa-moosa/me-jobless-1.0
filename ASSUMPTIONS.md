# Assumptions (Phase 0/1)

Each is the simplest safe default; all are reversible unless marked. See open-questions.md for who decides.

| ID | Assumption | Cost if wrong |
|---|---|---|
| A-01 | Stack: Next.js, NestJS, PostgreSQL, worker queue, Entra ID (mocked), Docker Compose, TypeScript. **Pending IT/InfoSec approval.** | High if rejected |
| A-02 | Org hierarchy = seeded `org_units` reference file/table; names resolved case-insensitively, top-down, no fuzzy matching. | High |
| A-03 | Attendance grain = employee x period x leave type; `utilised_days` are days in the period; `entitlement_days` annual; `balance_days` at period end. | High |
| A-04 | Approval is per batch. Staff must be approved before Attendance/OT. A period is ready for calculation when all three are approved. | Med |
| A-05 | Duplicates flag every involved row (we cannot know which is right). | Low |
| A-06 | Staff snapshot is authoritative for org; org columns in OT differing from it raise a warning, nothing is rewritten. | Low |
| A-07 | Allowed values: status Active/Resigned/Terminated/Retired; type Permanent/Contract/Intern/Temporary; gender M/F; leave ANNUAL/SICK/UNPLANNED/LONG_LEAVE. | Low |
| A-08 | Cost is MVR, decimal with no thousand separators. | Low |
| A-09 | Division/Department Heads get aggregate data only. | Med |
| A-10 | Employee-level ER data: ER_RESTRICTED only; HR Analytics Admin excluded. ER aggregates need suppression rules (pending). | Med |
| A-11 | Working days per period is configuration supplied to the metric run (golden: 22). Public holidays not modelled. | Low |
| A-12 | Audit `reason` is free text (<=500 chars). UI must warn users not to enter personal data; structured audit fields are whitelisted. | Low |
| A-13 | Headcount includes Permanent + Contract; excludes Intern and Temporary. | Low |
| A-14 | Period cut-off = last calendar day of the period. | Med |
| A-15 | Phase 1 accepts UTF-8 CSV only (no .xlsx parsing). | Low |
| A-16 | Range thresholds (OT outlier 200 h; age 16-80; "impossible" = more than hours/days in the period) are PENDING HR SIGN-OFF placeholders. | Low |
| A-17 | Idempotency = same raw file + same mapping + same schema => same checksum, snapshot hash, issues and metric results (proved by test). | Low |
| A-18 | Unknown UID may be formally resolved (reason + approval reference, HR Analytics Admin, audited); all other blocking rules require fix and re-upload. | Med |
| A-19 | Sandbox has no network/Docker/PostgreSQL: TypeScript is executed with Node's built-in type stripping and node:test; **not type-checked with tsc**, and DB/API/UI layers are unexecuted. | n/a |
