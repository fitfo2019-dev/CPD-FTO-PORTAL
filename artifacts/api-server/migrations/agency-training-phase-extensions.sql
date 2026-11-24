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
COMMIT;

-- Grant the API runtime SELECT, INSERT and UPDATE(status, reviewed_at,
-- reviewed_by_user_id) on this table. Do not grant DELETE or TRUNCATE.
