-- Apply once to an EXISTING agency-training installation, with an owner/admin
-- account, before installing this release. This script is not run by the app.
BEGIN;
-- Preserve existing submissions, but do not promote an unreviewed upload into
-- a Coordinator inbox. Existing authenticated release/withdrawal evidence is
-- retained; all other uploads require explicit FTO finalization.
ALTER TABLE agency_training.packets ADD COLUMN submission_status text NOT NULL DEFAULT 'local_draft_pending'
  CHECK (submission_status IN ('local_draft_pending','submitted'));
UPDATE agency_training.packets SET submission_status='submitted'
  WHERE released_at IS NOT NULL OR withdrawn_at IS NOT NULL
    OR EXISTS(SELECT 1 FROM agency_training.packet_acknowledgments k WHERE k.packet_id=packets.id);
ALTER TABLE agency_training.packets ADD COLUMN finalization_operation_id uuid UNIQUE;
ALTER TABLE agency_training.packets ADD COLUMN submitted_at timestamptz;
ALTER TABLE agency_training.packet_events ADD COLUMN IF NOT EXISTS server_version integer;
ALTER TABLE agency_training.packets DROP CONSTRAINT packets_server_version_check;
ALTER TABLE agency_training.packets ADD CONSTRAINT packets_server_version_check CHECK (server_version >= 1);
ALTER TABLE agency_training.packet_events DROP CONSTRAINT packet_events_event_type_check;
ALTER TABLE agency_training.packet_events ADD CONSTRAINT packet_events_event_type_check
  CHECK (event_type IN ('READ','COMMIT','DRAFT_SYNC','SUBMIT','RELEASE','WITHDRAW','ACKNOWLEDGE'));
COMMIT;
-- Grant only the documented mutable packet columns, never assignment or audit
-- updates. Apply packet-review and packet-guards before activating this release.
