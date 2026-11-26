-- Apply after agency-training-packet-review.sql before enabling the PO totals
-- review gate on an existing agency-training installation.
BEGIN;
ALTER TABLE agency_training.packet_submissions
  ADD COLUMN IF NOT EXISTS po_reviewed_at timestamptz;
CREATE INDEX IF NOT EXISTS packet_submissions_coordinator_ready_idx
  ON agency_training.packet_submissions(coordinator_id,submitted_at)
  WHERE state='submitted' AND po_reviewed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS packet_submissions_po_totals_pending_idx
  ON agency_training.packet_submissions(po_id,submitted_at)
  WHERE state='submitted' AND po_reviewed_at IS NULL;
COMMIT;
-- Grant the runtime UPDATE privilege for packet_submissions(po_reviewed_at).
-- Existing records remain unreviewed until the PO explicitly reviews totals.
