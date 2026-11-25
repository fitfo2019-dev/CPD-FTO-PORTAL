-- Apply after agency-training-packet-review.sql for fresh and upgraded sites.
-- The current draft may change; submitted and withdrawn content may not.
BEGIN;
CREATE FUNCTION agency_training.guard_packet_snapshot() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,agency_training AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
    OR NEW.record_date IS DISTINCT FROM OLD.record_date
    OR NEW.phase IS DISTINCT FROM OLD.phase
    OR NEW.amendment_of IS DISTINCT FROM OLD.amendment_of
    OR NEW.amendment_reason IS DISTINCT FROM OLD.amendment_reason THEN
    RAISE EXCEPTION 'Packet identity and amendment links are immutable';
  END IF;
  IF OLD.submission_status='submitted' OR OLD.withdrawn_at IS NOT NULL THEN
    IF NEW.report IS DISTINCT FROM OLD.report
      OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
      OR NEW.operation_id IS DISTINCT FROM OLD.operation_id
      OR NEW.server_version IS DISTINCT FROM OLD.server_version THEN
      RAISE EXCEPTION 'Submitted packet content is immutable';
    END IF;
  END IF;
  IF OLD.withdrawn_at IS NOT NULL AND (
    NEW.withdrawn_at IS DISTINCT FROM OLD.withdrawn_at
    OR NEW.withdrawal_reason IS DISTINCT FROM OLD.withdrawal_reason
    OR NEW.withdrawn_by_hash IS DISTINCT FROM OLD.withdrawn_by_hash
    OR NEW.submission_status IS DISTINCT FROM OLD.submission_status
    OR NEW.released_to_po) THEN
    RAISE EXCEPTION 'Withdrawal is permanent';
  END IF;
  IF OLD.submission_status='submitted' AND NEW.submission_status='local_draft_pending' THEN
    IF OLD.released_to_po OR OLD.withdrawn_at IS NOT NULL OR NOT EXISTS (
      SELECT 1 FROM agency_training.packet_submissions s WHERE s.packet_id=OLD.id
        AND s.packet_version=OLD.server_version AND s.state='correction_requested'
    ) THEN RAISE EXCEPTION 'A reviewed correction request is required'; END IF;
  END IF;
  IF OLD.submission_status='local_draft_pending' AND NEW.submission_status='submitted' THEN
    IF NEW.finalization_operation_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM agency_training.packet_submissions s WHERE s.packet_id=NEW.id
        AND s.packet_version=NEW.server_version AND s.state='submitted'
        AND (s.report-'status')=(NEW.report-'status')
    ) THEN RAISE EXCEPTION 'Explicit finalization and an immutable submission are required'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION agency_training.guard_packet_snapshot() FROM PUBLIC;
CREATE TRIGGER protect_packet_snapshot BEFORE UPDATE ON agency_training.packets
  FOR EACH ROW EXECUTE FUNCTION agency_training.guard_packet_snapshot();
COMMIT;
