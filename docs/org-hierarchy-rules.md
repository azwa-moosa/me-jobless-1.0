# Organisation Hierarchy Rules

Status: DRAFT. Source of truth for the hierarchy is undecided (Appendix B #3); Phase 1 uses a seeded `org_units` reference (assumption A-02).

## Structure
Bank (exactly one root) > Division > Department > Unit. Unit is optional per employee; Division and Department are required for Staff.

## Rules
1. Every unit has a stable `unit_id`, a `level`, a `name`, a `parent_id` exactly one level above, and `effective_from` / optional `effective_to` (inclusive; blank = open).
2. The hierarchy is effective-dated: a unit is valid at date D if `effective_from <= D` and (`effective_to` is blank or `D <= effective_to`). Restructures end old units and add new ones; history is never overwritten.
3. **Reference date for a period is its cut-off = last calendar day of the period** (A-14). Staff placement is resolved as at the cut-off.
4. Names in uploaded files are resolved top-down (Division under Bank, Department under that Division, Unit under that Department), case-insensitive, whitespace-trimmed. Resolution never guesses or fuzzy-matches.
5. Outcomes: name not found under the expected parent => `UNKNOWN_ORG` (blocking). Found but not effective at cut-off => `ORG_NOT_EFFECTIVE` (blocking). Nothing is corrected silently.
6. The **Staff snapshot is authoritative** for org placement in Attendance/Overtime. Org columns in those files are informational; a difference raises the warning `ORG_MISMATCH_SNAPSHOT` (A-06).
7. Scope: a user scope is an org unit; it covers that unit and all descendants (`ancestorsOf` in `packages/schemas/src/org.ts`). Unknown org units are denied (fail-closed).
8. Structural checks on load (`validateHierarchy`): unique ids, valid levels and dates, `effective_to >= effective_from`, parent exists and is exactly one level above, Bank has no parent.
9. Published/approved snapshots keep the org placement they were approved with; later hierarchy changes never restate them (corrections create a new version).

## Worked example (golden dataset)
`Legacy Credit` (DEP-CR-OLD) ended 2026-06-30. A September 2026 Staff row placing someone there fails with `ORG_NOT_EFFECTIVE`.

## Open items
Manual vs HRIS-fed hierarchy; treatment of mid-month restructures (e.g. Islamic restructuring cited in the Blueprint) - see open-questions.md Q3.
