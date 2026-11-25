# Operational cruiser profiles

This feature extends invitation-only, verified agency accounts. It does not add
registration, roles, badge edits, training assignments, geographic inference or
access rights. `9150E`, `9150E-1` and `9150E-2` derive district token `9150`,
raw CAD shift letter `E` (the compatibility field is named `company`), and
their exact full CAD unit, including side when present. Missing side stays absent.
CAD district digits are not a physical vehicle fleet number and never populate
the editable Cruiser field. The selected training shift/company and patrol
geography are independent; there is no automatic company-to-shift mapping.
Tokens are exact, case-sensitive, four digits and an uppercase letter with
optional `-1`/`-2`. Legacy roster tokens retain their unhyphenated suffix grammar.
Every sided roster assignment also offers its unsided counterpart. Universal
`80C`, `80C-1`, and `80C-2` always require explicit mapped district context,
including in Precinct 8; they never infer district `80`.

## Agency installation

The DBA must apply `migrations/operational-profiles.sql`, then
`migrations/operational-profile-optional-sides.sql`, to the same agency
database as the packet service and review its narrow runtime grants. Existing
installations apply only the second migration. Grant INSERT and column-only
UPDATE on `district_token` in addition to the existing profile grants; do not
widen roster authority. The upgrade preserves legacy `cruiser_number` values
for audit only, makes missing side NULL, and changes each existing profile's
version to invalidate in-flight side-stripped lookups. New saves do not write
that legacy cruiser column. No historical packet JSON is migrated.
These are single-application migrations; no production migration is run
by the application or this change. `AGENCY_DATABASE_URL` and
`AGENCY_PACKET_SYNC_ENABLED=true` select the existing agency storage boundary.
Without that configuration profile requests return 503, not synthetic data.
The separate legacy database schema is not the operational agency database.

### Least-privilege runtime grants

After both profile migrations, the DBA applies the following to the existing
non-owner runtime role (replace `agency_runtime` with its approved role name).
The revocations narrow any former table-wide INSERT/UPDATE and legacy
`cruiser_number` write grants; they do not change stored evidence. Existing
packet-service grants on other tables remain separate. The runtime must not
inherit broader privileges or own this schema, its tables, or its owner role.

<!-- profile-runtime-grants -->
```sql
GRANT USAGE ON SCHEMA agency_training TO agency_runtime;
GRANT SELECT ON agency_training.operational_profiles TO agency_runtime;
REVOKE INSERT, UPDATE ON agency_training.operational_profiles FROM agency_runtime;
REVOKE UPDATE (assignment_token,cruiser_number,cad_unit,company,side,version,updated_at)
  ON agency_training.operational_profiles FROM agency_runtime;
GRANT INSERT (subject_hash,assignment_token,district_token,cad_unit,company,side)
  ON agency_training.operational_profiles TO agency_runtime;
GRANT UPDATE (assignment_token,district_token,cad_unit,company,side,version,updated_at)
  ON agency_training.operational_profiles TO agency_runtime;
```

Do not grant profile DELETE/TRUNCATE, subject-hash UPDATE, or writes to trusted
`assignments` or `coordinator_directory` authority. The old table-wide INSERT
grant automatically includes future columns, but old column-only UPDATE grants
do not. Missing UPDATE on `district_token` makes an existing-profile save fail
with PostgreSQL `42501` (insufficient privilege), leaving all columns unchanged.
With column-only INSERT, omitting `district_token` also rejects creation without
leaving a row. Never treat either failure as a successful or partial save.

### Disposable PostgreSQL verification

From the workspace root, with PostgreSQL `initdb` and `pg_ctl` on PATH, run:

```sh
pnpm --filter @workspace/scripts exec tsx --test ../artifacts/api-server/tests/operational-profile-postgres.test.ts
```

The test initializes its own temporary cluster and private Unix socket, disables
TCP listening, and never reads database connection environment settings. It
applies `agency-training.sql`, `agency-training-packet-review.sql`,
`agency-training-packet-guards.sql`, `operational-profiles.sql`, and
`operational-profile-optional-sides.sql` in that order, with fictional legacy
profile evidence inserted before the optional-side migration. It uses the exact
grants above with a non-owner login to check sided/unsided creation, competing
creation and compare-and-swap updates, stale versions, preserved legacy cruiser
evidence, denied authority changes, and explicit atomic failure when a new
column grant is missing. It verifies effective permissions after a denied
self-grant attempt, including PostgreSQL's warning-only behavior.

Missing PostgreSQL binaries fail the test rather than silently skipping it.
Pools are closed and the temporary server is stopped and removed on completion.
This proves the disposable PostgreSQL boundary only; it does not certify agency
hosting, production grants, roster provisioning, network access or live records.

Trusted invitation provisioning may seed a profile after the Clerk subject is
known, using `parseOperationalIdentity` from the shared operational-profile
contract and the existing HMAC subject hash. Never seed from unsigned claims,
email matching or browser roster imports. Optional roster columns `FTO
Operational Assignment` and `PO Operational Assignment` are validated provisioning
hints only; they do not modify accounts automatically.

Authenticated FTOs/POs read and update only
`/api/v1/account/operational-profile`. A PUT accepts only `assignmentToken` and
`expectedVersion` (zero for creation). Conflicts return 409; refresh before
retrying. Token and derivations commit in one compare-and-swap SQL statement.
No role, badge, subject, roster or authority columns are writable.

## Packet and dispatch behavior

Only a verified FTO whose badge matches the active folder supplies new-packet
defaults. A prior manually entered physical Cruiser number remains the next
packet's default; without one the field stays blank, never inferred from CAD.
The physical Cruiser field remains editable. Each newly created packet
keeps its full derived identity snapshot; saved records, vault restorations and
manual corrections are never rewritten by profile refresh. A PO profile cannot
supply FTO context. When the agency profile is unavailable, manual entry remains.

The session cache is subject-scoped and refreshed on focus, reconnect and every
30 seconds. Account changes remount the authenticated workspace. Lookup requests
and candidate selections are invalidated when the profile context changes without
clearing manually edited run information. New incident lookups default to the
active CAD unit, not the Cruiser field. The server preserves the dispatch
allowlist and additionally checks verified FTO identity and current agency
profile before and after adapter I/O. A different unit is rejected. Event ingress
requires an exact matching CAD unit in the approved adapter response; unitless
events are not guessed. Missing, malformed, duplicate/ambiguous, or conflicting
unit aliases never establish a new profile. The existing approved adapter
derives `cadIdentity` from its returned full unit. Only an exact current
subject/version/unit match may confirm these tokens in the existing session
cache. It cannot change the selected assignment, training company or Cruiser.
Incident geography is stored separately from these operational district tokens.
The event hook consumes session CAD identity but this
change does not invent a polling service or claim an adapter is configured.

The existing draft sync/finalization lifecycle is unchanged: sync produces
`local_draft_pending`; only explicit authorized FTO finalization exposes a packet
to Coordinator review.

## UI approval boundary

`CruiserIdentityPreview` in the mockup sandbox is fictional and memory-only.
It is not imported by the portal. The user explicitly approved integration of
the Account Settings addition. The portal now exposes a small operational
identity panel through Account Settings for FTOs and POs using existing styles.
The user also explicitly approved the isolated `OptionalSidePreview` before
integrating the optional-side choices, validation and fleet-number distinction.
Signed role and badge are read-only; only the assignment token is editable.
The existing vault controls, sign-in, daily forms, headers and presentation
remain unchanged. Saves use the authenticated compare-and-swap endpoint and
refresh the subject-scoped cache; other open tabs are notified to refresh.
Conflicts and unconfirmed saves require reloading the saved assignment before
retrying; no offline profile save is claimed. This code integration is not a
claim that the live agency database or dispatch adapter has been activated.
