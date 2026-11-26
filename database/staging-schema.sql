-- SYNTHETIC DEVELOPMENT ONLY. Review/apply explicitly; never execute at API startup.
-- Deliberately separate from obsolete migrations/001_field_training.sql.
CREATE SCHEMA IF NOT EXISTS synthetic_training;
CREATE TABLE IF NOT EXISTS synthetic_training.members (
  id uuid PRIMARY KEY,
  subject_hash text NOT NULL UNIQUE CHECK (subject_hash ~ '^[a-f0-9]{64}$'),
  role text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  agency_verified boolean NOT NULL DEFAULT false,
  terms_accepted boolean NOT NULL DEFAULT false
);
-- Idempotent for existing installs. TEST_ADMIN is a synthetic-only test role:
-- it can never be agency-verified and never appears in agency identity claims.
ALTER TABLE synthetic_training.members DROP CONSTRAINT IF EXISTS members_role_check;
ALTER TABLE synthetic_training.members ADD CONSTRAINT members_role_check
  CHECK (role IN ('PO','FTO','FTO_COORDINATOR','TEST_ADMIN'));
ALTER TABLE synthetic_training.members DROP CONSTRAINT IF EXISTS members_test_admin_not_agency;
ALTER TABLE synthetic_training.members ADD CONSTRAINT members_test_admin_not_agency
  CHECK (role <> 'TEST_ADMIN' OR NOT agency_verified);
CREATE TABLE IF NOT EXISTS synthetic_training.classes (
  id uuid PRIMARY KEY,
  coordinator_id uuid NOT NULL REFERENCES synthetic_training.members(id),
  active boolean NOT NULL DEFAULT false,
  phase_active boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS synthetic_training.assignments (
  id uuid PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES synthetic_training.classes(id),
  po_id uuid NOT NULL REFERENCES synthetic_training.members(id),
  fto_id uuid NOT NULL REFERENCES synthetic_training.members(id),
  phase integer NOT NULL CHECK (phase BETWEEN 1 AND 4),
  starts_on date NOT NULL,
  ends_on date NOT NULL CHECK (ends_on >= starts_on),
  active boolean NOT NULL DEFAULT false,
  CHECK (po_id <> fto_id)
);
CREATE TABLE IF NOT EXISTS synthetic_training.records (
  id uuid PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES synthetic_training.assignments(id),
  record_date date NOT NULL,
  narrative text NOT NULL CHECK (length(narrative) <= 4000),
  status text NOT NULL CHECK (status IN ('draft','submitted')),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  acknowledged_version integer CHECK (acknowledged_version > 0 AND acknowledged_version <= version),
  UNIQUE (assignment_id, record_date)
);
CREATE TABLE IF NOT EXISTS synthetic_training.audit_events (
  id uuid PRIMARY KEY,
  timestamp timestamptz NOT NULL DEFAULT now(),
  actor_hash text NOT NULL CHECK (actor_hash ~ '^[a-f0-9]{64}$'),
  role text NOT NULL,
  client_ip_hash text NOT NULL CHECK (client_ip_hash ~ '^[a-f0-9]{64}$'),
  request_id text NOT NULL,
  action text NOT NULL,
  record_id uuid,
  version integer
);
CREATE TABLE IF NOT EXISTS synthetic_training.record_versions (
  record_id uuid NOT NULL REFERENCES synthetic_training.records(id),
  version integer NOT NULL CHECK (version >= 1),
  narrative text NOT NULL CHECK (length(narrative) <= 4000),
  status text NOT NULL CHECK (status IN ('draft','submitted')),
  PRIMARY KEY (record_id, version)
);
CREATE TABLE IF NOT EXISTS synthetic_training.receipts (
  actor_hash text NOT NULL,
  operation_id uuid NOT NULL,
  digest text NOT NULL,
  response jsonb NOT NULL,
  UNIQUE (actor_hash, operation_id)
);
-- Test Admin scenario setup (idempotent). Fictional participants have a random
-- subject hash, can never sign in, can never be TEST_ADMIN, and are never
-- agency-verified. Only fictional rows are managed by the Test Admin API.
ALTER TABLE synthetic_training.members ADD COLUMN IF NOT EXISTS fictional boolean NOT NULL DEFAULT false;
ALTER TABLE synthetic_training.members ADD COLUMN IF NOT EXISTS display_label text;
ALTER TABLE synthetic_training.members ADD COLUMN IF NOT EXISTS badge_label text;
ALTER TABLE synthetic_training.members DROP CONSTRAINT IF EXISTS members_fictional_check;
ALTER TABLE synthetic_training.members ADD CONSTRAINT members_fictional_check
  CHECK (NOT fictional OR (role <> 'TEST_ADMIN' AND NOT agency_verified
    AND display_label IS NOT NULL AND length(display_label) BETWEEN 1 AND 80
    AND badge_label IS NOT NULL AND length(badge_label) BETWEEN 1 AND 20));
ALTER TABLE synthetic_training.classes ADD COLUMN IF NOT EXISTS fictional boolean NOT NULL DEFAULT false;
ALTER TABLE synthetic_training.classes ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE synthetic_training.classes DROP CONSTRAINT IF EXISTS classes_fictional_check;
ALTER TABLE synthetic_training.classes ADD CONSTRAINT classes_fictional_check
  CHECK (NOT fictional OR (label IS NOT NULL AND length(label) BETWEEN 1 AND 80));
ALTER TABLE synthetic_training.assignments ADD COLUMN IF NOT EXISTS fictional boolean NOT NULL DEFAULT false;
ALTER TABLE synthetic_training.audit_events ADD COLUMN IF NOT EXISTS target_type text
  CHECK (target_type IS NULL OR target_type IN ('PARTICIPANT','CLASS','ASSIGNMENT'));
ALTER TABLE synthetic_training.audit_events ADD COLUMN IF NOT EXISTS target_id uuid;
