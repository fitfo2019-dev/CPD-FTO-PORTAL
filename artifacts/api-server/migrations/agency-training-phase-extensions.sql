-- Apply after agency-training-packet-review.sql to the agency database.
-- Phase-extension decisions use the same trusted assignments and PO/Coordinator
-- routing as packet review; no browser-supplied roster data is authoritative.
BEGIN;
CREATE TABLE agency_training.phase_extension_requests (
  id text PRIMARY KEY,
  assignment_id uuid NOT NULL
    REFERENCES agency_training.assignments(id) ON DELETE RESTRICT,
  requester_user_id text NOT NULL,
  class_name text NOT NULL,
  recruit_name text NOT NULL,
  recruit_badge text NOT NULL,
  phase integer NOT NULL CHECK (phase BETWEEN 1 AND 4),
  phase_start_date date NOT NULL,
  requesting_fto_name text NOT NULL,
  requesting_fto_badge text NOT NULL,
  extension_type text NOT NULL
    CHECK (extension_type IN ('training_weeks','limbo_period')),
  requested_weeks integer NOT NULL CHECK (requested_weeks BETWEEN 1 AND 52),
  justification text NOT NULL CHECK (length(trim(justification)) BETWEEN 1 AND 4000),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','denied')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reviewed_at timestamptz,
  reviewed_by_user_id text,
  CHECK (
    (status = 'pending' AND reviewed_at IS NULL AND reviewed_by_user_id IS NULL)
    OR
    (status IN ('approved','denied') AND reviewed_at IS NOT NULL
      AND reviewed_by_user_id IS NOT NULL)
  )
);

CREATE INDEX phase_extension_requests_requester_created_idx
  ON agency_training.phase_extension_requests(requester_user_id, created_at DESC);
CREATE INDEX phase_extension_requests_assignment_status_created_idx
  ON agency_training.phase_extension_requests(assignment_id, status, created_at);

COMMENT ON TABLE agency_training.phase_extension_requests IS
  'Phase extension requests bound to a trusted agency roster assignment. The single decision is recorded with reviewer and time.';
COMMENT ON COLUMN agency_training.phase_extension_requests.reviewed_by_user_id IS
  'Verified Coordinator account that made the terminal approved or denied decision.';

-- A request may be decided once. The runtime role can update only the three
-- review columns, but this guard also prevents a later decision from replacing
-- the original outcome through direct SQL.
CREATE FUNCTION agency_training.guard_phase_extension_decision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=pg_catalog
AS $$
BEGIN
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'phase extension requests can only be decided once'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status NOT IN ('approved', 'denied')
      OR NEW.reviewed_at IS NULL
      OR NEW.reviewed_by_user_id IS NULL THEN
    RAISE EXCEPTION 'phase extension requests must transition from pending to a reviewed decision'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION agency_training.guard_phase_extension_decision() FROM PUBLIC;
CREATE TRIGGER phase_extension_decision_once
  BEFORE UPDATE ON agency_training.phase_extension_requests
  FOR EACH ROW EXECUTE FUNCTION agency_training.guard_phase_extension_decision();
COMMIT;

-- Provision a separate non-owner API runtime role with:
--   GRANT USAGE ON SCHEMA agency_training TO <runtime>;
--   GRANT SELECT (id,class_name,phase,fto_id_hash,fto_name,po_id_hash,
--     po_badge_hash,po_name,coordinator_id_hash,starts_on,active,po_id,
--     po_badge,fto_id,fto_badge) ON agency_training.assignments TO <runtime>;
--   GRANT SELECT (id,active) ON agency_training.coordinator_directory TO <runtime>;
--   GRANT SELECT (po_id,po_id_hash,coordinator_id)
--     ON agency_training.po_coordinators TO <runtime>;
--   GRANT SELECT ON agency_training.phase_extension_requests TO <runtime>;
--   GRANT INSERT (id,assignment_id,requester_user_id,class_name,recruit_name,
--     recruit_badge,phase,phase_start_date,requesting_fto_name,
--     requesting_fto_badge,extension_type,requested_weeks,justification,
--     status,created_at) ON agency_training.phase_extension_requests TO <runtime>;
--   GRANT UPDATE (status,reviewed_at,reviewed_by_user_id)
--     ON agency_training.phase_extension_requests TO <runtime>;
-- The request trigger permits only one pending-to-decided transition. Do not
-- grant assignment or directory writes, request DELETE/TRUNCATE, ownership,
-- or CREATE on this schema.
-- Keep roster reads column-scoped: the request service does not need
-- assignments.fto_badge_hash or assignments.coordinator_id,
-- coordinator_directory.name, or po_coordinators.po_badge.
