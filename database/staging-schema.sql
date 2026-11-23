-- SYNTHETIC DEVELOPMENT ONLY. Review/apply explicitly; never execute at API startup.
-- Deliberately separate from obsolete migrations/001_field_training.sql.
CREATE SCHEMA IF NOT EXISTS synthetic_training;
CREATE TABLE IF NOT EXISTS synthetic_training.members (
  id uuid PRIMARY KEY,
  subject_hash text NOT NULL UNIQUE CHECK (subject_hash ~ '^[a-f0-9]{64}$'),
  role text NOT NULL CHECK (role IN ('PO','FTO','FTO_COORDINATOR')),
  active boolean NOT NULL DEFAULT false,
  agency_verified boolean NOT NULL DEFAULT false,
  terms_accepted boolean NOT NULL DEFAULT false
);
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
CREATE TABLE IF NOT EXISTS synthetic_training.receipts (
  actor_hash text NOT NULL,
  operation_id uuid NOT NULL,
  digest text NOT NULL,
  response jsonb NOT NULL,
  UNIQUE (actor_hash, operation_id)
);
