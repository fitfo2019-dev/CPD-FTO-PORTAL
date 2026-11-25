-- Apply after agency-training-phase-extensions.sql.
-- The runtime role must be granted UPDATE on denial_explanation alongside its
-- existing decision columns; do not grant broader table updates.
BEGIN;
ALTER TABLE agency_training.phase_extension_requests
  ADD COLUMN denial_explanation text;

ALTER TABLE agency_training.phase_extension_requests
  ADD CONSTRAINT phase_extension_denial_explanation_valid CHECK (
    denial_explanation IS NULL OR (
      status = 'denied'
      AND length(trim(denial_explanation)) BETWEEN 1 AND 500
    )
  );

COMMENT ON COLUMN agency_training.phase_extension_requests.denial_explanation IS
  'Optional Coordinator explanation attached only to a denied phase-extension request.';
COMMIT;

-- For the existing API runtime role, add only the new decision column:
--   GRANT UPDATE (denial_explanation)
--     ON agency_training.phase_extension_requests TO <runtime>;
