-- Apply AFTER operational-profile-history.sql with the trusted migration role.
-- Preserve the row/version and legacy cruiser_number evidence; never touch packets or rosters.
BEGIN;
LOCK TABLE agency_training.operational_profiles IN SHARE ROW EXCLUSIVE MODE;
ALTER TABLE agency_training.operational_profile_history
  DROP CONSTRAINT operational_profile_history_event_check,
  DROP CONSTRAINT operational_profile_history_check,
  ADD CONSTRAINT operational_profile_history_event_check
    CHECK (event IN ('created','changed','baseline','cleared')),
  ADD CONSTRAINT operational_profile_history_check CHECK (
    (event = 'baseline' AND old_token IS NULL AND actor_hash IS NULL)
    OR (event = 'created' AND old_token IS NULL AND new_token IS NOT NULL
      AND actor_hash IS NOT NULL AND actor_hash = subject_hash)
    OR (event = 'changed' AND old_token IS DISTINCT FROM new_token
      AND actor_hash IS NOT NULL AND actor_hash = subject_hash)
    OR (event = 'cleared' AND new_token IS NULL
      AND actor_hash IS NOT NULL AND actor_hash = subject_hash)
  );
ALTER TABLE agency_training.operational_profiles
  DROP CONSTRAINT operational_profile_token,
  DROP CONSTRAINT operational_profile_district,
  DROP CONSTRAINT operational_profile_cad,
  DROP CONSTRAINT operational_profile_letter,
  DROP CONSTRAINT operational_profile_side,
  ALTER COLUMN assignment_token DROP NOT NULL,
  ALTER COLUMN district_token DROP NOT NULL,
  ALTER COLUMN cad_unit DROP NOT NULL,
  ALTER COLUMN company DROP NOT NULL;

-- Side is division-internal, not part of the CAD district/shift identifier.
UPDATE agency_training.operational_profiles
SET cad_unit = substring(assignment_token from 1 for 5),
    version = version + 1, updated_at = clock_timestamp();

ALTER TABLE agency_training.operational_profiles
  ADD CONSTRAINT operational_profile_state CHECK (
    (assignment_token IS NULL AND district_token IS NULL AND cad_unit IS NULL
      AND company IS NULL AND side IS NULL)
    OR
    (assignment_token IS NOT NULL AND district_token IS NOT NULL AND cad_unit IS NOT NULL
      AND company IS NOT NULL
      AND assignment_token ~ '^[0-9]{4}[A-Z](-[12])?$'
      AND district_token = substring(assignment_token from 1 for 4)
      AND cad_unit = substring(assignment_token from 1 for 5)
      AND company = substring(assignment_token from 5 for 1)
      AND side IS NOT DISTINCT FROM nullif(substring(assignment_token from 7 for 1), ''))
  );
COMMIT;
-- Existing narrow profile grants plus history SELECT/INSERT suffice. Never DELETE/TRUNCATE.
