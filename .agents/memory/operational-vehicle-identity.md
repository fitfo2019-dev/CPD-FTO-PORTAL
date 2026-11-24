---
name: Operational vehicle identity
description: Columbus vehicle-profile semantics and their separation from training assignment and account authority.
---

Treat the user's `9150E-1` / `9150E-2` vehicle-profile examples as operational
identity, not a replacement grammar for legacy training roster assignments or
universal assignments. A vehicle number does not establish a precinct, mapped
patrol district, shift, company-to-training mapping, role, badge or record access.
Side suffixes remain separate from CAD identity.

**Why:** The user requested a newer vehicle-profile notation while explicitly
preserving the portal's existing training assignment meanings. Conflating the
two could silently reinterpret imported rosters and change geographic context.

**How to apply:** Keep account vehicle edits at the invitation-only verified
account boundary, separate from trusted roster provisioning. Snapshot the active
FTO's vehicle context only when creating a packet; PO account changes and later
vehicle changes must not rewrite saved FTO packet context. Preserve manual
Cruiser corrections and use CAD identity, not that display field, for dispatch.
