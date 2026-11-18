-- Portable PostgreSQL foundation. Apply using a dedicated migration role.
-- Not automatically applied at application startup. See docs/SECURITY.md.
BEGIN;
CREATE TYPE fto_role AS ENUM ('RECRUIT', 'FTO', 'SERGEANT', 'ADMIN');
CREATE TYPE dor_status AS ENUM ('DRAFT', 'FTO_SIGNED', 'RECRUIT_SIGNED', 'LOCKED');
CREATE TYPE evaluation_rating AS ENUM ('NO','A','RT','UA','NRT');
CREATE TYPE audit_action AS ENUM ('CREATE','READ','UPDATE','DELETE','EXPORT','LOGIN','FAILED_LOGIN');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer text,
  subject text,
  name text NOT NULL,
  badge text NOT NULL UNIQUE,
  role fto_role NOT NULL,
  squad text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issuer, subject)
);
-- Local-development credential storage only. Never put secrets in seed files.
CREATE TABLE development_credentials (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  argon2id_hash text NOT NULL CHECK (argon2id_hash LIKE '$argon2id$%'),
  totp_secret_ciphertext bytea NOT NULL,
  totp_last_counter bigint,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz
);
CREATE TABLE training_phases (
  id smallint PRIMARY KEY CHECK (id BETWEEN 1 AND 5),
  name text NOT NULL UNIQUE
);
INSERT INTO training_phases VALUES
  (1,'Phase 1'),(2,'Phase 2'),(3,'Phase 3'),(4,'Phase 4'),(5,'Shadow Phase');
CREATE TABLE recruits (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  phase_id smallint NOT NULL REFERENCES training_phases(id),
  hire_date date NOT NULL,
  training_start date NOT NULL
);
CREATE TABLE assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruit_id uuid NOT NULL REFERENCES recruits(user_id),
  fto_id uuid NOT NULL REFERENCES users(id),
  starts_on date NOT NULL,
  ends_on date,
  CHECK (fto_id <> recruit_id),
  CHECK (ends_on IS NULL OR ends_on >= starts_on),
  UNIQUE (recruit_id, fto_id, starts_on)
);
CREATE TABLE dors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruit_id uuid NOT NULL REFERENCES recruits(user_id),
  fto_id uuid NOT NULL REFERENCES users(id),
  phase_id smallint NOT NULL REFERENCES training_phases(id),
  report_date date NOT NULL,
  shift text NOT NULL,
  precinct text NOT NULL,
  beat text NOT NULL,
  activity_summary text NOT NULL DEFAULT '',
  recruit_comments text NOT NULL DEFAULT '',
  status dor_status NOT NULL DEFAULT 'DRAFT',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE dor_evaluations (
  dor_id uuid NOT NULL REFERENCES dors(id),
  category text NOT NULL CHECK (category IN ('Appearance','Attitude','Knowledge','Performance','Relationships')),
  rating evaluation_rating NOT NULL,
  justification text NOT NULL DEFAULT '',
  PRIMARY KEY (dor_id, category),
  CHECK (rating NOT IN ('UA','NRT') OR length(trim(justification)) > 0)
);
CREATE TABLE dor_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dor_id uuid NOT NULL REFERENCES dors(id),
  signer_id uuid NOT NULL REFERENCES users(id),
  signer_role fto_role NOT NULL CHECK (signer_role IN ('FTO','RECRUIT','SERGEANT')),
  signed_at timestamptz NOT NULL DEFAULT now(),
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  report_version integer NOT NULL CHECK (report_version > 0),
  identity_assurance text NOT NULL,
  UNIQUE (dor_id, signer_role)
);
CREATE TABLE training_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id smallint NOT NULL REFERENCES training_phases(id),
  name text NOT NULL,
  UNIQUE (phase_id, name)
);
CREATE TABLE competency_completions (
  recruit_id uuid NOT NULL REFERENCES recruits(user_id),
  task_id uuid NOT NULL REFERENCES training_tasks(id),
  fto_id uuid NOT NULL REFERENCES users(id),
  demonstrated_on date NOT NULL,
  fto_initials text NOT NULL,
  PRIMARY KEY (recruit_id, task_id)
);
CREATE TABLE sync_operations (
  operation_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  target_record_id uuid NOT NULL,
  request_sha256 text NOT NULL,
  resulting_version integer NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  role fto_role,
  action audit_action NOT NULL,
  target_record_id text NOT NULL,
  timestamp_utc timestamptz NOT NULL DEFAULT now(),
  device_info text NOT NULL,
  ip_address inet NOT NULL,
  request_id uuid NOT NULL,
  CHECK (action = 'FAILED_LOGIN' OR (user_id IS NOT NULL AND role IS NOT NULL))
);
CREATE INDEX audit_logs_timestamp_idx ON audit_logs(timestamp_utc);
CREATE INDEX audit_logs_target_idx ON audit_logs(target_record_id);
CREATE INDEX dors_recruit_date_idx ON dors(recruit_id, report_date);
CREATE INDEX assignments_fto_idx ON assignments(fto_id, recruit_id);

CREATE FUNCTION reject_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only' USING ERRCODE = '42501';
END;
$$;
CREATE TRIGGER audit_rows_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
CREATE TRIGGER audit_no_truncate
BEFORE TRUNCATE ON audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_mutation();
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM PUBLIC;

-- Freeze report content after FTO signing; recruit comments remain editable only
-- until recruit signing. Authorization of the actor is a separate server concern.
CREATE FUNCTION protect_signed_dor() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'DRAFT' THEN RAISE EXCEPTION 'Signed reports cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'LOCKED' THEN RAISE EXCEPTION 'Locked report is immutable'; END IF;
  IF OLD.status <> 'DRAFT' AND
     (to_jsonb(NEW) - ARRAY['status','version','updated_at','recruit_comments']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['status','version','updated_at','recruit_comments']) THEN
    RAISE EXCEPTION 'Signed content cannot be edited';
  END IF;
  IF OLD.status = 'RECRUIT_SIGNED' AND NEW.recruit_comments IS DISTINCT FROM OLD.recruit_comments THEN
    RAISE EXCEPTION 'Signed recruit comments cannot be edited';
  END IF;
  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'DRAFT' AND NEW.status = 'FTO_SIGNED') OR
    (OLD.status = 'FTO_SIGNED' AND NEW.status = 'RECRUIT_SIGNED') OR
    (OLD.status = 'RECRUIT_SIGNED' AND NEW.status = 'LOCKED')
  ) THEN RAISE EXCEPTION 'Invalid signature sequence'; END IF;
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_dor BEFORE UPDATE OR DELETE ON dors
FOR EACH ROW EXECUTE FUNCTION protect_signed_dor();

CREATE FUNCTION protect_evaluations() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.dor_id <> OLD.dor_id THEN
    RAISE EXCEPTION 'Cannot move an evaluation';
  END IF;
  parent_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.dor_id ELSE NEW.dor_id END;
  PERFORM 1 FROM dors WHERE id = parent_id AND status = 'DRAFT' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Evaluations are frozen after signing'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_dor_evaluations BEFORE INSERT OR UPDATE OR DELETE ON dor_evaluations
FOR EACH ROW EXECUTE FUNCTION protect_evaluations();
COMMIT;
