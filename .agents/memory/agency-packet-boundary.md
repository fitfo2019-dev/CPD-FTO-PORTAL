---
name: Agency packet storage boundary
description: User-selected offline-first storage and server-roster authorization requirements
---
Complete daily packets are local-first encrypted drafts and may be synchronized
as editable `local_draft_pending` snapshots to an agency-managed database.
Agency-signed role/badge claims establish identity; server-held roster assignments
establish scope. Do not trust assignment mappings from browser tokens.

**Why:** The user explicitly selected agency-managed storage, agency identity
claims, complete daily packets and signed-role plus server-roster authorization.
They require local editing without connectivity and approval/preview for UI changes.

**How to apply:** Keep local saving independent of the network. Online saves and
reconnection may synchronize editable drafts, but only an explicit FTO
finalization seals the exact server snapshot and exposes it to its assigned
Coordinator. Finalization is not an electronic signature or PO release. Do not
claim a live agency integration without testing its actual configuration.

Tab-overwrite recovery copies are encrypted device-local data, separate from the
agency sync queue. Restoring one replaces only the local workspace record and
preserves protected synchronized or uncertain packets.

**Why:** The user requires recovery of accidental local overwrites without
changing agency-sync state or turning recovery into an upload.

**How to apply:** Capture a peer's unsaved workspace before locking it; expire
recovery copies after seven days and delete them after a successful restore.

Each substation has one physical network jack for 15 FTOs; per-upload wired
connections are impractical. The upload design must support an agency-approved
shared Wi-Fi or remote-access route rather than requiring each FTO to plug in.

**Why:** The user described the substations' single network jack and 15-FTO
workforce as an operational constraint.

**How to apply:** Treat managed wireless/VPN as an agency network design decision.
Do not imply this app provides it or recommend unmanaged access equipment.

An uncertain draft upload or finalization must retain its exact original snapshot
and retry identity across vault restoration. Sealed and uncertain snapshots must
be excluded from automatic report normalization.

**Why:** A request can commit server-side before its response is lost. Changing
even an otherwise harmless optional field during restoration breaks the exact
snapshot comparison and can prevent the pending packet from being retried.

Background synchronization must update transport metadata without remounting
mounted editors or replacing newer authored state.

**Why:** An FTO can begin typing after an automatic upload starts. A later receipt
must not discard that unsaved narrative or open run form.

**How to apply:** Keep route identity stable for draft acknowledgments and cover
slow responses with a mounted-editor regression, not just transport tests.

Packet review must remain distinct from electronic signatures. Release and PO
acknowledgment refer to an exact immutable snapshot. Corrections permanently
withdraw the original and append a linked replacement with fresh review; never
overwrite an acknowledged record or carry its acknowledgment forward.

**Why:** Upload and browser signature/status objects are not trusted approval
evidence. Retaining originals prevents corrections from rewriting what a PO
actually reviewed.

**How to apply:** Derive workflow state, actors and times on the server; retain
withdrawn history for authorized staff and hide withdrawn packets from PO reads.
