---
name: Developer-only synthetic staging
description: User-approved staging and separation from the agency IT handover.
---

Synthetic staging is authorized for fictional records only. Preserve existing
device-local encrypted drafts; never automatically upload or migrate them.
Require a separate developer password in addition to authenticated, server-scoped
agency identity. The password must be supplied through Secrets, never chat.
Keep staging-only routes, fixtures and credentials separate from what goes to IT.

**Why:** The user explicitly authorized isolated synthetic staging and requested
a developer password, with staging kept separate from the IT delivery.

**How to apply:** Do not treat staging approval as production approval. Verify
the IT build excludes staging-only behavior and never copy secret values into
source, snapshots, logs or documentation.
