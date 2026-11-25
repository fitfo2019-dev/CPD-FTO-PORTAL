# Operational cruiser profiles

This feature extends invitation-only, verified agency accounts. It does not add
registration, roles, badge edits, training assignments, geographic inference or
access rights. `9150E`, `9150E-1` and `9150E-2` derive district token `9150`,
raw CAD shift letter `E` (the compatibility field is named `company`), and
CAD identifier `9150E`. The optional side is division-internal and is never
sent as part of the CAD identifier. Missing internal side stays absent.
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
`migrations/operational-profile-optional-sides.sql`, then
`migrations/operational-profile-history.sql`, then
`migrations/operational-profile-clear.sql`, to the same agency
database as the packet service and review its narrow runtime grants. Existing
installations apply only migrations not already applied. Grant INSERT and column-only
UPDATE on `district_token` in addition to the existing profile grants; do not
widen roster authority. The upgrade preserves legacy `cruiser_number` values
for audit only, makes missing side NULL, and changes each existing profile's
version to invalidate in-flight lookups. The final clear migration sets current
CAD identifiers to the side-free district/shift value. New saves do not write
that legacy cruiser column. No historical packet JSON is migrated.
These are single-application migrations; no production migration is run
by the application or this change. `AGENCY_DATABASE_URL` and
`AGENCY_PACKET_SYNC_ENABLED=true` select the existing agency storage boundary.
Without that configuration profile requests return 503, not synthetic data.
The separate legacy database schema is not the operational agency database.

### Least-privilege runtime grants

After all profile migrations, the DBA applies the following to the existing
non-owner runtime role (replace `agency_runtime` with its approved role name).
The revocations narrow any former table-wide INSERT/UPDATE and legacy
`cruiser_number` write grants; they do not change stored evidence. Existing
packet-service grants on other tables remain separate. The runtime must not
inherit broader privileges or own this schema, its tables, or its owner role.

<!-- profile-runtime-grants -->
```sql
GRANT USAGE ON SCHEMA agency_training TO agency_runtime;
GRANT SELECT ON agency_training.operational_profiles TO agency_runtime;
GRANT SELECT, INSERT ON agency_training.operational_profile_history TO agency_runtime;
REVOKE UPDATE, DELETE, TRUNCATE ON agency_training.operational_profile_history FROM agency_runtime;
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
`operational-profile-optional-sides.sql`, `operational-profile-history.sql`,
then `operational-profile-clear.sql`
in that order, with fictional legacy
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

### Clearing an inactive assignment

`POST /api/v1/account/operational-profile/clear` accepts only `expectedVersion`
and `confirmedNoVehicle: true`. The UI requires an explicit no-vehicle checkbox
and confirmation; Cancel is focused first. Clearing changes only the signed-in
FTO/PO's operational fields to NULL and advances the existing version. It never
deletes a row, account, training assignment or historical packet. Version zero
is reserved for first creation, including an initial empty profile; it cannot
recreate a cleared row. Competing clears/saves using the same version have
exactly one winner. A stale attempt returns 409 and requires an explicit reload.

The clear migration allows only fully empty or valid fully derived profiles.
It also removes internal sides from current CAD values and increments existing
profile versions to invalidate former lookups; historical packet JSON and
legacy cruiser evidence are not rewritten. Existing narrow runtime grants
suffice; do not grant DELETE or TRUNCATE.
Clears append a `cleared` own-account history entry in the same SQL statement.
Missing history storage or INSERT rights roll back the entire clear. Creating
an initial empty profile also records that explicit no-vehicle decision.

## Own-account assignment history

The user approved the isolated `operations/AssignmentHistoryPreview` before
integration. Account Settings now shows its history section beneath the existing
assignment editor, without replacing the editor or changing packet forms.
`GET /api/v1/account/operational-profile/history` authenticates every page and
filters only by the signed-in subject's HMAC hash. It accepts only the optional
integer `beforeVersion` cursor, returns up to 50 entries newest version first,
and supplies `nextBeforeVersion` for older entries. Account/subject selectors
are rejected. Coordinators and other roles cannot use this own-account endpoint.
Responses are `no-store`; histories are not persisted in the local vault.

Successful creation and changed-token saves append old/new tokens, profile
version, the server-verified actor's HMAC hash and the profile's database timestamp
inside the same SQL statement as the compare-and-swap mutation. Competing,
invalid, unauthorized or rolled-back saves create no evidence. An unchanged
token may advance the existing profile version but adds no transition. No raw
credentials, badges, session tokens or raw actor identifiers are stored in this
history. The response labels the actor as the officer's own verified account
without exposing its stored hash.

The history migration adds a clearly identified baseline for existing profiles
at the migration's server time. That baseline records the token observed then;
it does not assert when it originally became active or invent earlier changes.
Packet creation times are device-reported, not a trusted server ordering
guarantee. A packet's frozen operational identity remains its evidence; the
history helps compare assignments without rewriting or inferring packet data.
New-profile creation entries are distinguishable from migration baselines.
The UI shows Columbus local time with its timezone and retains the exact ISO
instant in the time element.

Apply this additive migration and the documented grants in an agency maintenance
window, with profile writes paused until the matching API build is running.
Reconcile any trusted provisioning process so it appends creation evidence in the
same transaction rather than writing profiles without history. Existing source
migrations are not re-run. The migration locks profiles while observing the
baseline. Runtime INSERT/SELECT is required only on the new history table; no
new roster rights, table ownership, sequence rights or history mutation rights
are needed. Triggers additionally reject UPDATE, DELETE and TRUNCATE. A trusted
database owner can still disable triggers, so this is not independent immutable
retention or a claim of tamper-proof storage. The API fails closed if the history
table or its grants are absent; it never reports a partially saved profile.

History reloads after profile-version changes, on focus/reconnect and every
30 seconds. Its query cache includes subject and version; session changes clear
the existing global cache and remount the workspace. Requests are abortable with
a 15-second timeout. Failed or unauthorized refreshes hide stale history and
offer retry without changing the assignment editor's unsaved input.

## Packet and dispatch behavior

Only a verified FTO whose badge matches the active folder supplies new-packet
defaults. A prior manually entered physical Cruiser number remains the next
packet's default; without one the field stays blank, never inferred from CAD.
An explicitly empty profile (or an unavailable profile during reconnect) uses a
blank manual Cruiser entry on newly created packets instead of carrying a
possibly inactive prior value. Existing packets retain every manual correction.
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
The CAD-derived confirmation does not replace the division-internal side.
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
The approved clear-assignment control uses the same ownership boundary.
Writes immediately suspend automatic dispatch context. On success the current
cache receives the server's new version, including NULL identity. Other tabs
suspend their old context before refreshing. An unconfirmed write stays
manual-only until an explicit successful reload; profile writes are never
queued offline.
Conflicts and unconfirmed saves require reloading the saved assignment before
retrying; no offline profile save is claimed. This code integration is not a
claim that the live agency database or dispatch adapter has been activated.
