-- Apply after agency-training-phase-extensions.sql to the agency database.
-- This is an owner-operated reconciliation path, not an API/runtime write.
-- Review the candidate view first and reconcile only against verified roster
-- records. The function refuses ambiguous or incomplete active assignments.
BEGIN;

CREATE VIEW agency_training.legacy_coordinator_reconciliation_candidates AS
WITH legacy AS (
  SELECT
    a.po_id,
    min(a.po_id_hash)::text AS po_id_hash,
    min(a.po_badge) AS po_badge,
    min(a.coordinator_id) AS proposed_coordinator_id,
    count(*)::integer AS active_assignment_count,
    count(DISTINCT a.po_id_hash)::integer AS po_id_hash_count,
    count(DISTINCT a.po_badge)::integer AS po_badge_count,
    count(DISTINCT a.coordinator_id)::integer AS coordinator_id_count,
    count(DISTINCT a.coordinator_id_hash)::integer AS coordinator_hash_count,
    count(*) FILTER (
      WHERE a.po_id_hash IS NULL
        OR a.po_badge IS NULL
        OR a.coordinator_id IS NULL
        OR a.coordinator_id_hash IS NULL
    )::integer AS incomplete_assignment_count
  FROM agency_training.assignments a
  WHERE a.active AND a.po_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM agency_training.po_coordinators pc WHERE pc.po_id = a.po_id
    )
  GROUP BY a.po_id
)
SELECT
  legacy.po_id,
  legacy.po_id_hash,
  legacy.po_badge,
  legacy.proposed_coordinator_id,
  legacy.active_assignment_count,
  legacy.po_id_hash_count,
  legacy.po_badge_count,
  legacy.coordinator_id_count,
  legacy.coordinator_hash_count,
  legacy.incomplete_assignment_count,
  (d.id IS NOT NULL AND d.active) AS coordinator_is_active,
  (
    legacy.po_id_hash_count = 1
    AND legacy.po_badge_count = 1
    AND legacy.coordinator_id_count = 1
    AND legacy.coordinator_hash_count = 1
    AND legacy.incomplete_assignment_count = 0
    AND d.id IS NOT NULL
    AND d.active
  ) AS eligible_for_reconciliation,
  (
    SELECT count(*)::integer
    FROM agency_training.phase_extension_requests r
    JOIN agency_training.assignments a ON a.id = r.assignment_id
    WHERE a.po_id = legacy.po_id AND r.status = 'pending'
  ) AS pending_phase_extension_request_count
FROM legacy
LEFT JOIN agency_training.coordinator_directory d
  ON d.id = legacy.proposed_coordinator_id;

COMMENT ON VIEW agency_training.legacy_coordinator_reconciliation_candidates IS
  'Owner-only report of active PO assignments without canonical mappings; eligibility requires unanimous, complete trusted roster data.';

CREATE TABLE agency_training.po_coordinator_reconciliation_audit (
  po_id text PRIMARY KEY,
  po_id_hash char(64) NOT NULL,
  po_badge text NOT NULL,
  coordinator_id text NOT NULL
    REFERENCES agency_training.coordinator_directory(id),
  active_assignment_count integer NOT NULL CHECK (active_assignment_count > 0),
  pending_phase_extension_request_count integer NOT NULL
    CHECK (pending_phase_extension_request_count >= 0),
  reconciled_by text NOT NULL CHECK (length(trim(reconciled_by)) BETWEEN 1 AND 200),
  database_role text NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 4000),
  reconciled_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE FUNCTION agency_training.prevent_po_coordinator_reconciliation_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'Coordinator reconciliation audit records are immutable'
    USING ERRCODE = 'check_violation';
END;
$$;
REVOKE ALL ON FUNCTION agency_training.prevent_po_coordinator_reconciliation_audit_mutation()
  FROM PUBLIC;
CREATE TRIGGER po_coordinator_reconciliation_audit_immutable
  BEFORE UPDATE OR DELETE ON agency_training.po_coordinator_reconciliation_audit
  FOR EACH ROW
  EXECUTE FUNCTION agency_training.prevent_po_coordinator_reconciliation_audit_mutation();

CREATE FUNCTION agency_training.reconcile_legacy_po_coordinator(
  p_po_id text,
  p_coordinator_id text,
  p_reconciled_by text,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, agency_training
AS $$
DECLARE
  candidate agency_training.legacy_coordinator_reconciliation_candidates%ROWTYPE;
BEGIN
  IF p_po_id IS NULL OR length(trim(p_po_id)) = 0
      OR p_coordinator_id IS NULL OR length(trim(p_coordinator_id)) = 0
      OR p_reconciled_by IS NULL OR length(trim(p_reconciled_by)) = 0
      OR p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'PO, Coordinator, operator, and reason are required'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Match the advisory lock used by trusted Coordinator handoffs. Keep the
  -- lock as a separate statement so following reads see committed handoffs.
  PERFORM pg_advisory_xact_lock(hashtextextended('po:' || p_po_id, 0));

  SELECT * INTO candidate
  FROM agency_training.legacy_coordinator_reconciliation_candidates c
  WHERE c.po_id = p_po_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No unmapped active assignments found for PO'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOT candidate.eligible_for_reconciliation THEN
    RAISE EXCEPTION 'Active assignments are incomplete, inconsistent, or have no active Coordinator'
      USING ERRCODE = 'check_violation';
  END IF;
  IF candidate.proposed_coordinator_id <> p_coordinator_id THEN
    RAISE EXCEPTION 'Selected Coordinator does not match the unanimous trusted roster'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO agency_training.po_coordinators
    (po_id, po_id_hash, po_badge, coordinator_id)
  VALUES
    (candidate.po_id, candidate.po_id_hash, candidate.po_badge, p_coordinator_id);

  INSERT INTO agency_training.po_coordinator_reconciliation_audit
    (po_id, po_id_hash, po_badge, coordinator_id, active_assignment_count,
     pending_phase_extension_request_count, reconciled_by, database_role, reason)
  VALUES
    (candidate.po_id, candidate.po_id_hash, candidate.po_badge, p_coordinator_id,
     candidate.active_assignment_count, candidate.pending_phase_extension_request_count,
     trim(p_reconciled_by), session_user, trim(p_reason));
END;
$$;
REVOKE ALL ON FUNCTION agency_training.reconcile_legacy_po_coordinator(text,text,text,text)
  FROM PUBLIC;

COMMIT;

-- Do not grant the API runtime access to the view, audit table, or reconciliation
-- function. The agency DBA should inspect eligible_for_reconciliation and
-- pending_phase_extension_request_count, verify the proposed Coordinator
-- against the official roster, then execute the function with an operator ID
-- and a concise reason. Example (replace every value with verified data):
-- SELECT agency_training.reconcile_legacy_po_coordinator(
--   '<po_id>', '<verified_coordinator_account_id>',
--   '<operator_identity>', '<reconciliation basis>');
-- The mapping insert and immutable audit record commit or roll back together.
