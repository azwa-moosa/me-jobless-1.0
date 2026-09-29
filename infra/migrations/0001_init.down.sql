-- UNVERIFIED. Reversible only in DEV/UAT; never run against PROD (approved snapshots must not be dropped).
BEGIN;
DROP TABLE IF EXISTS audit_event, user_scope, metric_definition, fact_overtime, fact_attendance, employee_snapshot, upload_issue, upload_batch, org_unit, reporting_period CASCADE;
DROP FUNCTION IF EXISTS forbid_change(), protect_approved_batch();
COMMIT;
