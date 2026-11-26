-- Apply after agency-training-packet-review.sql. Assignment changes are
-- authorized from the signed-in Coordinator and canonical server roster only.
BEGIN;

CREATE TABLE agency_training.assignment_transitions (
  operation_id uuid PRIMARY KEY,
  actor_hash char(64) NOT NULL,
  request_hash char(64) NOT NULL,
  po_id text NOT NULL,
  po_name text NOT NULL,
  po_badge text NOT NULL,
  class_name text NOT NULL,
  previous_assignment_id uuid NOT NULL
    REFERENCES agency_training.assignments(id) ON DELETE RESTRICT,
  successor_assignment_id uuid NOT NULL UNIQUE
    REFERENCES agency_training.assignments(id) ON DELETE RESTRICT,
  previous_phase integer NOT NULL CHECK (previous_phase BETWEEN 1 AND 4),
  successor_phase integer NOT NULL CHECK (successor_phase BETWEEN 1 AND 4),
  previous_ends_on date NOT NULL,
  successor_starts_on date NOT NULL,
  successor_ends_on date NOT NULL,
  previous_snapshot jsonb NOT NULL,
  successor_snapshot jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (successor_starts_on <= successor_ends_on),
  CHECK (previous_assignment_id <> successor_assignment_id),
  UNIQUE (previous_assignment_id)
);

CREATE INDEX assignment_transitions_po_occurred_idx
  ON agency_training.assignment_transitions(po_id, occurred_at DESC);

CREATE FUNCTION agency_training.prevent_assignment_transition_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'assignment transition audit records are immutable'
    USING ERRCODE = 'check_violation';
END;
$$;
REVOKE ALL ON FUNCTION agency_training.prevent_assignment_transition_mutation() FROM PUBLIC;
CREATE TRIGGER assignment_transition_audit_immutable
  BEFORE UPDATE OR DELETE ON agency_training.assignment_transitions
  FOR EACH ROW EXECUTE FUNCTION agency_training.prevent_assignment_transition_mutation();
CREATE TRIGGER assignment_transition_audit_no_truncate
  BEFORE TRUNCATE ON agency_training.assignment_transitions
  FOR EACH STATEMENT EXECUTE FUNCTION agency_training.prevent_assignment_transition_mutation();

-- This function is the only runtime write path for official assignments.
-- It keeps the predecessor active for historical packet eligibility, shortens
-- only its end date when needed, and appends the successor and immutable audit
-- snapshots atomically. It never reads or writes packet tables.
CREATE FUNCTION agency_training.create_successor_assignment(
  p_actor_id text,
  p_actor_hash char(64),
  p_previous_assignment_id uuid,
  p_successor_assignment_id uuid,
  p_operation_id uuid,
  p_request_hash char(64),
  p_fto_id text,
  p_phase integer,
  p_starts_on date,
  p_ends_on date
)
RETURNS TABLE(result_assignment_id uuid, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, agency_training
AS $$
DECLARE
  v_prior agency_training.assignments%ROWTYPE;
  v_existing agency_training.assignment_transitions%ROWTYPE;
  v_fto_id text;
  v_fto_name text;
  v_fto_badge text;
  v_fto_id_hash char(64);
  v_fto_badge_hash char(64);
  v_fto_count integer;
  v_new_end date;
  v_successor_snapshot jsonb;
BEGIN
  IF p_actor_id IS NULL OR length(p_actor_id) < 1 OR length(p_actor_id) > 256
      OR p_actor_hash IS NULL OR p_previous_assignment_id IS NULL
      OR p_successor_assignment_id IS NULL OR p_operation_id IS NULL
      OR p_request_hash IS NULL OR p_fto_id IS NULL OR length(p_fto_id) < 1
      OR length(p_fto_id) > 256 OR p_phase NOT BETWEEN 1 AND 4
      OR p_starts_on IS NULL OR p_ends_on IS NULL OR p_starts_on > p_ends_on THEN
    RAISE EXCEPTION 'invalid successor assignment input'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT a.po_id INTO v_prior.po_id
  FROM agency_training.assignments a
  WHERE a.id = p_previous_assignment_id AND a.active;
  IF NOT FOUND OR v_prior.po_id IS NULL THEN
    RAISE EXCEPTION 'predecessor assignment unavailable'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Match Coordinator handoff and phase-review locking. Recheck authority
  -- after the lock so concurrent roster changes cannot use a stale scope.
  PERFORM pg_advisory_xact_lock(hashtextextended('po:' || v_prior.po_id, 0));
  SELECT * INTO v_prior
  FROM agency_training.assignments a
  WHERE a.id = p_previous_assignment_id
  FOR UPDATE;
  IF NOT FOUND OR NOT v_prior.active OR v_prior.po_id IS NULL
      OR v_prior.po_badge IS NULL OR v_prior.fto_id IS NULL
      OR v_prior.fto_badge IS NULL OR v_prior.coordinator_id_hash IS NULL THEN
    RAISE EXCEPTION 'predecessor assignment unavailable'
      USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT (
    EXISTS (
      SELECT 1 FROM agency_training.po_coordinators pc
      WHERE pc.po_id = v_prior.po_id
        AND pc.po_id_hash = v_prior.po_id_hash
        AND pc.coordinator_id = p_actor_id
    )
    OR (
      NOT EXISTS (
        SELECT 1 FROM agency_training.po_coordinators pc
        WHERE pc.po_id = v_prior.po_id AND pc.po_id_hash = v_prior.po_id_hash
      )
      AND v_prior.coordinator_id_hash = p_actor_hash
    )
  ) THEN
    RAISE EXCEPTION 'Coordinator assignment scope required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Recheck operation idempotency only after locking and revalidating the
  -- current Coordinator scope. Concurrent retries then serialize safely.
  SELECT * INTO v_existing
  FROM agency_training.assignment_transitions
  WHERE operation_id = p_operation_id;
  IF FOUND THEN
    IF v_existing.actor_hash <> p_actor_hash OR v_existing.request_hash <> p_request_hash THEN
      RAISE EXCEPTION 'assignment transition operation conflict'
        USING ERRCODE = 'unique_violation';
    END IF;
    RETURN QUERY SELECT v_existing.successor_assignment_id, false;
    RETURN;
  END IF;

  IF p_starts_on <= v_prior.starts_on THEN
    RAISE EXCEPTION 'successor must start after predecessor start'
      USING ERRCODE = 'check_violation';
  END IF;

  -- A selected FTO must already exist in the trusted roster for this class.
  -- Browser roster imports and client-supplied names/badges are never authority.
  SELECT count(*) INTO v_fto_count
  FROM (
    SELECT DISTINCT a.fto_id, a.fto_name, a.fto_badge,
      a.fto_id_hash, a.fto_badge_hash
    FROM agency_training.assignments a
    WHERE a.active AND a.class_name = v_prior.class_name
      AND a.fto_id = p_fto_id
      AND a.fto_name IS NOT NULL AND a.fto_badge IS NOT NULL
      AND a.fto_id_hash IS NOT NULL AND a.fto_badge_hash IS NOT NULL
  ) known_ftos;
  IF v_fto_count <> 1 THEN
    RAISE EXCEPTION 'trusted FTO not uniquely available for class'
      USING ERRCODE = 'check_violation';
  END IF;
  SELECT a.fto_id, a.fto_name, a.fto_badge, a.fto_id_hash, a.fto_badge_hash
  INTO v_fto_id, v_fto_name, v_fto_badge, v_fto_id_hash, v_fto_badge_hash
  FROM agency_training.assignments a
  WHERE a.active AND a.class_name = v_prior.class_name
    AND a.fto_id = p_fto_id
    AND a.fto_name IS NOT NULL AND a.fto_badge IS NOT NULL
    AND a.fto_id_hash IS NOT NULL AND a.fto_badge_hash IS NOT NULL
  ORDER BY a.fto_badge
  LIMIT 1;

  -- Prevent two active official assignments from claiming the same PO dates.
  IF EXISTS (
    SELECT 1 FROM agency_training.assignments a
    WHERE a.po_id = v_prior.po_id AND a.active
      AND a.id <> p_previous_assignment_id
      AND daterange(a.starts_on, a.ends_on, '[]')
        && daterange(p_starts_on, p_ends_on, '[]')
  ) THEN
    RAISE EXCEPTION 'successor dates conflict with another active assignment'
      USING ERRCODE = 'exclusion_violation';
  END IF;

  -- Keep the old assignment's original row and identity intact. Its range is
  -- only closed immediately before the successor effective date when overlapping.
  v_new_end := v_prior.ends_on;
  IF p_starts_on <= v_prior.ends_on THEN
    v_new_end := p_starts_on - 1;
    UPDATE agency_training.assignments
      SET ends_on = v_new_end
      WHERE id = v_prior.id;
  END IF;

  INSERT INTO agency_training.assignments (
    id, class_name, phase, fto_id_hash, fto_badge_hash, fto_name,
    po_id_hash, po_badge_hash, po_name, coordinator_id_hash,
    starts_on, ends_on, active, fto_id, fto_badge, po_id, po_badge,
    coordinator_id
  ) VALUES (
    p_successor_assignment_id, v_prior.class_name, p_phase,
    v_fto_id_hash, v_fto_badge_hash, v_fto_name,
    v_prior.po_id_hash, v_prior.po_badge_hash, v_prior.po_name,
    v_prior.coordinator_id_hash, p_starts_on, p_ends_on, true,
    v_fto_id, v_fto_badge, v_prior.po_id, v_prior.po_badge,
    v_prior.coordinator_id
  );
  SELECT to_jsonb(a) INTO v_successor_snapshot
  FROM agency_training.assignments a
  WHERE a.id = p_successor_assignment_id;

  INSERT INTO agency_training.assignment_transitions (
    operation_id, actor_hash, request_hash, po_id, po_name, po_badge, class_name,
    previous_assignment_id, successor_assignment_id, previous_phase,
    successor_phase, previous_ends_on, successor_starts_on, successor_ends_on,
    previous_snapshot, successor_snapshot
  ) VALUES (
    p_operation_id, p_actor_hash, p_request_hash, v_prior.po_id, v_prior.po_name,
    v_prior.po_badge, v_prior.class_name, v_prior.id, p_successor_assignment_id, v_prior.phase,
    p_phase, v_new_end, p_starts_on, p_ends_on, to_jsonb(v_prior),
    v_successor_snapshot
  );
  RETURN QUERY SELECT p_successor_assignment_id, true;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION agency_training.create_successor_assignment(
  text, char(64), uuid, uuid, uuid, char(64), text, integer, date, date
) FROM PUBLIC;

COMMIT;

-- Give the non-owner API runtime SELECT only on the assignment columns needed
-- for the transition context and history. Do not grant direct INSERT/UPDATE/
-- DELETE on assignments or assignment_transitions.
-- GRANT SELECT (id,class_name,phase,fto_name,fto_badge,po_name,po_badge,
--   starts_on,ends_on,active,po_id,po_id_hash,coordinator_id_hash,fto_id,
--   fto_id_hash,fto_badge_hash) ON agency_training.assignments TO <runtime>;
-- GRANT SELECT (po_id,po_id_hash,coordinator_id)
--   ON agency_training.po_coordinators TO <runtime>;
-- GRANT SELECT ON agency_training.assignment_transitions TO <runtime>;
-- Grant EXECUTE on agency_training.create_successor_assignment(
--   text, char(64), uuid, uuid, uuid, char(64), text, integer, date, date
-- ) TO <runtime>;
-- Grant SELECT on agency_training.assignment_transitions TO <runtime>.
-- Keep the function owned by the separate migration owner; revoke inherited
-- PUBLIC privileges and do not grant CREATE or ownership to the API runtime.
