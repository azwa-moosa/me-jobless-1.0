-- UNVERIFIED: written for PostgreSQL 15+, NOT executed in the authoring sandbox (no Postgres available).
-- Phase 1 schema. Sensitive employee columns exist only in employee_snapshot; audit/issue tables hold no names/DOB.
BEGIN;

CREATE TABLE reporting_period (
  id            text PRIMARY KEY,                    -- e.g. P-2026-09
  period        char(7) NOT NULL UNIQUE CHECK (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  cutoff        date NOT NULL,
  status        text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','UPLOADING','VALIDATION_REQUIRED','READY_FOR_CALCULATION','HR_REVIEW','READY_TO_PUBLISH','PUBLISHED','SUPERSEDED')),
  created_by    text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE org_unit (                              -- effective-dated hierarchy
  row_id         bigserial PRIMARY KEY,
  unit_id        text NOT NULL,
  level          text NOT NULL CHECK (level IN ('BANK','DIVISION','DEPARTMENT','UNIT')),
  name           text NOT NULL,
  parent_id      text,
  effective_from date NOT NULL,
  effective_to   date,
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE (unit_id, effective_from)
);
CREATE INDEX org_unit_parent_idx ON org_unit (parent_id);

CREATE TABLE upload_batch (
  id            text PRIMARY KEY,
  period_id     text NOT NULL REFERENCES reporting_period(id),
  dataset       text NOT NULL CHECK (dataset IN ('staff','attendance','overtime')),
  version       int  NOT NULL,
  status        text NOT NULL CHECK (status IN ('VALIDATED','APPROVED','REJECTED','SUPERSEDED')),
  filename      text,
  checksum      char(64) NOT NULL,                   -- SHA-256 of raw file
  snapshot_hash char(64) NOT NULL,
  schema_version text NOT NULL,
  row_count     int NOT NULL,
  uploaded_by   text NOT NULL,
  approved_by   text,
  approved_at   timestamptz,
  raw_object_key text,                               -- encrypted blob storage key; raw files are never overwritten
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, dataset, version)
);

CREATE TABLE upload_issue (
  id           text PRIMARY KEY,
  batch_id     text NOT NULL REFERENCES upload_batch(id),
  row_no       int,
  field        text,
  code         text NOT NULL,
  severity     text NOT NULL CHECK (severity IN ('BLOCKING','WARNING')),
  message      text NOT NULL,
  value        text,                                 -- never populated for sensitive fields (name, DOB)
  resolution_kind text CHECK (resolution_kind IN ('ACKNOWLEDGED','FORMALLY_RESOLVED')),
  resolution_reason text,
  resolution_reference text,
  resolved_by  text,
  resolved_at  timestamptz,
  CHECK ((resolution_kind IS NULL) = (resolved_by IS NULL))
);
CREATE INDEX upload_issue_batch_idx ON upload_issue (batch_id);

CREATE TABLE employee_snapshot (
  batch_id     text NOT NULL REFERENCES upload_batch(id),
  uid          text NOT NULL,
  full_name    text,                                 -- sensitive
  dob          date,                                 -- sensitive
  gender       char(1),
  employment_status text NOT NULL,
  employment_type   text NOT NULL,
  join_date    date NOT NULL,
  separation_date date,
  grade text, role text, manager_uid text, location text,
  division_id text, department_id text, unit_id text,
  org_path     text[] NOT NULL DEFAULT '{}',         -- ancestor ids, used by row-level security
  PRIMARY KEY (batch_id, uid)
);

CREATE TABLE fact_attendance (
  batch_id text NOT NULL REFERENCES upload_batch(id),
  period char(7) NOT NULL, uid text NOT NULL, leave_type text NOT NULL,
  entitlement_days numeric(7,2), utilised_days numeric(7,2) NOT NULL CHECK (utilised_days >= 0), balance_days numeric(7,2),
  org_path text[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (batch_id, period, uid, leave_type)
);
CREATE TABLE fact_overtime (
  batch_id text NOT NULL REFERENCES upload_batch(id),
  period char(7) NOT NULL, uid text NOT NULL,
  ot_hours numeric(8,2) NOT NULL CHECK (ot_hours >= 0), ot_cost numeric(14,2) NOT NULL CHECK (ot_cost >= 0),
  org_path text[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (batch_id, period, uid)
);

CREATE TABLE metric_definition (
  id text NOT NULL, version text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','PENDING_HR_SIGN_OFF','APPROVED')),
  definition jsonb NOT NULL, effective_from date NOT NULL,
  approved_by text, approved_at timestamptz,
  PRIMARY KEY (id, version)
);

CREATE TABLE user_scope (
  user_id text NOT NULL, role text NOT NULL,
  org_unit_id text NOT NULL, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, org_unit_id)
);

CREATE TABLE audit_event (
  seq bigint PRIMARY KEY, at timestamptz NOT NULL, action text NOT NULL,
  actor_id text NOT NULL, actor_role text NOT NULL, period_id text, batch_id text,
  details jsonb NOT NULL DEFAULT '{}', prev_hash char(64) NOT NULL, hash char(64) NOT NULL
);

-- ---- Immutability ----
CREATE FUNCTION forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'append-only table: % not allowed', TG_OP; END $$;
CREATE TRIGGER audit_event_immutable BEFORE UPDATE OR DELETE ON audit_event FOR EACH ROW EXECUTE FUNCTION forbid_change();

CREATE FUNCTION protect_approved_batch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.status IN ('APPROVED','SUPERSEDED') THEN RAISE EXCEPTION 'approved snapshots cannot be deleted'; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'APPROVED' AND NEW.status <> 'SUPERSEDED' THEN RAISE EXCEPTION 'approved snapshot is immutable; create a new version'; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'SUPERSEDED' THEN RAISE EXCEPTION 'superseded snapshot is immutable'; END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER upload_batch_protect BEFORE UPDATE OR DELETE ON upload_batch FOR EACH ROW EXECUTE FUNCTION protect_approved_batch();

-- ---- Defence in depth: row-level security by org scope (primary enforcement is in the API) ----
-- The API sets: SET LOCAL app.scope_org_ids = 'DIV-CR,...' per request from the authorised user scope. Empty => no rows.
ALTER TABLE employee_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_attendance   ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_overtime     ENABLE ROW LEVEL SECURITY;
CREATE POLICY scope_employee_snapshot ON employee_snapshot USING (org_path && string_to_array(coalesce(current_setting('app.scope_org_ids', true), ''), ','));
CREATE POLICY scope_fact_attendance   ON fact_attendance   USING (org_path && string_to_array(coalesce(current_setting('app.scope_org_ids', true), ''), ','));
CREATE POLICY scope_fact_overtime     ON fact_overtime     USING (org_path && string_to_array(coalesce(current_setting('app.scope_org_ids', true), ''), ','));

COMMIT;
