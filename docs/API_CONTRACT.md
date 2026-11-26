# Proposed shared assignment and report API

**Status: design only.** These routes are not mounted, the migration is not
applied, and no assignment is currently shared between accounts. The current
portal remains a device-local draft application.

## Current implementation inventory

| Area | Current state |
| --- | --- |
| Portal | React, TypeScript, and Vite single-page web app. |
| Sign-in | Replit-managed Clerk is present. A Clerk session proves only that a user signed in; it does not prove department employment, app role, class membership, or required MFA. |
| API | Express 5 service is configured under `/api`; only the health route is mounted. The field-training API service has no production database connection. |
| Database | A PostgreSQL/Drizzle package exists and requires `DATABASE_URL`, but no database has been provisioned or connected. `001_field_training.sql` is an unapplied legacy foundation; it has obsolete roles, an extra phase, and a Daily Performance Summary schema that does not match the current forms. Do not apply it to a department database. |
| Structured training data | Daily logs, runs, ratings, daily statistics, narratives, weekly logs, acknowledgements, phase folders, local assignments, roster, orientation records, and coverage requests are stored together in one encrypted `workspace` record in browser IndexedDB. It is not shared storage. |
| Local queue | Encrypted IndexedDB `sync_queue` operations are retained on the device. There is no authenticated upload transport. |
| Chat | Encrypted `local_drafts` IndexedDB store, excluded from sync. It is device-local and unsent. |
| Preferences | Day/night theme is stored in browser `localStorage`. |
| Files | CSV/DOCX roster files are parsed in the browser; parsed values are saved in the local workspace. The source files are not uploaded. Document/video attachment storage is not implemented. |
| Deployment | The portal is a static Vite artifact. An Express API artifact is separately configured for development and a production start command, but it is not connected to a database or report routes. No department-approved production host, database, object store, origin, or retention policy is configured. |

The proposed assignment tables are in
[`database/migrations/proposed/001_shared_assignments.sql`](../database/migrations/proposed/001_shared_assignments.sql).
That file is not in the active migration path, has not been applied or tested
against PostgreSQL, and still requires DBA review, runtime grants, and an
approved database baseline.

The local database name uses a fixed browser namespace. Separate sign-ins in the
same browser do not create separate server records or guarantee separation of
the local vault. Users must not treat local entries as shared or official.

## Department-approved architecture

```text
PO / FTO browser
  ├─ encrypted device-local vault and pending queue
  └─ HTTPS → approved application host / Express API
                ├─ verified department identity and MFA
                ├─ server-side role, class, phase, and assignment checks
                ├─ approved PostgreSQL for records, versions, assignments, audit
                ├─ approved encrypted object storage for documents/video
                └─ approved key service for per-user wrapped offline keys
```

The department chooses the host, region, database, object store, identity
provider, key service, retention, and backup policy. PostgreSQL is a portable
candidate, not an approval to use Replit-hosted or any other unapproved database.
The service must use private networking where supported, TLS, least-privilege
runtime credentials, encrypted backups, tested restoration, monitored audit
events, and a separate migration credential. Browser code must never contain
database or storage credentials.

## Identity and authorization

- The API resolves a stable subject and active session from a verified
  server-side identity provider. The department must approve how agency email,
  employment, MFA assurance, and session revocation are verified.
- Application roles and class authorizations come from server-managed records,
  never from a request body, role selector, query string, or client-supplied
  header.
- Proposed operational roles are PO, FTO, FTO Coordinator, FTO Sgt., FTO COC,
  POLICENET, and POLICENET Admin. FTO Sgt. authority is limited to the
  specifically granted class assignment action; it does not imply report,
  roster, or audit access. The POLICENET Admin SGT/LT two-person approval is
  reserved for training-record deletion.
- Each API request re-checks active account, session revocation, MFA, role,
  current class and phase activation, and the target record's scope. Direct API
  calls receive the same checks as the UI.
- PO reads are restricted to that PO's active, confirmed class/phase records.
  FTO reads and writes are restricted to POs and dates covered by an active
  assignment or accepted substitute coverage. FTO Coordinator, FTO Sgt., and
  FTO COC can assign only within explicitly authorized class scope. FTO COC
  packet access remains read/comment/export only for completed/submitted
  packets; assignment permission is a separate action.
- Server queries must apply scope in the database query, not fetch all class
  records and filter them in the browser. Return 404 for out-of-scope object
  identifiers where disclosure would reveal another record.

## First shared workflow: assign an FTO

`POST /api/v1/classes/{classId}/assignments`

Request:

```json
{
  "operationId": "client-generated-uuid",
  "poId": "server-issued-user-id",
  "ftoId": "server-issued-user-id",
  "phase": 1,
  "startsOn": "2026-11-19",
  "reason": "Initial Phase I assignment"
}
```

The request does not accept a role, coordinator, squad, assignment history,
approval list, or actor identity. The server must resolve those values from
verified identity and current database records. The target PO must be an active
member of the path's class. The FTO must be active, provisioned, and hold the
FTO role. Phase must be 1–4. The requester must be the class's FTO Coordinator
or a currently authorized FTO Sgt./FTO COC member for that class.

In one database transaction the service must:

1. Lock and re-read the class, PO, FTO, authorization, and active assignment.
2. Reject inactive, unprovisioned, wrong-class, wrong-phase, revoked, or
   unauthorized requests.
3. Check `(actor, operationId)` idempotency and compare the stored request
   digest. Reuse with a different body returns `409`.
4. Close the prior active assignment for the same PO/phase, if any, without
   deleting or replacing its history.
5. Insert a new assignment row, append an immutable audit event with before/
   after FTO, actor, role, class, phase, time, reason, and request ID, and store
   the idempotency receipt.
6. Commit before returning `201`. Any error rolls back all steps.

Successful response:

```json
{
  "assignmentId": "server-issued-id",
  "poId": "server-issued-user-id",
  "ftoId": "server-issued-user-id",
  "classId": "server-issued-class-id",
  "phase": 1,
  "startsOn": "2026-11-19",
  "version": 1,
  "status": "confirmed"
}
```

`GET /api/v1/classes/{classId}/assignments` returns only current and historical
assignments the signed-in user is authorized to view. `GET /api/v1/me/records`
returns only the signed-in PO's records or records within an FTO's active
assignment/accepted coverage. A later `GET /api/v1/assignments/{id}` follows the
same per-record policy. Responses must never expose other class members to a PO.

Status codes: `401` missing/expired/revoked session or MFA; `403` authenticated
but not authorized; `404` unknown or intentionally concealed out-of-scope
resource; `409` stale assignment, duplicate operation with a different payload,
or version conflict; `422` invalid phase or inactive/unprovisioned account.

## Report sync contract

`POST /api/v1/sync/operations` accepts a bounded batch of encrypted-queue
operations after the client unlocks locally. The server must authenticate the
actor independently and validate every operation. An operation includes
`operationId`, `recordId`, `baseVersion`, and the proposed record content. The
server computes its own canonical request digest; it never trusts the client
timestamp as authority.

For each operation, in one transaction, the server checks current scope,
idempotency, field permissions, `baseVersion`, signature sequence, and audit
requirements. It returns an exact `operationId` acknowledgement only after the
record, version, audit entry, and receipt commit. A mismatch returns `409` with
both versions preserved for explicit comparison; never use last-write-wins.
Conflicts remain queued until a user reviews and resolves them. Revoked or
deactivated accounts receive no acknowledgement and cannot replay queued writes.
Signature intents are bound to the exact content digest and server-verified
signer; an offline signature remains pending until replay is verified.

A user statistic is never derived from a run, import, narrative, or code. The
server stores the manual value, blank/entered state, editor, timestamp, and
correction reason as explicit versioned data. Run selections may be supporting
evidence and can create a review flag, but cannot overwrite a statistic.

## Local-draft review and import

The browser vault currently contains a single encrypted workspace with the data
types listed in the inventory above. It can also contain encrypted queued
operations and separate unsent chat drafts. Local roster imports are parsed
before storage. No automatic upload or import into official records is allowed.

Before any migration, produce a device-by-device inventory and counts, identify
synthetic/test data, have authorized staff review each record and owner, map
local PO/FTO references to provisioned server identities, preview the proposed
import, obtain explicit approval, and import through a one-time audited tool
with an idempotent batch ID. Keep originals local until the server confirms the
reviewed import; mark each imported record server-confirmed only after the
server's committed receipt is verified. Do not import chat drafts by default.

## Deployment and department configuration required

Provide these values through workspace/deployment secrets or the department's
approved secret manager, never source files or prompt text:

- approved production host, public HTTPS origin, deployment region, reverse
  proxy/trusted-hop configuration, allowed origins, and environment separation;
- approved PostgreSQL `DATABASE_URL`, migration account, runtime account, pool
  limits, network allowlist, backup cadence, retention, recovery-point and
  recovery-time objectives;
- approved identity provider/agency SSO, verified department-email policy,
  MFA assurance claim, stable subject mapping, deprovisioning/revocation
  mechanism, session lifetime, and initial admin provisioning procedure;
- approved object-storage endpoint/bucket, region, encryption, access policy,
  upload limits/types, video playback controls, deletion and retention/hold
  rules;
- approved KMS/key-wrapping service, per-user key recovery, offline unlock
  lifetime, revocation, and lost-device response;
- audit retention/SIEM destination, monitoring contacts, incident response,
  approved PWA/browser/device policy, and authorization-to-operate criteria.

No real server record, account-to-account assignment, report upload, or
production offline behavior is available until these are configured and tested.

## Setup, migration, verification, and recovery

There is no active database migration runner or configured `DATABASE_URL`.
After the department approves a disposable staging PostgreSQL environment,
the DBA must review the proposed migration, add required least-privilege runtime
grants, and test all constraints/triggers before applying it to staging. Do not
run the legacy `database/migrations/001_field_training.sql` as a shortcut.
Configure database connection strings and signing/key-service values through
the approved deployment secret manager; never put them in `.env` committed to
source, the frontend bundle, or user prompts.

Before enabling routes, add integration tests against a disposable PostgreSQL
database with two separately provisioned test accounts and an isolated
transaction/fixture set. Verify: a scoped Coordinator/Sgt/COC assignment
commits; FTO and PO accounts see only their assigned records; a different PO,
unassigned FTO, wrong-class manager, expired/revoked session, and direct API
call are denied; duplicate operation IDs are idempotent; replacement preserves
the old row and writes exactly one immutable audit event; and version conflicts
preserve both edits. The current repository has policy unit tests only; these
database and browser integration tests have not been run.

For backups, use the approved database provider's encrypted backup mechanism
and a separately protected recovery account. If using PostgreSQL tools, run
`pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL"` from an approved
admin environment and send the output directly to approved encrypted backup
storage; do not leave it in the app workspace. Restore only to an isolated
recovery database with `pg_restore`, validate row counts, assignment history,
audit immutability, object references, and application authorization, then
record the restore drill. Database and object-store backups must be coordinated
to the department's recovery-point objective. No backup or restore has been
configured or tested here.

Local-data import remains a separate, opt-in review project. It must inventory
each device vault, identify test records, obtain owner/records approval, map
local identities to provisioned accounts, present a preview, and require an
audited approval before importing. Originals remain local until each server
receipt is verified; no browser workspace is automatically uploaded.
