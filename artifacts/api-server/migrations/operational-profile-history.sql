-- Apply AFTER operational-profile-optional-sides.sql, with the trusted
-- migration owner. Never apply to a live agency database from app startup.
BEGIN;
LOCK TABLE agency_training.operational_profiles IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE agency_training.operational_profile_history (
  subject_hash char(64) NOT NULL REFERENCES agency_training.operational_profiles(subject_hash),
  version integer NOT NULL CHECK (version > 0),
  old_token text CHECK (old_token ~ '^[0-9]{4}[A-Z](-[12])?$'),
  new_token text CHECK (new_token ~ '^[0-9]{4}[A-Z](-[12])?$'),
  actor_hash char(64),
  recorded_at timestamptz NOT NULL,
  event text NOT NULL CHECK (event IN ('created','changed','baseline')),
  PRIMARY KEY (subject_hash, version),
  CHECK (
    (event = 'baseline' AND old_token IS NULL AND actor_hash IS NULL)
    OR (event = 'created' AND old_token IS NULL AND new_token IS NOT NULL
      AND actor_hash IS NOT NULL AND actor_hash = subject_hash)
    OR (event = 'changed' AND old_token IS DISTINCT FROM new_token
      AND actor_hash IS NOT NULL AND actor_hash = subject_hash)
  )
);
REVOKE ALL ON agency_training.operational_profile_history FROM PUBLIC;

-- Existing evidence is observed NOW, not backdated into invented history.
-- The migration time is a tracking boundary, not the original assignment date.
INSERT INTO agency_training.operational_profile_history
  (subject_hash,version,old_token,new_token,actor_hash,recorded_at,event)
SELECT subject_hash,version,NULL,assignment_token,NULL,clock_timestamp(),'baseline'
FROM agency_training.operational_profiles;

CREATE FUNCTION agency_training.guard_operational_profile_history()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'operational profile history is append only' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION agency_training.guard_operational_profile_history() FROM PUBLIC;
CREATE TRIGGER operational_profile_history_no_rewrite
BEFORE UPDATE OR DELETE ON agency_training.operational_profile_history
FOR EACH ROW EXECUTE FUNCTION agency_training.guard_operational_profile_history();
CREATE TRIGGER operational_profile_history_no_truncate
BEFORE TRUNCATE ON agency_training.operational_profile_history
FOR EACH STATEMENT EXECUTE FUNCTION agency_training.guard_operational_profile_history();
COMMIT;
-- Runtime: SELECT, INSERT only on operational_profile_history. No sequence,
-- UPDATE, DELETE, TRUNCATE, DDL, ownership, or broader trusted-roster privileges.
