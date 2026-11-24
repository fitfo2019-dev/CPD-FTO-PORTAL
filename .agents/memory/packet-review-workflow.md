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

All PO content-read paths must enforce the same explicit release, non-withdrawal
and exact-version boundary, including submission detail and its history—not just
the canonical packet reader. Internal correction history remains staff-only.

**Why:** A second read surface can bypass an otherwise correct release boundary;
sharing a packet ID does not authorize every historical snapshot.

**Why:** The approved workflow must preserve real authored records while
distinguishing receipt, correction and approval.

**How to apply:** Never silently overwrite a newer local correction or route to
a typed recipient. Do not seed fictional staff/packets to make an unconfigured
agency service look operational.
