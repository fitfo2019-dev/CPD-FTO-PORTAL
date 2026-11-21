# FieldReady security boundary

## Current release: development foundation, fictional data only

Performance evaluations strictly use NO, A, RT, UA, and NRT. Numerical
performance ratings and calculated score averages are prohibited. Older vaults
with numeric evaluations must not be silently converted or re-signed.

This is the initial deliverable requested in the second brief: source structure,
portable SQL schema, encrypted IndexedDB/sync module, and interactive seeded UI.
It is NOT a production-ready system or a CJIS compliance attestation.

### Implemented

- React/TypeScript UI with explicitly fictional records.
- Local AES-GCM-256 encrypted records and queue, random 96-bit IV per write,
  authenticated record/namespace binding, and nonextractable in-memory keys.
- Local demonstration vault unlocked with a user-chosen passphrase via
  PBKDF2-SHA-256 (600,000 iterations), random 256-bit salt, encrypted verifier.
  Salt and opaque record IDs are metadata, not secrets. Never use names/badges
  as namespaces or record IDs.
- Atomic record + queue writes, explicit errors, acknowledgement validation,
  queue retention on transport failures and version conflicts.
- PostgreSQL migration with roles, assignments, reports, evaluations, signatures,
  competencies, idempotent-sync receipts, and append-only audit constraints.
- Server authorization policy and append-only audit repository building blocks.

### Not yet implemented or connected

- Live identity: OIDC, SAML, Argon2id/TOTP development login, MFA enrollment and
  recovery, secure session cookies, revocation, CSRF protection, and rate limits.
  The protocol interface and credential schema are not functioning providers.
- Live database-backed report routes, server-enforced assignment queries, audited
  reads/writes/exports/logins, validated cryptographic signature attestations.
  The middleware and audit repository are not mounted to live report routes.
- Network sync endpoint, authentication/revocation checks on replay, conflict
  resolution UI, idempotent transactions, and signed report digest verification.
- External append-only/WORM audit retention, SIEM forwarding, monitoring,
  encrypted database volumes/backups, disaster recovery, managed device controls,
  penetration tests, independent compliance review and authorization to operate.

## Offline identity and key recovery

A fresh login token must NOT directly encrypt long-lived drafts: token rotation
would make old drafts unreadable. Production should generate a per-user data key,
wrap it using an approved key service after MFA, and establish an explicit
department-approved offline unlock policy (e.g. platform authenticator) with
expiry. A stable identity alone is public and is NOT encryption-key material.

The demo passphrase vault is intentionally NOT account authentication. It cannot
recover a forgotten passphrase. No passphrase/key is saved to localStorage,
IndexedDB, or a server. Locking clears references to keys and application state;
JavaScript garbage collection cannot guarantee physical memory zeroization.
Cached seed files are public, fictional fixtures. Do not insert real identities
or reports in source code.

XSS on the origin can access plaintext while unlocked. Production needs a tested
strict CSP, dependency review, no third-party scripts, device encryption,
browser controls, and appropriate cryptographic validation requirements.
Web Crypto AES-GCM alone does not establish FIPS/CJIS compliance.

## Sync contract and threat model

The queue module accepts an injected authenticated transport, not a URL or
client-supplied identity. The initial app deliberately never says server synced.
Queue entries remain until an exact operationId acknowledgement is returned.
Multiple edits may conflict; timestamps are diagnostic only, NOT authorization
or a last-write-wins overwrite policy. Resolution must preserve both versions
and obtain user confirmation before rebasing or discarding a queued change.

The future server transaction must:

1. Resolve identity from a server-side, MFA-verified session.
2. Check active recruit assignment / squad scope for every record and action.
3. Deduplicate operationId per actor and request digest.
4. Lock the target row and compare baseVersion; return conflict, never overwrite.
5. Validate allowed field changes and FTO -> recruit -> sergeant sequence.
6. Store the mutation, signature digest when applicable, audit event and receipt
   atomically before returning an acknowledgement.

Client UI role switching and typed demonstration signatures do not establish
identity, nonrepudiation, or access control. Offline signing must be treated as a
pending intent until the server verifies authorization and content on replay.

## PostgreSQL deployment

`database/migrations/001_field_training.sql` is a reviewed-source foundation,
not an automatically applied migration. Apply only to a fresh, authorized
self-hosted development database, then validate constraints before production.
No database was provisioned, modified, or connected by this initial deliverable.

Use separate migration and runtime database accounts. Runtime must not own
tables, have superuser/BYPASSRLS privileges, alter triggers, or create objects.
Explicitly grant only required DML on business tables and INSERT/SELECT on
audit_logs, plus USAGE on its identity sequence; revoke UPDATE, DELETE, TRUNCATE
on audit_logs from every runtime role. No runtime account should have DDL rights.
The migration's PUBLIC revocation does not remove direct grants on other roles.

Triggers block audit UPDATE, DELETE and TRUNCATE. A PostgreSQL administrator can
disable triggers: this is append-only against ordinary runtime access, NOT
tamper-proof against a database owner. Independent immutable retention is still
required. Audit reads/exports need audited server endpoints, not direct browser SQL.

Replit's managed Publish schema diff does not carry custom functions, triggers,
roles or grants automatically. Do not assume publishing installs these controls.
This migration targets the user's requested portable/self-hosted deployment;
any managed-production migration approach needs separate explicit approval.

## Hosting and ownership

Application source stays in this repository and uses portable web APIs,
TypeScript, Express and standard PostgreSQL. No hosted identity vendor is needed
for the demonstration. Dependency licenses remain applicable; ownership of
custom source does not transfer ownership of third-party packages.

Before self-hosting: build static assets with the configured base path, serve
over HTTPS from an approved origin, route /api to Express, configure trusted
proxy hops explicitly, enable HSTS/security headers after verification, and
disable all demonstration identity controls for live data. Never treat a
GovCloud product name, encryption checkbox, or this README as compliance proof.
