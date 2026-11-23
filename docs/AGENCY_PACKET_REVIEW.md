# Agency packet release and PO acknowledgment

## Approval preview access

In development, `/approval-preview` opens the isolated fictional packet review
preview outside the portal's sign-in provider. Its preview is served at
`/api/preview?component=PacketReviewPreview`; using the API path also bypasses
the portal's legacy root-scoped offline worker, which may otherwise return its
cached sign-in page for sibling app navigations. `/__mockup` lists available
approval previews and `/__mockup/preview/PacketReviewPreview` opens this one
directly in a browser without that old worker. These routes provide no access to
training records or local vaults.

The portal's offline shell handles only known portal routes, not previews or
sibling applications. The development `/sw.js` retires an older installed portal
worker and removes only `fieldready-shell-*` app-shell caches. The preview also
requests this worker update so a browser opening the preview first can recover.
It does not clear IndexedDB, encrypted records, vault keys, or unrelated caches.
The approval entry route is not registered in production.

## Trust boundary

Uploading commits an immutable snapshot, not a signature or approval. Uploaded
`report.status`, `report.signatures`, names, and client timestamps are retained
as unverified source content; none authorize release or acknowledgment.
Top-level workflow fields come from the agency database.

Every operation requires verified agency role and badge claims. Access also
requires active server-held packet and roster assignments:

- FTOs upload/read only their assigned packets, with matching identity and badge.
- Coordinators read/release/withdraw packets only in classes where they are
  listed as coordinator on an active agency roster assignment. This class scope
  does not grant access to other classes.
- POs read/acknowledge only their own released, non-withdrawn packets, with
  matching identity and badge. Unreleased or out-of-scope IDs return 404 without
  disclosing whether they exist.

## Review and retry contract

`POST /api/v1/training-packets/{id}/release` requires a fresh operation UUID,
the snapshot's server-returned `content_hash`, and `review_confirmed: true`.
Only a coordinator in that class may release it.

`POST /api/v1/training-packets/{id}/acknowledge` requires the same fields and
optionally `comments` (at most 4,000 characters). Only the assigned PO may
acknowledge a released packet. The server records the actor, snapshot digest and
time. This means receipt and review only: **not agreement or an electronic
signature**. It does not replace the separate weekly signature workflow.

Each action and its audit insertion share a transaction. An audit failure rolls
back the action. A packet lock serializes review, withdrawal and acknowledgment.
Retries must preserve the original operation UUID and body. An exact retry does
not duplicate the action or event; reusing that UUID with different contents
conflicts. Refresh state after an uncertain outcome rather than assuming failure.

## Amendment policy

No action overwrites a committed snapshot or edits an acknowledgment.

1. A coordinator permanently withdraws the original using
   `POST /api/v1/training-packets/{id}/withdraw`, with `operation_id`,
   `content_hash`, and a nonblank `reason` (at most 4,000 characters).
   Unreleased snapshots may also be withdrawn for correction.
2. Withdrawal closes that snapshot permanently. It disappears from PO reads;
   its content, previous release, acknowledgment, comments and audit history
   remain available to authorized FTOs and class coordinators.
3. The assigned FTO uploads a **new ID** with `base_version: 0`, a new
   `operation_id`, complete corrected `report`, `amendment_of` (the withdrawn
   packet ID), and nonblank `amendment_reason`. Assignment, record date and phase
   must match the original. Only one immediate replacement is allowed per
   original; further corrections form a chain of withdrawn replacements.
4. The replacement starts unreleased and unacknowledged, regardless of uploaded
   status/signature fields. It requires a new coordinator review and PO review.
   Earlier acknowledgments never carry forward.

The correction editor/upload interface is separate from packet review controls;
local draft saving never initiates upload.

## Installation

An agency DBA applies SQL to the **agency database**, never synthetic staging:

- Fresh installation: `artifacts/api-server/migrations/agency-training.sql`.
- Existing installation: stop the service and apply
  `artifacts/api-server/migrations/agency-training-packet-review.sql` once,
  then restart with this application version. Do not apply both to a fresh DB.

The upgrade deliberately resets any earlier release flags: no trusted release
mechanism existed for them, so a coordinator must review those snapshots.
Original packets and their content are not deleted or changed.

Use a non-owner runtime role with schema usage, SELECT on assignments,
SELECT/INSERT on packets and packet_assignments, SELECT/INSERT on
packet_acknowledgments and packet_events, and USAGE on the event identity
sequence. Grant **column-specific UPDATE only** on
`packets(released_to_po, released_at, released_by_hash, withdrawn_at,
withdrawn_by_hash, withdrawal_reason)`.

Do not grant table-wide UPDATE, DELETE, TRUNCATE or ownership. Backups,
encryption at rest, retention and independent immutable audit retention remain
agency infrastructure responsibilities.

## Verification

`pnpm --filter @workspace/scripts exec tsx --test ../artifacts/api-server/tests/agency-packets.test.ts ../artifacts/api-server/tests/packet-review.test.ts`

The review suite requires PostgreSQL tools (`initdb`, `pg_ctl`) on PATH. It
creates and removes an isolated temporary database with synthetic records; it
does not connect to the project or agency database.
