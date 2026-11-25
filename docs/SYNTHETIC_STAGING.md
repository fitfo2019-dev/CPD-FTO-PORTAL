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
