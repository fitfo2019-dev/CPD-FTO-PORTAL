---
name: Assignment transition authorization
description: Security and packet-preservation rules for official PO assignment changes.
---

Serialize official assignment changes on the PO and revalidate the Coordinator's
current server-held scope after acquiring the lock, including before returning
an existing idempotency result. Create successors only from trusted roster data,
keep the audit immutable, and leave packet assignment links and statuses alone.

**Why:** A retry can arrive after a Coordinator loses scope, and concurrent
changes can otherwise create duplicate or conflicting successors. Assignment
management must not become a shortcut for submitting or moving training records.

**How to apply:** Use the same per-PO transaction lock for every official
assignment transition. Treat browser-imported roster data as device-only, keep
packet sync and finalization independently authorized against each packet's
original assignment and work date, and never let an assignment change imply
phase approval.
