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
  report jsonb NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE agency_training.packet_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  request_id uuid NOT NULL,
  packet_id text,
  actor_hash char(64) NOT NULL,
  actor_role text NOT NULL,
  client_ip_hash char(64) NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('READ','COMMIT')),
  record_count integer NOT NULL CHECK (record_count BETWEEN 0 AND 100)
);
CREATE INDEX ON agency_training.assignments(fto_id_hash, fto_badge_hash) WHERE active;
CREATE INDEX ON agency_training.assignments(po_id_hash, po_badge_hash) WHERE active;
CREATE INDEX ON agency_training.assignments(coordinator_id_hash) WHERE active;
CREATE INDEX ON agency_training.packet_assignments(assignment_id, record_date) WHERE active;
COMMIT;
-- Use a separate non-owner runtime DB role. Grant schema USAGE, assignment
-- SELECT on assignments; packet_assignments and packets SELECT/INSERT;
-- packet_events INSERT and sequence USAGE.
-- Never grant runtime UPDATE/DELETE/TRUNCATE or ownership on these tables.
-- Backups, retention, encryption at rest and immutable SIEM retention are
-- agency infrastructure responsibilities, not guarantees of this SQL file.
