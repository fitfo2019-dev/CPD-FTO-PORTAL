# Field Training Officer Portal security boundary

The proposed shared-record and assignment design is documented in
[`API_CONTRACT.md`](./API_CONTRACT.md). It is a contract proposal only; no
assignment or report route is mounted.

## Current release: device-local records only

The application starts with an empty workspace and stores user-entered records
only on the current device. `/api/v1/secure-records` is mounted for a clearly
labeled synthetic preview response; its live path is fail-closed until the
department identity, role/scope, API audience, endpoint allowlist, and approved
data service are configured. This is NOT a production-ready system or a CJIS
compliance attestation.

### Implemented

- React/TypeScript UI with an empty initial workspace; no server-backed reports.
- Local AES-GCM-256 encrypted records and queue, random 96-bit IV per write,
  authenticated record/namespace binding, and nonextractable in-memory keys.
- Local passphrase vault unlocked with a user-chosen passphrase via
  PBKDF2-SHA-256 (600,000 iterations), random 256-bit salt, encrypted verifier.
  Salt and opaque record IDs are metadata, not secrets. Never use names/badges
  as namespaces or record IDs.
- Requests persistent browser storage when the local vault is opened, where the
  browser supports it. This is best-effort and is not a backup or guarantee
  against a user clearing site data or losing the device.
- Atomic record + queue writes, explicit errors, acknowledgement validation,
  queue retention on transport failures and version conflicts.
- Browser connection recovery retries a failed encrypted local write; it does
  not trigger server upload because no authenticated transport is connected.
- FTO Forum can store encrypted, device-local unsent drafts in a separate
  IndexedDB store. These drafts are excluded from the report sync queue, are
  never automatically uploaded, and can be deleted by the author.
- FTO roster and phase assignments can be parsed from CSV or Word `.docx`
  tables in the browser and stored in the device-local workspace. The
  prefilled assignment email opens the user's external mail composer only after
  a click; the portal does not send it. Assignment chat is local to this
  workspace/device and does not reach another account.
- PostgreSQL migration with roles, assignments, Daily Performance Logs, evaluations, signatures,
  competencies, idempotent-sync receipts, and append-only audit constraints.
- Server authorization policy and append-only audit repository building blocks.
- `/api/v1/secure-records` mock mode, selected unless `USE_REAL_API=true`, returns
  only labeled synthetic data. It emits request timestamp/ID and keyed hashes of
  the server-resolved user identity and client IP into application logs.
- The live route has an HTTPS host allowlist, verified-token-audience gate,
  timeout/response-size limits, stable error codes, and a fail-closed
  server-side authorization grant check. It forwards only the bearer header,
  only after those checks.

### Secure-records live-mode configuration

Do not turn on `USE_REAL_API` until all live-mode requirements are approved and
configured:

- Set `USE_REAL_API=true` only in the approved server environment. Any other
  value keeps the endpoint in synthetic mock mode.
- Configure `GOV_API_SECURE_RECORDS_URL` to the exact approved HTTPS endpoint,
  `GOV_API_ALLOWED_HOSTS` to its exact host, and `GOV_API_AUDIENCE` plus
  `GOV_API_AUTHORIZED_PARTIES` for the token validation contract.
- `CLERK_SECRET_KEY` and `AUDIT_ID_HMAC_KEY` are server secrets and must remain
  in the environment-secrets store. The audit key must be at least 32 bytes.
- The request token is independently verified with Clerk, including signature,
  audience, authorized party, and subject matching. The external service must
  explicitly trust this issuer/audience. If it expects a department token
  issuer, use an approved token-exchange design instead of forwarding a Clerk
  token.
- A trusted server-side authorization adapter must set the `secure-records:read`
  grant after checking the approved role and record scope. No such adapter is
  configured, so live requests currently stop before any government API call.
- If the service is behind a reverse proxy and the audit must hash the original
  client IP rather than the socket peer, configure Express with the exact
  trusted proxy hop count before relying on `req.ip`. Never trust an arbitrary
  client-supplied forwarded-IP header.
- The current integration expects a JSON array of at most 500 records and a
  response no larger than 1 MB. Confirm or revise this contract with the API
  owner before enabling live mode.

The route emits structured, keyed-hash events to ordinary application logs.
Those logs are not durable forensic storage; connect an approved append-only
audit sink, retention policy, and monitoring before operational use.

### Not yet implemented or connected

- The application includes Clerk sign-in, but it does not verify department identity,
  roles, class assignment, or MFA for server authorization. No agency SSO, secure
  session/revocation policy, CSRF protection, or rate limits are connected.
- Academy account lifecycle: pre-created pending PO invitations to department
  email, verified account activation, terms acceptance, required MFA completion,
  and the distinct audit events for activation and Phase I/class confirmation.
  A Clerk-authenticated session alone does not verify a department role or class
  assignment; unassigned accounts must have no server access to training records.
- Live database-backed Daily Performance Log routes, server-enforced assignment queries, audited
  reads/writes/exports/logins, validated cryptographic signature attestations.
  The append-only database audit repository is not mounted to this route.
- Durable forensic audit retention: the secure-records route's hashed access
  events currently go to ordinary application logs, not PostgreSQL, WORM storage,
  or a SIEM. Do not treat these logs as a complete or tamper-proof audit trail.
- The real secure-records route has no department authorization adapter or
  approved government API contract/configuration. It returns a structured error
  and does not make an upstream request until those are supplied and tested.
- Network sync endpoint, authentication/revocation checks on replay, conflict
  resolution UI, idempotent transactions, and signed report digest verification.
- Patrol View import or API integration. No supported endpoint, export contract, or
  source system authorization has been verified. An internal host/path name alone
  is not a connection or import schema.
- Class-wide records across accounts or devices. Class summaries and Excel exports
  are limited to records saved in the current device-local workspace.
  The local UI shows class records and exports only to its FTO and FTO Coordinator
  views, including direct-route checks. This is not authorization: the client-side
  role selector is switchable by the visitor. Live class endpoints and export audits must enforce
  verified FTO / FTO Coordinator roles server-side before operational access.
- Offline install verification across target browsers and true cold-start tests
  on a disconnected device have not been completed. The production service worker
  precaches the local app bundle and public assets only; API and user records are
  never placed in the service-worker cache.
- Shared FTO/PO contact, a verified chat service, server-backed roster
  assignments, PO training-document assignment/completion storage, and audited
  email delivery. Local chat drafts do not reach another account and remain
  unsent even after connectivity returns; no sent-message history or edits are
  stored. The `mailto:` draft is not proof that an assignment notice was delivered.
- Real run-level identifiers, locations, or narratives. The current daily editor
  and run-form workflow have no protected report routes, approved identity, or
  authorized data source. Do not use them for operational records until those
  controls are verified.
- External append-only/WORM audit retention, SIEM forwarding, monitoring,
  encrypted database volumes/backups, disaster recovery, managed device controls,
  penetration tests, independent compliance review and authorization to operate.

## Offline identity and key recovery

A fresh login token must NOT directly encrypt long-lived drafts: token rotation
would make old drafts unreadable. Production should generate a per-user data key,
wrap it using an approved key service after MFA, and establish an explicit
department-approved offline unlock policy (e.g. platform authenticator) with
expiry. A stable identity alone is public and is NOT encryption-key material.

The local passphrase vault is intentionally NOT account authentication. It cannot
recover a forgotten passphrase. No passphrase/key is saved to localStorage,
IndexedDB, or a server. Locking clears references to keys and application state;
JavaScript garbage collection cannot guarantee physical memory zeroization.
Test fixture records are not loaded into a new workspace. Do not insert real
identities or reports in source code.

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
5. Validate allowed field changes and the FTO -> PO signature sequence. COC
   access is read/comment only and limited to completed, submitted packets;
   FTO Coordinator handles packet corrections and escalation.
6. Store the mutation, signature digest when applicable, audit event and receipt
   atomically before returning an acknowledgement.

Client UI role switching and locally entered signature data do not establish
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

### Local substitute coverage and NRT review

The class roster and “Sub in for an FTO” workflow use device-local
records. Creating a substitute day copies the selected coverage FTO into a new
draft without replacing the regular phase assignment or another daily log.
The current FTO role view exposes locally imported class assignments; it does not
authorize an actual account to access class records.
FTOs and FTO Coordinator can also create or correct the local phase case folder
without a roster entry; imported roster rows are optional prefills, and roster
management remains a local office-admin workflow. These edits have no
server-side audit trail and are not operational assignment corrections.

NRT follow-up links earlier reviewed UA entries and saves explanation, corrective
training, and an office response locally. “Submit” and “response” refer only to
this on-device review list. No other account receives the request, no
notification is sent, and no official review or identity is verified.

Real class-wide FTO access, COC/termination packet review, attachment/video
storage and retention, notifications, and offline server sync remain unavailable
until protected APIs enforce verified roles and approved storage/audit policies.

### Hosting boundary

Application source stays in this repository and uses portable web APIs,
TypeScript, Express and standard PostgreSQL. No identity provider is configured
for department authorization. Dependency licenses remain applicable; ownership of
custom source does not transfer ownership of third-party packages.

Before self-hosting: build static assets with the configured base path, serve
over HTTPS from an approved origin, route /api to Express, configure trusted
proxy hops explicitly, enable HSTS/security headers after verification, and
disable all demonstration identity controls for live data. Never treat a
GovCloud product name, encryption checkbox, or this README as compliance proof.
