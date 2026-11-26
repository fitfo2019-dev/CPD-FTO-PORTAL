# Agency packet review, release, and PO review

## Approval preview access

In development, `/approval-preview` opens the isolated fictional packet handoff
preview outside the portal's sign-in provider. `/__mockup` lists available
approval previews and `/__mockup/preview/PacketHandoffFlowPreview` opens the
role-scoped handoff example directly in a browser. The preview uses local
synthetic data only and provides no access to training records or local vaults.

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

- FTOs upload only their assigned packets, with matching identity and badge.
  FTO packet reads include submitted records in classes where their active roster
  assignment grants access; local draft reads remain limited to that FTO's own
  assignments.
- Coordinators receive a submitted packet only after its assigned PO has
  reviewed the allowed totals. Coordinators read/release/withdraw packets only
  in classes where they are listed on an active agency roster assignment.
- FTO COC, POLICENET, and POLICENET Admin — SGT receive read-only access only
  for classes with an active trusted `staff_class_read_grants` entry. These
  roles cannot submit, review, release, correct, withdraw, or acknowledge
  packets. Coordinator inbox visibility still waits for the PO review gate.
- POs review only their own unacceptable-rating details plus daily, weekly, and
  monthly activity, rating-count, and run-checklist-count summaries before
  Coordinator routing. After release, the same own-record view remains
  available. Other rating details, narrative, run details, FTO names, and the
  complete report are never returned to PO routes.
  Out-of-scope packet IDs return 404 without disclosing whether they exist.

## Review and retry contract

The packet handoff has one server-derived status across the packet-review
inbox/detail/context responses and the agency packet list/detail responses:

| `handoff_status` | Meaning |
| --- | --- |
| `draft` | Editable server draft; not submitted for Coordinator review. |
| `awaiting_po_totals_review` | FTO finalized the packet; the PO must review daily, weekly, and monthly totals before Coordinator routing. |
| `awaiting_coordinator_receipt` | PO review of own UA details and period counts is recorded; Coordinator receipt acknowledgment is required. |
| `coordinator_review` | Receipt acknowledged; Coordinator review is in progress. |
| `awaiting_po_release` | Coordinator approval is complete, but the packet is not PO-visible. |
| `awaiting_po_acknowledgment` | Coordinator released the approved snapshot; the PO can read it. |
| `po_acknowledged` | The PO acknowledged receipt of the released snapshot. |
| `correction_requested` | Coordinator returned the packet with a reason; a corrected version needs fresh review. |
| `withdrawn` | Packet permanently closed and hidden from PO reads. |

The submission's `state` still describes Coordinator receipt/review. In
particular, `approved` (shown to FTOs as **COMPLETE**) means only that
Coordinator approval is finished. It does **not** make the packet visible to
the PO. The Coordinator must separately call the release action; only then does
the PO's own UA details and period-summary view become available. `released_at` and
`po_acknowledged_at` accompany `handoff_status` in
packet-review responses. Agency packet responses expose the same
`handoff_status` alongside `released_to_po` and the acknowledgment record.

The server records PO review using
`POST /api/v1/packet-review/submissions/{id}` with action `review_totals`.
This is a review gate, not PO approval. Until it is recorded, the submission is
absent from the Coordinator inbox and Coordinator packet reads return no record.
PO submission details return `report: null` and `po_totals` containing daily,
Sunday–Saturday weekly, and calendar-month activity, rating-code, and
reviewed-run-checklist counts, plus that PO's reviewed UA category and
justification details. Narrative, run details, non-UA category justifications,
and other POs' records are excluded. The same boundary applies to PO packet
reads and acknowledgment responses after release.

`POST /api/v1/training-packets/{id}/release` requires a fresh operation UUID,
the snapshot's server-returned `content_hash`, and `review_confirmed: true`.
Only a Coordinator in that class may release a PO-reviewed and Coordinator-
approved snapshot.

`POST /api/v1/training-packets/{id}/acknowledge` requires the same fields and
optionally `comments` (at most 4,000 characters). Only the assigned PO may
acknowledge a released packet. The server records the actor, snapshot digest and
time. This means receipt of the own-UA-and-period-summary view: **not agreement or an electronic
signature**. It does not replace the separate weekly signature workflow.
The weekly signature workflow is independent of packet release and PO receipt
acknowledgment.

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
  `artifacts/api-server/migrations/agency-training-packet-review.sql` and
  `artifacts/api-server/migrations/agency-training-po-totals-review-upgrade.sql`,
  then `artifacts/api-server/migrations/agency-training-staff-class-access.sql`
  once, in that order, then restart with this application version. Do not apply
  the existing-installation migrations to a fresh DB.

For a fresh database, apply `agency-training-packet-review.sql` after the base
schema as usual, then apply the PO totals review upgrade and staff class access
migration. Existing records are not marked PO-reviewed by the upgrade; each
needs explicit PO review before Coordinator routing.

Trusted agency roster provisioning must add class grants for FTO COC and
POLICENET roles using HMACed verified account IDs and the role claim value.
There is no browser or packet API for creating these grants. Existing FTO and
Coordinator class access continues to come from active roster assignments.

The upgrade deliberately resets any earlier release flags: no trusted release
mechanism existed for them, so a coordinator must review those snapshots.
Original packets and their content are not deleted or changed.

Use a non-owner runtime role with schema usage, SELECT on assignments,
SELECT on `staff_class_read_grants`,
SELECT/INSERT on packets and packet_assignments, SELECT/INSERT on
packet_acknowledgments and packet_events, and USAGE on the event identity
sequence. Grant **column-specific UPDATE only** on
`packets(released_to_po, released_at, released_by_hash, withdrawn_at,
withdrawn_by_hash, withdrawal_reason)` and
`packet_submissions(po_reviewed_at)`.

Do not grant table-wide UPDATE, DELETE, TRUNCATE or ownership. Backups,
encryption at rest, retention and independent immutable audit retention remain
agency infrastructure responsibilities.

## Verification

`pnpm --filter @workspace/scripts exec tsx --test ../artifacts/api-server/tests/agency-packets.test.ts ../artifacts/api-server/tests/packet-review.test.ts ../artifacts/api-server/tests/packet-po-totals.test.ts ../artifacts/api-server/test/packet-migrations.test.ts`

The review suite requires PostgreSQL tools (`initdb`, `pg_ctl`) on PATH. It
creates and removes an isolated temporary database with synthetic records; it
does not connect to the project or agency database.
