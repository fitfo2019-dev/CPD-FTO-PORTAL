# Assignment integration and draft-submission handover

## Assignment data

Zone, precinct, shift/company, cruiser district, and FTO call-sign remain separate
fields. The existing Columbus geography is retained, including Zone 3 / Precinct
15 / C-Co / Cruiser District 153. The exact tactical call-signs `80C-1` and `80C-2`
are accepted for C-Company only when the official cruiser district is recorded
separately. The call-sign does not imply Precinct 8 and cannot override geography.
This adds support for the requested identifiers, not independent certification
of the underlying official source documents.

CSV, Excel `.xlsx`, and Word `.docx` table imports share validation. Tactical rows
must explicitly supply Cruiser District; ordinary assignment codes can still
resolve their mapped district. Incomplete identity-only roster rows remain
supported. Invalid tactical metadata stops restore before the saved workspace
is replaced. Existing print layouts and workbook column structures are unchanged.

## Draft sync and final submission

`POST /api/v1/training-packets/sync` now saves an editable `local_draft_pending`
copy. Draft uploads never enter PO or Coordinator packet reads. An unchanged
acknowledged draft is not requeued merely because another local record is saved;
editing the draft creates a new operation based on its acknowledged version.

`POST /api/v1/training-packets/{id}/finalize` is a separate authenticated FTO
operation with an operation UUID and acknowledged base version. It requires a
saved, explicitly reviewed duty sheet, daily evaluation (except Limbo days),
and completed/reviewed run forms. It rechecks the active server-managed
FTO/badge, PO, date, class and phase, then resolves the PO's current shared,
active Coordinator assignment. Draft synchronization never calls it.

The approved, separate **FINALIZE AND SUBMIT TO COORDINATOR** control is now
integrated with an explicit confirmation. It does not replace local draft save
or draft sync. Submission seals the local packet only after a server receipt.
The `/packet-submissions` page uses verified server roles, never the local role
selector, for the shared inbox, status, assignment and review controls.
Read-only packet access is class-scoped: FTOs and Coordinators use their active
server roster assignments; FTO COC, POLICENET and POLICENET Admin — SGT require
an active trusted staff-class grant. The latter roles receive no workflow
actions. PO packet views remain restricted to their own UA details and period
counts.

## Receipt, review, corrections and reassignment

The real Coordinator directory is provisioned by the agency using verified
account IDs. No staff records or sample packets are seeded by these migrations.
Invitation-only registration remains intact: a verified PO chooses a Coordinator
during first-use account setup. A Coordinator can create or edit the assignment
for a PO already within their trusted roster scope.

Finalization atomically creates one immutable submitted-version snapshot and
routes it to the assigned PO for review of their own UA details plus daily,
weekly, and monthly counts. The Coordinator inbox
does not receive the snapshot until that review is recorded. Afterward, a red,
nondismissible popup blocks the Coordinator's workspace until
**ACKNOWLEDGE PACKET** succeeds on the server; sign-out remains possible.
Context polls every five seconds and on focus. Server checks also block direct
API bypasses while receipts remain. If storage is unavailable, the verified
Coordinator sees an unavailable gate, not a false empty inbox.

Receipt and approval are distinct. The FTO sees **SUBMITTED**, then the exact
label **PACKET ACKNOWLEDGE** after the PO review, and **COMPLETE** only after
Coordinator review and approval. The PO can see only their own unacceptable
rating details plus daily, weekly, and monthly activity, rating-count, and
reviewed-run-checklist totals before routing and after release. The PO never
receives full narrative, run details, other category justifications, or another
PO's records. Coordinator approval requires opening that submitted version and
acknowledging all pending receipts. Correction requests require a written reason, preserve
the earlier snapshot/history, and reopen only that packet as a versioned draft.
The FTO explicitly opens the correction; an unrelated or newer local draft is
never silently overwritten. Resubmission requires a new draft version and fresh
acknowledgment.

**The PO review must happen before Coordinator routing.** It is a review gate,
not PO approval. **COMPLETE means Coordinator review is complete; it does
not replace the separate release action.** After approval, a Coordinator
explicitly releases the snapshot; the PO then sees their UA details and period
counts and may acknowledge receipt. The sequence is:

1. `awaiting_po_totals_review` — the assigned PO reviews their UA details and
   daily, weekly, and monthly counts; the Coordinator cannot see the packet yet.
2. `awaiting_coordinator_receipt` — the PO review is recorded and the packet
   enters the assigned Coordinator's inbox.
3. `coordinator_review` — Coordinator receipt is acknowledged; review follows.
4. `awaiting_po_release` — Coordinator approval is complete, but the released
   PO view is not yet available.
5. `awaiting_po_acknowledgment` — the Coordinator released the exact approved
   snapshot; the PO can see their own UA details and period counts.
6. `po_acknowledged` — the PO acknowledged receipt of this own-record view.
   This is not agreement or an electronic signature.

Corrections use `correction_requested`, return to a new submitted version, and
require fresh PO UA/period review, Coordinator receipt acknowledgment, and
approval. A permanently
withdrawn packet uses `withdrawn`. Drafts use `draft`. Both packet-review
responses and agency packet-read responses expose this server-derived
`handoff_status`, so the portal can distinguish an approved-but-unreleased
packet from one visible to the PO. Review, release, and PO acknowledgment
remain separate authenticated actions.

Coordinator reassignment uses revision checks and explicit UI confirmation.
Pending work transfers and requires fresh acknowledgment; earlier approved
snapshots remain unchanged. The former Coordinator loses scope immediately.
Review actions and finalization use operation IDs to reject conflicting retries.
Query caches are scoped to the signed-in account.

PO receipt acknowledgment remains separate from the weekly signature workflow.
It records receipt of the reviewed packet snapshot only.

**Activation is not complete:** no live agency migration, identity provisioning,
or production deployment was performed. Real shared delivery requires the
agency-controlled configuration and roster data below. A fresh session without
network access cannot establish an agency role; the server still denies
operational access, and the UI does not claim notifications were checked.

## Agency database installation

- New installation: use `migrations/agency-training.sql`.
- Existing installation: use `migrations/agency-training-draft-finalization.sql`
  once, as the agency database owner/admin, before starting this server version.
- Both installations: apply `migrations/agency-training-packet-review.sql`, then
  `migrations/agency-training-po-totals-review-upgrade.sql`, then
  `migrations/agency-training-staff-class-access.sql`, once each as the agency
  database owner/admin. Back up the existing agency database according to
  agency policy first; no migration runs automatically at startup.
- Then apply `migrations/agency-training-assignment-transitions.sql` once, as
  the agency database owner/admin. The Coordinator-only operation creates a
  successor from the trusted active roster, shortens the old assignment's date
  range when it overlaps, and records immutable before/after snapshots. It does
  not update packet rows or mark a PO as having passed a phase.
- Then apply `migrations/agency-training-alerts.sql` once, as the agency
  database owner/admin. It adds training alerts (NRT on finalize, FTO NRT
  review requests, Phase IV Not release), the recipient list and the
  notice-only email queue. Until it is applied, finalization still succeeds
  and the alert routes answer `ALERTS_NOT_INSTALLED`. Runtime grants:
  - `training_alerts`: SELECT/INSERT and column-only UPDATE(`week15_choice`,
    `week15_changed_at`,`summary`,`report_ids`,`state`,`closed_by_hash`,
    `closed_by_name`,`closed_by_role`,`closed_at`,`close_note`);
  - `alert_recipients`: SELECT/INSERT and column-only UPDATE(`role`,`email`,
    `active`,`updated_at`);
  - `alert_email_outbox`: SELECT/INSERT and column-only UPDATE(`status`,
    `attempts`,`last_error_code`,`sent_at`);
  - `training_alert_events`: SELECT/INSERT only; `po_coordinators` SELECT.
  Never grant DELETE or TRUNCATE on any alert table.
- Alert recipients are the PO's assigned FTO Coordinator and every account
  whose verified agency role is `FTO_SGT`. A Coordinator or Sergeant is added
  to the email list with the Clerk-verified primary sign-in email the first
  time they open alerts; an account that has never opened alerts receives no
  email notice until it does; its portal alerts are waiting when it signs in.
  Emails are queued with notice-only text and no names; no message leaves the server until the department mail relay is
  configured and a sender is approved.
  `ALERT_EMAIL_MODE=test` starts a test sender that renders each queued
  notice into the server log once a minute (outbox number, notice type, a
  hash of the recipient, subject and text; never the address) and never
  contacts a mail server. It marks the row `last_error_code=TEST_MODE_NOT_SENT`
  and leaves it `queued` with no attempt counted, so the relay sender still
  delivers it later. `ALERT_EMAIL_PORTAL_URL` (https only) adds a sign-in
  link. Any other value, or no value, keeps alert email off.
- The upgrade preserves previously sealed packets as submitted; new uploads
  default to editable drafts. It permits increasing draft versions.
- Keep a separate non-owner runtime role. It needs packet SELECT/INSERT/UPDATE,
  assignment/directory SELECT, `staff_class_read_grants` SELECT, packet-event
  INSERT and sequence USAGE. For the new tables grant:
  - `po_coordinators`: SELECT/INSERT and column-only
    UPDATE(`coordinator_id`,`revision`,`updated_at`);
  - `packet_submissions`: SELECT/INSERT and column-only UPDATE(`coordinator_id`,
    `state`,`po_reviewed_at`,`acknowledged_at`,`reviewed_at`,`review_note`);
  - `packet_review_events`, `packet_review_operations`: SELECT/INSERT only.
  Trusted provisioning, not the runtime API, creates staff class read grants.
  - `assignment_transitions`: SELECT only; never grant direct INSERT, UPDATE,
    DELETE, or TRUNCATE.
  - Read-only assignment context columns and `po_coordinators`: use the
    column-level SELECT grants documented at the end of
    `migrations/agency-training-assignment-transitions.sql`.
  - EXECUTE on `agency_training.create_successor_assignment(...)`; do not grant
    the API runtime direct assignment writes. The function takes the shared
    per-PO transaction lock, rechecks Coordinator scope and FTO roster identity,
    rejects overlapping dates, and appends the audit record atomically.
  - EXECUTE on `agency_training.lock_packet_assignment(text,text,text)` and
    `agency_training.lock_active_packet_coordinator(text)`.
- Keep those two narrow locking functions owned by the agency migration owner,
  not the runtime. They have a fixed search path and no dynamic SQL. PostgreSQL
  requires UPDATE privilege even for row-locking SELECT; these functions avoid
  broadening the runtime's roster/directory privileges just to acquire locks.
  Never grant runtime assignment/directory UPDATE, submitted-report UPDATE,
  event/operation UPDATE, schema CREATE, table ownership, deletes or truncation.
- Agency identity mapping, server-managed rosters, agency storage, and the
  existing explicit sync gate must be configured. Preview data remains local.
- A successor assignment does not release or transfer an unsubmitted packet.
  Late work remains linked to its original assignment and may be synced or
  explicitly finalized only for dates inside that assignment's retained
  historical range. Device-only roster imports remain local and do not affect
  the official server roster.
- Secure settings required: `AGENCY_DATABASE_URL`, `AGENCY_PACKET_SYNC_ENABLED`,
  `AGENCY_VERIFIED_CLAIM_PATH`, `AGENCY_ROLE_CLAIM_PATH`,
  `AGENCY_BADGE_CLAIM_PATH`, and the existing audit identifier HMAC secret.
  Claim paths must match agency-managed, signed Clerk claims. Never use a
  user-editable/local preview role as proof of agency authorization.
- Provision actual active Coordinator accounts into `coordinator_directory`;
  maintain the existing per-packet trusted `packet_assignments` roster. Those
  authorizations are not created from client-supplied packet identities.
- SQL lifecycle tests use a real PostgreSQL engine in isolated, in-memory
  PGlite, including restricted runtime grants, while earlier branch tests use
  a scripted pool. No fixture data is added to the application or agency DB.
  These checks are not a live agency database or multi-account browser test.

## Recovery copies and packaging

`pnpm run build:api` automatically runs the source-configuration snapshot hook
before building backend output, including when invoked by `bundle:production`.
The snapshot test checks the required files and SHA-256 manifest. Source
snapshots are not database or full-site backups and contain no secret files.

`pnpm run bundle:production` produces the existing standalone API distribution,
including its migrations and this note. It is not a full website/source archive.
The portal is built separately with
`pnpm --filter @workspace/field-training run build`. Neither command deploys.
