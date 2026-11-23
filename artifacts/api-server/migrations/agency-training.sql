-- Agency DBA applies this to the AGENCY_DATABASE_URL database, never the
-- synthetic staging database. Provision assignments through a trusted agency
-- roster process, NOT through packet uploads or browser role selectors.
BEGIN;
CREATE SCHEMA IF NOT EXISTS agency_training;
CREATE TABLE agency_training.assignments (
  id uuid PRIMARY KEY,
  class_name text NOT NULL,
  phase integer NOT NULL CHECK (phase BETWEEN 1 AND 4),
  fto_id_hash char(64) NOT NULL,
  fto_badge_hash char(64) NOT NULL,
  fto_name text NOT NULL,
  po_id_hash char(64) NOT NULL,
  po_badge_hash char(64) NOT NULL,
  po_name text NOT NULL,
  coordinator_id_hash char(64),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE agency_training.packet_assignments (
  packet_id text PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES agency_training.assignments(id),
  record_date date NOT NULL,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE agency_training.packets (
  id text PRIMARY KEY REFERENCES agency_training.packet_assignments(packet_id),
  assignment_id uuid NOT NULL REFERENCES agency_training.assignments(id),
  record_date date NOT NULL,
  phase integer NOT NULL CHECK (phase BETWEEN 1 AND 4),
  operation_id uuid UNIQUE NOT NULL,
  content_hash char(64) NOT NULL,
  server_version integer NOT NULL DEFAULT 1 CHECK (server_version = 1),
  released_to_po boolean NOT NULL DEFAULT false,
  released_at timestamptz,
  released_by_hash char(64),
  withdrawn_at timestamptz,
  withdrawn_by_hash char(64),
  withdrawal_reason text,
  amendment_of text UNIQUE REFERENCES agency_training.packets(id),
  amendment_reason text,
  report jsonb NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT released_to_po OR (released_at IS NOT NULL AND released_by_hash IS NOT NULL AND withdrawn_at IS NULL)),
  CHECK ((amendment_of IS NULL AND amendment_reason IS NULL) OR
    (amendment_of IS NOT NULL AND amendment_reason IS NOT NULL AND amendment_of <> id AND length(trim(amendment_reason)) BETWEEN 1 AND 4000))
);
CREATE TABLE agency_training.packet_acknowledgments (
  packet_id text PRIMARY KEY REFERENCES agency_training.packets(id),
  acknowledged_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_hash char(64) NOT NULL,
  content_hash char(64) NOT NULL,
  comments text NOT NULL DEFAULT '' CHECK (length(comments) <= 4000)
);
CREATE TABLE agency_training.packet_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  request_id uuid NOT NULL,
  packet_id text,
  actor_hash char(64) NOT NULL,
  actor_role text NOT NULL,
  client_ip_hash char(64) NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('READ','COMMIT','RELEASE','WITHDRAW','ACKNOWLEDGE')),
  operation_id uuid UNIQUE,
  request_hash char(64),
  content_hash char(64),
  record_count integer NOT NULL CHECK (record_count BETWEEN 0 AND 100)
);
CREATE INDEX ON agency_training.assignments(fto_id_hash, fto_badge_hash) WHERE active;
CREATE INDEX ON agency_training.assignments(po_id_hash, po_badge_hash) WHERE active;
CREATE INDEX ON agency_training.assignments(coordinator_id_hash) WHERE active;
CREATE INDEX ON agency_training.packet_assignments(assignment_id, record_date) WHERE active;
COMMIT;
-- Use a separate non-owner runtime DB role. Grant schema USAGE, assignment
-- SELECT on assignments; packet_assignments and packets SELECT/INSERT;
-- packet_acknowledgments SELECT/INSERT; packet_events SELECT/INSERT and sequence USAGE.
-- Grant UPDATE ONLY on packets(released_to_po, released_at, released_by_hash,
-- withdrawn_at, withdrawn_by_hash, withdrawal_reason).
-- Never grant table-wide UPDATE, DELETE, TRUNCATE or ownership.
-- Backups, retention, encryption at rest and immutable SIEM retention are
-- agency infrastructure responsibilities, not guarantees of this SQL file.
