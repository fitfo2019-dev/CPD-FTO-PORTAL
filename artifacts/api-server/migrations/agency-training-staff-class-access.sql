-- Apply after agency-training-packet-review.sql. Existing FTO and Coordinator
-- class access continues to come from their trusted roster assignments.
-- Additional staff roles require an explicit server-provisioned class grant.
BEGIN;
CREATE TABLE agency_training.staff_class_read_grants (
  identity_id_hash char(64) NOT NULL,
  identity_role text NOT NULL
    CHECK (identity_role IN ('FTO_COC','POLICENET','POLICENET_ADMIN_SGT')),
  class_name text NOT NULL CHECK (length(trim(class_name)) BETWEEN 1 AND 120),
  active boolean NOT NULL DEFAULT true,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (identity_id_hash, identity_role, class_name)
);
CREATE INDEX ON agency_training.staff_class_read_grants
  (identity_role, class_name) WHERE active;
COMMIT;
-- The agency's trusted roster provisioner must HMAC the verified account ID
-- with the same AUDIT_ID_HMAC_KEY used by the API. Never accept grants from a
-- browser, packet body, role selector, or client-supplied class name.
-- Grant the packet runtime SELECT on staff_class_read_grants only.
