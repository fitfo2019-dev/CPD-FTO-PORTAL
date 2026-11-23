---
name: Agency packet storage boundary
description: User-selected offline-first storage and server-roster authorization requirements
---
Complete daily packets are local-first encrypted drafts and may be synchronized
to an agency-managed database. Agency-signed role/badge claims establish identity;
server-held roster assignments establish scope. Do not trust assignment mappings
from browser tokens or turn a local-save action into an upload.

**Why:** The user explicitly selected agency-managed storage, agency identity
claims, complete daily packets and signed-role plus server-roster authorization.
They require local editing without connectivity and approval/preview for UI changes.

**How to apply:** Keep local saving independent of the network. Confirmed uploads seal
the local packet, but must not invent electronic signatures or PO release.
Do not claim a live agency integration without testing its actual configuration.

An uncertain upload outcome must retain its exact original snapshot and retry
identity across vault restoration; schema normalization must not replace it.

**Why:** A request can commit server-side before its response is lost. Replacing
its retry identity after restoration strands the locally pending packet.
