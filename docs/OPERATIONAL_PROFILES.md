# Operational cruiser profiles

This feature extends invitation-only, verified agency accounts. It does not add
registration, roles, badge edits, training assignments, geographic inference or
access rights. `9150E-1` and `9150E-2` each derive physical cruiser `9150`, CAD unit
`9150E`, company `E`, and a separate side. Tokens are exact, case-sensitive,
four-digit vehicle identifiers with an uppercase company letter and side 1/2.
Legacy roster and universal assignment grammars remain independent.

## Agency installation

The DBA must apply `migrations/operational-profiles.sql` to the same agency
database as the packet service and review its narrow runtime grants. This is
an additive, single-application migration; no production migration is run
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
defaults. The physical Cruiser field remains editable. Each newly created packet
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
events are not guessed. The event hook consumes session CAD identity but this
change does not invent a polling service or claim an adapter is configured.

The existing draft sync/finalization lifecycle is unchanged: sync produces
`local_draft_pending`; only explicit authorized FTO finalization exposes a packet
to Coordinator review.

## UI approval boundary

`CruiserIdentityPreview` in the mockup sandbox is fictional and memory-only.
It is not imported by the portal. The user explicitly approved integration of
the Account Settings addition. The portal now exposes a small operational
identity panel through Account Settings for FTOs and POs using existing styles.
Signed role and badge are read-only; only the assignment token is editable.
The existing vault controls, sign-in, daily forms, headers and presentation
remain unchanged. Saves use the authenticated compare-and-swap endpoint and
refresh the subject-scoped cache; other open tabs are notified to refresh.
Conflicts and unconfirmed saves require reloading the saved assignment before
retrying; no offline profile save is claimed. This code integration is not a
claim that the live agency database or dispatch adapter has been activated.
