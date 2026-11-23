---
name: Synthetic staging and complete agency handover
description: Staging authorization, recovery-copy scope, and no private developer gate.
---

Synthetic staging is authorized for fictional records only. Preserve existing
device-local encrypted drafts; never automatically upload or migrate them.
Use normal verified sign-in and server-managed agency scopes, not a separate
developer password or hidden developer access. The entire website and source
will be handed over to Columbus. Keep synthetic staging disabled in production.
Configuration snapshots are source-recovery copies, not a full-site or database
backup; never copy secret values or training records into them.

**Why:** The user authorized synthetic staging, then clarified that they had
mistaken the password gate for rollback-copy protection. They withdrew the extra
password requirement and stated the whole website will go to Columbus.

**How to apply:** Do not treat staging approval as production approval. Never add
private developer access to the agency system, describe snapshots accurately,
and never copy secret values into source, snapshots, logs or documentation.

Approval previews must be reachable without portal sign-in. Keep them separate
from authenticated training screens and preserve the synthetic-data-only boundary.

**Why:** The user reported that sign-in covered an approval preview and asked to
fix it permanently. Root-scoped offline navigation can also replace a sibling
artifact's page with the portal shell, even when server routing is correct.

**How to apply:** Give explicit preview links and an auth-free entry point.
Restrict offline shell navigation to portal-owned routes; exclude approval
previews and other artifacts. Never solve preview access by opening real records.
