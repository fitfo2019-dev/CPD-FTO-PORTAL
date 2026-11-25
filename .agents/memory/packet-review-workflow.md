---
name: Coordinator packet review workflow
description: User-required routing, acknowledgment gate, and approval status sequence for real packet submissions.
---

The PO selects an assigned Coordinator when signing up, or an FTO Coordinator
adds the assignment. The Coordinator assignment must be editable.
Submitted packets route automatically to that Coordinator's packet submission
inbox for review and approval.

The receiving Coordinator sees a red popup advising of the submission and must
click **ACKNOWLEDGE PACKET** before continuing to use the site. The FTO then sees
the exact status **PACKET ACKNOWLEDGE**. The status becomes **COMPLETE** only
after an FTO Coordinator has reviewed and approved the packet.

**Why:** The user explicitly defined this real operational workflow and
authorized adding supporting behavior needed to make it work.

**How to apply:** Keep receipt acknowledgment distinct from review approval.
Use the shared server-managed assignment and verified identity to route each
submission, not a local role switch, typed recipient, or client-only status.
Never describe a data-free UI preview as the implemented operational workflow.

The user approved the supporting correction/reassignment safeguards: a written
correction reason, preserved prior submissions, explicit resubmission with fresh
acknowledgment, and transfer of open work when the assigned Coordinator changes.
Draft sync must remain separate from final submission.

Keep the canonical hashed agency roster separate from per-packet assignment
links. Reconciled review workflows require separately verified account metadata;
never reconstruct identities from packet contents or reverse identity hashes.
The trusted agency provisioning process must supply that metadata.

Preserve legacy release, permanent withdrawal, PO acknowledgment and uncertain
upload protections when extending review states. Mutable current drafts and
immutable submitted history are different records; a correction must never
rewrite the prior submitted snapshot.

Before Coordinator routing, PO reads expose only `report: null`, their own
reviewed unacceptable-rating details, and daily, Sunday–Saturday weekly, and
calendar-month activity, rating, and run-checklist counts. Coordinator visibility
starts only after the PO records that review. After explicit release, the PO keeps
the same own-record summary boundary; never expose full reports, narratives, run
details, non-UA justifications, other POs, or internal correction history to PO
routes.

Other non-PO packet reads require a trusted active class assignment or class-read
grant and remain read-only unless that role has a specific workflow action.
Coordinator receipt, approval, release, and PO receipt acknowledgment remain
distinct. Weekly signatures are a separate workflow.

**Why:** The approved workflow must preserve real authored records while
distinguishing receipt, correction, approval, and release. A second read surface
can bypass a correct boundary if it trusts a packet ID or client-selected class.

**How to apply:** Never silently overwrite a newer local correction or route to
a typed recipient. Use server-derived scope and totals for every packet view;
do not infer PO authority from a client role or expose a full report as a
convenience fallback. Do not seed fictional staff/packets to make an
unconfigured agency service look operational.

Coordinator handoffs and phase-extension decisions must serialize on the same
per-PO transaction advisory lock. A review must acquire that lock in one
statement, then check the current Coordinator in a later READ COMMITTED
statement; a lock wait does not refresh the snapshot of the statement that
started waiting.

**Why:** Otherwise a review can wait for a handoff to commit and still decide
against the former Coordinator using its earlier statement snapshot.

**How to apply:** Keep handoff and review lock keys identical, and do not combine
the lock wait and the authorization check into one SQL statement.
