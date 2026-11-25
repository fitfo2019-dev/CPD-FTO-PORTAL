# Packet controls — approval boundary

This is an isolated, in-memory interaction preview. It has no API, auth, vault,
browser-storage, or live-workspace imports. Nothing here uploads a real record.
Do not integrate its simulated success states into the portal.

## After explicit user approval

- Keep the shell's **Save locally** handler unchanged: `saveNow()` saves the
  encrypted workspace and may enqueue snapshots, but never transmits them.
- Connect the distinct confirmed-upload action to
  `WorkspaceProvider.syncPackets()` in
  `artifacts/field-training/src/state/workspace.tsx`. That hook persists open
  workspace data and sends the encrypted queue through `uploadPacketBatch`.
  It uploads all queued packets, not a UI-selected subset. Preview counts and
  confirmation must reflect the actual packet queue, not unrelated local changes.
- The transport uses `POST /api/v1/training-packets/sync` with complete
  `{ operation_id, base_version, report }` entries and validates receipts.
  Do not create a second upload implementation or regenerate retry identities.
- Treat `GET /api/v1/training-packets/sync-readiness` as a fail-closed service
  check, not proof of a city-network boundary or per-packet authorization.
  `metadata.can_sync` does not establish that this FTO's assignment is valid.
  The server remains authoritative on every upload. Never transmit on mount,
  online events, retries without a click, or a local-save action.
- Gate upload on the unlocked vault, saved editor, idle operation, available
  service and verified FTO context. The preview's condition switches are not
  authorization. Preserve the 1–100 packet batch limit.
- Map local `local_draft_pending` to Pending upload. Uploading/failed are
  transient UI outcomes, not invented persisted sync statuses.
  On failure, the real hook may retain `syncAttemptPending`: the exact snapshot
  must remain protected until retry confirms whether the server committed.
  Only validated `synchronized_complete` receipts mean synchronized/sealed.
- Shared refresh uses `GET /api/v1/training-packets`; read-only detail may use
  `GET /api/v1/training-packets/:id`. Parse the success envelope and preserve the
  complete report, including fields that generated validators might strip.
  The list is bounded to 100 rows; do not describe it as the full agency archive.
  A read never acknowledges a local upload or replaces/merges a local draft.
- Use the centralized API base helper/client with same-origin credentials,
  abortable 15-second timeout, and safe explicit errors. Preserve stale results
  with a clear label after refresh failure. Clear reads and cancel requests on
  logout, account change, or vault lock; ignore late results.
- Upload creates neither an electronic signature nor approval nor PO release.
  Corrections to sealed packets need an authorized workflow, not an edit bypass.

## Review the preview

Open `PacketUploadPreview`, then use **Review and upload** to inspect the sealing
confirmation. **Try preview outcomes** exposes offline, locked, unsaved-editor,
unavailable-service, unconfirmed-upload, refresh-error and empty-result scenarios.
To test failure, enable **Fail next upload response**, upload and acknowledge,
then use **Review and retry upload**. Reconnecting alone changes no packet.

The user approved the Title Case, two-path preview for integration. The portal's
Daily Records page now uses the real provider sync hook and explicit read helpers.
The sandbox remains a fictional reference and makes no real API requests.
Network hardware, VPN/zero-trust infrastructure, agency identity mapping, and
agency storage provisioning remain agency IT responsibilities.
