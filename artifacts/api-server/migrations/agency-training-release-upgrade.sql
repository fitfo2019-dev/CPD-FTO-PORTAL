-- Only for legacy installations missing the release/withdrawal fields.
-- A fresh agency-training.sql installation already contains these definitions.
BEGIN;
ALTER TABLE agency_training.packets
  ADD COLUMN released_at timestamptz,
  ADD COLUMN released_by_hash char(64),
  ADD COLUMN withdrawn_at timestamptz,
  ADD COLUMN withdrawn_by_hash char(64),
  ADD COLUMN withdrawal_reason text,
  ADD COLUMN amendment_of text UNIQUE REFERENCES agency_training.packets(id),
  ADD COLUMN amendment_reason text,
  ADD CHECK ((amendment_of IS NULL AND amendment_reason IS NULL) OR
    (amendment_of IS NOT NULL AND amendment_reason IS NOT NULL AND amendment_of <> id AND length(trim(amendment_reason)) BETWEEN 1 AND 4000));
UPDATE agency_training.packets SET released_to_po = false;
ALTER TABLE agency_training.packets
  ADD CHECK (NOT released_to_po OR
    (released_at IS NOT NULL AND released_by_hash IS NOT NULL AND withdrawn_at IS NULL));
CREATE TABLE agency_training.packet_acknowledgments (
  packet_id text PRIMARY KEY REFERENCES agency_training.packets(id),
  acknowledged_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_hash char(64) NOT NULL,
  content_hash char(64) NOT NULL,
  comments text NOT NULL DEFAULT '' CHECK (length(comments) <= 4000)
);
ALTER TABLE agency_training.packet_events
  ALTER COLUMN occurred_at SET DEFAULT clock_timestamp(),
  DROP CONSTRAINT packet_events_event_type_check,
  ADD CHECK (event_type IN ('READ','COMMIT','RELEASE','WITHDRAW','ACKNOWLEDGE')),
  ADD COLUMN operation_id uuid UNIQUE,
  ADD COLUMN request_hash char(64),
  ADD COLUMN content_hash char(64);
COMMIT;
