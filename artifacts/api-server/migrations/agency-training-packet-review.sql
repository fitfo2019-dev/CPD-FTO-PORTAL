-- Apply after agency-training.sql (new installation), or after the draft
-- finalization upgrade (existing installation). No records are seeded here.
BEGIN;
-- Keep the canonical hashed assignment authority and per-packet mapping.
-- Agency provisioning supplies verified account metadata; do not infer it
-- from client reports or try to reverse existing identity hashes.
ALTER TABLE agency_training.assignments
  ADD COLUMN IF NOT EXISTS po_id text,
  ADD COLUMN IF NOT EXISTS po_badge text,
  ADD COLUMN IF NOT EXISTS fto_id text,
  ADD COLUMN IF NOT EXISTS fto_badge text,
  ADD COLUMN IF NOT EXISTS coordinator_id text;
CREATE TABLE agency_training.coordinator_directory (
  id text PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE agency_training.po_coordinators (
  po_id text PRIMARY KEY,
  po_id_hash char(64) NOT NULL UNIQUE,
  po_badge text NOT NULL,
  coordinator_id text NOT NULL REFERENCES agency_training.coordinator_directory(id),
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE agency_training.packet_submissions (
  id uuid PRIMARY KEY,
  packet_id text NOT NULL REFERENCES agency_training.packets(id),
  packet_version integer NOT NULL CHECK (packet_version >= 1),
  po_id text NOT NULL,
  fto_id text NOT NULL,
  coordinator_id text NOT NULL REFERENCES agency_training.coordinator_directory(id),
  state text NOT NULL DEFAULT 'submitted'
    CHECK (state IN ('submitted','acknowledged','approved','correction_requested','withdrawn')),
  report jsonb NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  reviewed_at timestamptz,
  review_note text NOT NULL DEFAULT '',
  UNIQUE (packet_id,packet_version)
);
CREATE TABLE agency_training.packet_review_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission_id uuid REFERENCES agency_training.packet_submissions(id),
  actor_hash char(64) NOT NULL,
  action text NOT NULL,
  note text NOT NULL DEFAULT '',
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE agency_training.packet_review_operations (
  operation_id uuid PRIMARY KEY,
  actor_hash char(64) NOT NULL,
  submission_id uuid NOT NULL,
  action text NOT NULL,
  note text NOT NULL,
  receipt jsonb NOT NULL
);
CREATE INDEX ON agency_training.packet_submissions(coordinator_id,submitted_at) WHERE state='submitted';
CREATE INDEX ON agency_training.packet_submissions(fto_id,submitted_at);
CREATE INDEX ON agency_training.packet_submissions(po_id,submitted_at);
CREATE INDEX ON agency_training.packet_review_events(submission_id,id);
-- Row-locking SELECT requires UPDATE privilege in PostgreSQL. These narrow
-- owner-held functions lock trusted roster/directory rows without granting the
-- runtime the ability to modify either authority table. No dynamic SQL.
CREATE FUNCTION agency_training.lock_packet_assignment(text,text,text)
RETURNS SETOF agency_training.assignments
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,agency_training AS $$
  SELECT a.* FROM agency_training.assignments a
  JOIN agency_training.packet_assignments pa ON pa.assignment_id=a.id
  WHERE pa.packet_id=$1 AND pa.active AND a.fto_id=$2 AND a.fto_badge=$3 AND a.active
  FOR SHARE OF a,pa
$$;
CREATE FUNCTION agency_training.lock_active_packet_coordinator(text)
RETURNS TABLE(id text,name text)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,agency_training AS $$
  SELECT d.id,d.name FROM agency_training.coordinator_directory d
  WHERE d.id=$1 AND d.active FOR SHARE
$$;
REVOKE ALL ON FUNCTION agency_training.lock_packet_assignment(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION agency_training.lock_active_packet_coordinator(text) FROM PUBLIC;
COMMIT;
-- Trusted agency provisioning must populate coordinator_directory with actual
-- verified Coordinator account IDs and display names. Never use browser roles
-- or sample accounts. The runtime needs directory SELECT, po_coordinators
-- SELECT/INSERT plus UPDATE(coordinator_id,revision,updated_at), submissions
-- SELECT/INSERT plus UPDATE(coordinator_id,state,acknowledged_at,reviewed_at,
-- review_note), review events SELECT/INSERT, operations SELECT/INSERT and
-- sequence USAGE. Do not grant updates to snapshot/identity/version columns,
-- or any event/operation UPDATE or DELETE privileges.
-- Grant the runtime EXECUTE only on the two lock_* functions above. Keep their
-- owner separate from the runtime. Do not grant runtime CREATE on this schema.
