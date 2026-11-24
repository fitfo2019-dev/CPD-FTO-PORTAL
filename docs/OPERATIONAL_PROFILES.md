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
