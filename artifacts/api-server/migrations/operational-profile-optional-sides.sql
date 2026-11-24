-- Apply AFTER operational-profiles.sql with the trusted migration role.
-- No packet JSON or physical Cruiser fields are changed.
BEGIN;
ALTER TABLE agency_training.operational_profiles
  DROP CONSTRAINT operational_profiles_assignment_token_check,
  DROP CONSTRAINT operational_profiles_check,
  DROP CONSTRAINT operational_profiles_check1,
  DROP CONSTRAINT operational_profiles_check2,
  DROP CONSTRAINT operational_profiles_check3,
  ALTER COLUMN cruiser_number DROP NOT NULL,
  ALTER COLUMN side DROP NOT NULL,
  ADD COLUMN district_token text;

-- Keep the old derived cruiser_number column for audit, but never use it as
-- fleet evidence. Changing version invalidates in-flight former CAD lookups.
UPDATE agency_training.operational_profiles
SET district_token = substring(assignment_token from 1 for 4),
    cad_unit = assignment_token, version = version + 1,
    updated_at = clock_timestamp();

ALTER TABLE agency_training.operational_profiles
  ALTER COLUMN district_token SET NOT NULL,
  ADD CONSTRAINT operational_profile_token CHECK (assignment_token ~ '^[0-9]{4}[A-Z](-[12])?$'),
  ADD CONSTRAINT operational_profile_district CHECK (district_token = substring(assignment_token from 1 for 4)),
  ADD CONSTRAINT operational_profile_cad CHECK (cad_unit = assignment_token),
  ADD CONSTRAINT operational_profile_letter CHECK (company = substring(assignment_token from 5 for 1)),
  ADD CONSTRAINT operational_profile_side CHECK (side IS NOT DISTINCT FROM nullif(substring(assignment_token from 7 for 1), ''));
COMMIT;
-- Runtime grants also need INSERT and column UPDATE on district_token.
-- Do not broaden trusted roster privileges or grant DELETE/TRUNCATE.
