# Isolated synthetic agency-access staging

This is a **tested prototype**, not authorization to store operational records
or a certification of agency/CJIS compliance. The portal remains device-local.
No view, role selector, saved workspace, encrypted queue, or local chat draft
is connected to this API. No existing records are automatically uploaded.

## Access and implementation

There is **no separate developer password or hidden developer access**.
Every staged request requires:

1. A Clerk-verified identity and an online check that its session remains active.
2. A second factor verified within the last 15 minutes (`fva[1]`).
3. An active, agency-verified, terms-accepted entry in the server-managed
   synthetic directory, resolved by `AUDIT_ID_HMAC_KEY` HMAC of the Clerk subject.
4. Active class, phase, PO and FTO directory entries and assignment scope.

Directory grants are not accepted from client headers, request bodies, role
selectors, or user-editable metadata. An unprovisioned signed-in account gets
403; an absent/expired/unverifiable session gets 401. No directory provisioning
API is exposed. Staging grants must be explicitly reviewed and provisioned by
the developer/DBA; never promote the first registered user automatically.

| Role | Scoped synthetic capability |
| --- | --- |
| PO | Read own submitted records and acknowledge the exact current version. Cannot edit narrative, date, assignment, or status. |
| FTO | Read/create/update records for an active assignment and its date window. No class-wide bypass. |
| FTO Coordinator | Read records only in classes they coordinate. Corrections, assignment management, and exports are not exposed by this prototype. |
| Test administrator | Read/create/update every synthetic record across all synthetic classes and assignments. Cannot acknowledge (that is the PO's own attestation). Never valid outside synthetic staging. |
| Other/unprovisioned | No access. |

The authenticated identity is resolved on every request. Database scope is
applied inside queries, not after fetching records for browser filtering.
Out-of-scope object IDs return 404. Requests/responses use generated OpenAPI/Zod
contracts. Unknown input keys, invalid dates, oversized narratives and invalid
types fail with a standard error envelope. Narrative is plain text, not HTML.

## Portable development setup

Use a disposable development PostgreSQL database, never an operational database.
The dedicated `synthetic_training` schema is described by
`lib/db/src/staging-schema.ts` and `database/staging-schema.sql`. It is
deliberately absent from the normal Drizzle schema barrel and must be reviewed
and installed explicitly. Never apply the obsolete legacy migration as a shortcut.
There is no startup DDL or automatic production migration.

```sh
pnpm install --frozen-lockfile
# In the isolated development environment only, with DATABASE_URL configured:
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/staging-schema.sql
pnpm typecheck
pnpm test:staging
```

`test:staging` uses uniquely named fictional subjects, exercises the actual
Express router and PostgreSQL transactions with an injected verified-session
resolver, and cleans up only its own fixtures. It does not create Clerk users,
grant real accounts roles, alter device vaults, or test an agency SSO deployment.
It requires the reviewed staging schema and an HMAC key; it never prints those
credentials.

To run the staged API, use a **development** build with
`SYNTHETIC_STAGING_ENABLED=true`, `DATABASE_URL`, the normal Clerk configuration,
and `AUDIT_ID_HMAC_KEY`. Both Clerk and an explicit reviewed directory entry are
required; the flag is not an auth bypass. The regular portal preview does not
silently enable this switch.

Routes (same-origin `/api` prefix):

- `GET /v1/staging/training-records`
- `POST /v1/staging/training-records`
- `GET /v1/staging/training-records/{id}`
- `PUT /v1/staging/training-records/{id}`
- `POST /v1/staging/training-records/{id}/acknowledgement`

Only explicitly marked `synthetic: true` narrative records are accepted.
This flag labels the data; it cannot prove a user has not typed real information.
Use fictional information only. List responses are bounded to 100 records.

Creates/updates use per-actor idempotency receipts; reusing an operation ID with
a different payload returns 409. Updates require `base_version`, retain prior
content versions and clear outdated acknowledgements. Acknowledgement is not a
certified electronic signature. Mutations, versions, HMAC audit events and
receipts commit in one transaction; audit failures roll back the whole operation.
Read/list audits must commit before records are returned.

## Isolated test administrator

A test administrator exercises administrative workflows against **synthetic
records only**. It is a separate synthetic directory role (`TEST_ADMIN`), not an
agency role, and it grants nothing on the agency packet, review, profile or
assignment APIs, which continue to require verified agency claims.

Test authority is granted only when **all** of these hold on the server:

1. Non-production process, a development build, `SYNTHETIC_STAGING_ENABLED=true`
   and the separate switch `PORTAL_TEST_ADMIN_ENABLED=true`.
2. A Clerk-verified active session with a second factor verified in the last
   15 minutes.
3. The session does **not** carry the agency-verified claim. Agency accounts
   cannot be test administrators, and the database refuses a test-administrator
   entry marked agency-verified.
4. An active `TEST_ADMIN` directory entry, provisioned by a developer.

Browser input, headers, query strings, request bodies, the role preview, the
mock-login token and agency role claims cannot grant it. Agency claims that name
a test role are rejected outright. The API refuses to start in production when
`PORTAL_TEST_ADMIN_ENABLED` is present with any value, and the agency-release
build removes the staging router entirely.

Setup (development environment only; no credentials are stored in source):

1. Create or invite the test account through the normal Clerk dashboard process
   and enroll a second factor. Use a dedicated test account, never an agency one.
2. Apply the reviewed schema: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/staging-schema.sql`.
3. Grant: `pnpm run staging:test-admin -- grant <clerk-user-id>`.
   The command refuses production, requires `CLERK_SECRET_KEY`,
   `AUDIT_ID_HMAC_KEY` and `DATABASE_URL` from environment secrets, confirms the
   account exists with a second factor, and never converts an existing agency
   directory entry.
4. Set `SYNTHETIC_STAGING_ENABLED=true` and `PORTAL_TEST_ADMIN_ENABLED=true` as
   development-only environment variables and restart the API.
5. Revoke when finished: `pnpm run staging:test-admin -- revoke <clerk-user-id>`,
   and remove `PORTAL_TEST_ADMIN_ENABLED`.

Test-administrator actions are written to the synthetic audit table with role
`TEST_ADMIN`; they are not presented to the agency audit stream as an agency
principal.

## Production and handover boundary

`pnpm run bundle:production` builds with `--agency-release`. The compiler removes
the staged router, repository, session adapter and database dependency graph from
the executable. The bundler rejects known staging markers if they remain.
Production also rejects staging even in a developer build. The test schema and
fixtures are not packaged and no database data is copied to the ZIP.

The entire source is intended for Columbus IT review; there is no private
developer backdoor. Agency identity provisioning, production storage approval,
least-privilege database grants, audit retention, full portal-record contracts,
sync/import review and actual multi-account browser validation remain release
requirements. The synthetic audit repository exposes inserts only, but a
database owner can modify it: it is **not immutable forensic retention**.
