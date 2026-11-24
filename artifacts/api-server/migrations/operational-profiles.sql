-- Apply to the agency database with the trusted migration role, not at runtime.
BEGIN;
CREATE TABLE agency_training.operational_profiles (
  subject_hash char(64) PRIMARY KEY,
  assignment_token text NOT NULL CHECK (assignment_token ~ '^[0-9]{4}[A-Z]-[12]$'),
  cruiser_number text NOT NULL,
  cad_unit text NOT NULL,
  company text NOT NULL,
  side text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (cruiser_number = substring(assignment_token from 1 for 4)),
  CHECK (cad_unit = substring(assignment_token from 1 for 5)),
  CHECK (company = substring(assignment_token from 5 for 1)),
  CHECK (side = substring(assignment_token from 7 for 1))
);
COMMIT;
-- Grant runtime SELECT, INSERT and column-only UPDATE on
-- (assignment_token,cruiser_number,cad_unit,company,side,version,updated_at).
-- Never grant DELETE/TRUNCATE, ownership, or changes to trusted roster tables.
-- Trusted invitation provisioning may seed this table using the same parser.
