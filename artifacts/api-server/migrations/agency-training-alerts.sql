-- Apply after agency-training-packet-review.sql. No records are seeded here.
-- Training alerts tell the PO's assigned FTO Coordinator and every FTO
-- Sergeant about an NRT rating (FTO Manual p. 15, item 9; p. 19), an FTO's NRT
-- review request, and a Phase IV Not release recommendation (FTO Manual p. 48).
BEGIN;
CREATE TABLE agency_training.training_alerts (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('NRT','NRT_REVIEW_REQUEST','NOT_RELEASE')),
  po_id text NOT NULL,
  po_badge text NOT NULL,
  po_name text NOT NULL CHECK (length(po_name) <= 200),
  class_name text NOT NULL CHECK (length(class_name) <= 120),
  phase integer NOT NULL CHECK (phase BETWEEN 1 AND 4),
  coordinator_id text NOT NULL REFERENCES agency_training.coordinator_directory(id),
  fto_id text NOT NULL,
  fto_name text NOT NULL CHECK (length(fto_name) <= 200),
  -- NRT: one alert per finalized packet and category; corrections reuse it.
  source_packet_id text,
  category text CHECK (category IS NULL OR category ~ '^[A-Za-z][A-Za-z0-9]{0,79}$'),
  record_date date,
  report_ids text[] NOT NULL DEFAULT '{}',
  summary text NOT NULL DEFAULT '' CHECK (length(summary) <= 5000),
  -- NOT_RELEASE: the FTO's current choice. A change to release stays visible.
  week15_choice text CHECK (week15_choice IS NULL OR week15_choice IN ('release','not_release')),
  week15_changed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','closed')),
  closed_by_hash char(64),
  closed_by_name text CHECK (closed_by_name IS NULL OR length(closed_by_name) <= 200),
  closed_by_role text CHECK (closed_by_role IS NULL OR closed_by_role IN ('FTO_COORDINATOR','FTO_SGT')),
  closed_at timestamptz,
  close_note text NOT NULL DEFAULT '' CHECK (length(close_note) <= 5000),
  CHECK ((state='closed') = (closed_at IS NOT NULL AND closed_by_hash IS NOT NULL AND length(trim(close_note)) > 0))
);
CREATE UNIQUE INDEX training_alerts_nrt_once
  ON agency_training.training_alerts (source_packet_id, category) WHERE kind='NRT';
CREATE UNIQUE INDEX training_alerts_week15_once
  ON agency_training.training_alerts (po_id) WHERE kind='NOT_RELEASE' AND state='open';
CREATE INDEX ON agency_training.training_alerts (coordinator_id, state, created_at);
CREATE INDEX ON agency_training.training_alerts (state, created_at);
CREATE INDEX ON agency_training.training_alerts (fto_id, created_at);

-- Verified sign-in email for alert notices, recorded when a Coordinator or FTO
-- Sergeant signs in. Never accepted from a browser or a roster file.
CREATE TABLE agency_training.alert_recipients (
  identity_id text PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('FTO_COORDINATOR','FTO_SGT')),
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 320 AND email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON agency_training.alert_recipients (role) WHERE active;

-- Notice-only email queue. Messages carry no names, badges or ratings.
CREATE TABLE agency_training.alert_email_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alert_id uuid NOT NULL REFERENCES agency_training.training_alerts(id),
  recipient_id text NOT NULL REFERENCES agency_training.alert_recipients(identity_id),
  notice text NOT NULL CHECK (notice IN ('NRT','NRT_REVIEW_REQUEST','NOT_RELEASE','NOT_RELEASE_CHANGED')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error_code text NOT NULL DEFAULT '' CHECK (length(last_error_code) <= 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (alert_id, recipient_id, notice)
);
CREATE INDEX ON agency_training.alert_email_outbox (status, created_at) WHERE status='queued';

CREATE TABLE agency_training.training_alert_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alert_id uuid NOT NULL REFERENCES agency_training.training_alerts(id),
  actor_hash char(64) NOT NULL,
  action text NOT NULL CHECK (action IN ('CREATED','WEEK15_CHANGED','CLOSED')),
  note text NOT NULL DEFAULT '',
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON agency_training.training_alert_events (alert_id, id);
COMMIT;
-- Runtime grants (separate non-owner role):
--   training_alerts: SELECT/INSERT and column-only UPDATE(week15_choice,
--     week15_changed_at,summary,report_ids,state,closed_by_hash,closed_by_name,
--     closed_by_role,closed_at,close_note).
--   alert_recipients: SELECT/INSERT and column-only UPDATE(role,email,active,updated_at).
--   alert_email_outbox: SELECT/INSERT and column-only UPDATE(status,attempts,
--     last_error_code,sent_at).
--   training_alert_events: SELECT/INSERT only. Sequence USAGE on identity columns.
-- Never grant DELETE or TRUNCATE on any alert table.
