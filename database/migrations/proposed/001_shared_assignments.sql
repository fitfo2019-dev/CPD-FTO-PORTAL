-- PROPOSED ONLY. Do not run against a department or production database.
-- The existing 001_field_training.sql is an obsolete schema and is not this
-- migration's prerequisite. A database owner must review/adapt this DDL,
-- establish approved runtime grants/RLS, and test it on a disposable database.
BEGIN;

CREATE TABLE identity_principals (
  id uuid PRIMARY KEY,
  issuer text NOT NULL,
  subject text NOT NULL,
  department_email text NOT NULL,
  department_email_verified_at timestamptz,
  mfa_verified_at timestamptz,
  active boolean NOT NULL DEFAULT false,
  provisioned_at timestamptz,
  provisioned_by uuid REFERENCES identity_principals(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issuer, subject),
  CHECK (department_email = lower(department_email)),
  CHECK (NOT active OR (provisioned_at IS NOT NULL AND provisioned_by IS NOT NULL))
);

CREATE TABLE app_role_grants (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES identity_principals(id),
  role text NOT NULL CHECK (role IN (
    'PO', 'FTO', 'FTO_COORDINATOR', 'FTO_SGT', 'FTO_COC',
    'POLICENET', 'POLICENET_ADMIN_SGT'
  )),
  granted_by uuid NOT NULL REFERENCES identity_principals(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES identity_principals(id),
  CHECK ((revoked_at IS NULL) = (revoked_by IS NULL))
);
CREATE UNIQUE INDEX app_role_grants_one_active_role
  ON app_role_grants(user_id, role) WHERE revoked_at IS NULL;

CREATE TABLE training_classes (
  id uuid PRIMARY KEY,
  class_name text NOT NULL,
  squad text NOT NULL,
  coordinator_id uuid NOT NULL REFERENCES identity_principals(id),
  active boolean NOT NULL DEFAULT true,
  roster_version integer NOT NULL DEFAULT 1 CHECK (roster_version > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE class_members (
  class_id uuid NOT NULL REFERENCES training_classes(id),
  po_id uuid NOT NULL REFERENCES identity_principals(id),
  active boolean NOT NULL DEFAULT true,
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES identity_principals(id),
  PRIMARY KEY (class_id, po_id),
  CHECK ((confirmed_at IS NULL) = (confirmed_by IS NULL))
);

CREATE TABLE class_assignment_authorizations (
  class_id uuid NOT NULL REFERENCES training_classes(id),
  user_id uuid NOT NULL REFERENCES identity_principals(id),
  role text NOT NULL CHECK (role IN ('FTO_SGT', 'FTO_COC')),
  may_assign_fto boolean NOT NULL DEFAULT false,
  granted_by uuid NOT NULL REFERENCES identity_principals(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (class_id, user_id, role),
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

CREATE TABLE fto_assignments (
  id uuid PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES training_classes(id),
  po_id uuid NOT NULL,
  fto_id uuid NOT NULL REFERENCES identity_principals(id),
  phase smallint NOT NULL CHECK (phase BETWEEN 1 AND 4),
  starts_on date NOT NULL,
  ends_on date,
  assigned_by uuid NOT NULL REFERENCES identity_principals(id),
  assignment_reason text NOT NULL CHECK (length(trim(assignment_reason)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  FOREIGN KEY (class_id, po_id) REFERENCES class_members(class_id, po_id),
  CHECK (ends_on IS NULL OR ends_on >= starts_on),
  CHECK (fto_id <> po_id)
);
CREATE UNIQUE INDEX fto_assignments_one_active_per_po_phase
  ON fto_assignments(class_id, po_id, phase) WHERE ends_on IS NULL;
CREATE INDEX fto_assignments_fto_active
  ON fto_assignments(fto_id, starts_on, ends_on);

CREATE FUNCTION protect_fto_assignment_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'FTO assignment history cannot be deleted'
      USING ERRCODE = '42501';
  END IF;
  IF OLD.ends_on IS NULL AND NEW.ends_on IS NOT NULL AND
     (to_jsonb(NEW) - ARRAY['ends_on','version']) IS NOT DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['ends_on','version']) THEN
    NEW.version := OLD.version + 1;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Only an active FTO assignment may be closed; create a new row for changes'
    USING ERRCODE = '42501';
END;
$$;
CREATE TRIGGER fto_assignment_history_guard
  BEFORE UPDATE OR DELETE ON fto_assignments
  FOR EACH ROW EXECUTE FUNCTION protect_fto_assignment_history();

CREATE TABLE assignment_operations (
  actor_id uuid NOT NULL REFERENCES identity_principals(id),
  operation_id uuid NOT NULL,
  request_sha256 text NOT NULL CHECK (request_sha256 ~ '^[a-f0-9]{64}$'),
  assignment_id uuid NOT NULL REFERENCES fto_assignments(id),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, operation_id)
);

CREATE TABLE assignment_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  operation_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES identity_principals(id),
  actor_role text NOT NULL CHECK (actor_role IN ('FTO_COORDINATOR', 'FTO_SGT', 'FTO_COC')),
  class_id uuid NOT NULL REFERENCES training_classes(id),
  po_id uuid NOT NULL REFERENCES identity_principals(id),
  phase smallint NOT NULL CHECK (phase BETWEEN 1 AND 4),
  prior_assignment_id uuid REFERENCES fto_assignments(id),
  prior_fto_id uuid REFERENCES identity_principals(id),
  new_assignment_id uuid NOT NULL REFERENCES fto_assignments(id),
  new_fto_id uuid NOT NULL REFERENCES identity_principals(id),
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_id, operation_id)
);

CREATE FUNCTION reject_assignment_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'assignment_audit_events is append-only'
    USING ERRCODE = '42501';
END;
$$;
CREATE TRIGGER assignment_audit_immutable
  BEFORE UPDATE OR DELETE ON assignment_audit_events
  FOR EACH ROW EXECUTE FUNCTION reject_assignment_audit_mutation();
CREATE TRIGGER assignment_audit_no_truncate
  BEFORE TRUNCATE ON assignment_audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION reject_assignment_audit_mutation();
REVOKE UPDATE, DELETE, TRUNCATE ON assignment_audit_events FROM PUBLIC;

COMMIT;
