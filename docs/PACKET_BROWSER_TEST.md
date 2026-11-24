# Local Chromium packet setup and edit check

## Scope and safety

Run date: 2026-11-24.

The portal was exercised in headless Chromium against its local development
server at `127.0.0.1:18795`. Each test used a new, disposable browser context.
Only the local application was reachable; external requests were blocked except
for static Clerk JavaScript needed to render the development-only UI. The
browser's Clerk development handshake request was blocked. No user signed in,
no preview deployment or agency service was used, and no operational or real
packet data was entered.

The available identity was the portal's built-in fictional role preview, not a
dedicated signed-in Clerk test account. The synthetic roster used the class
`FICTIONAL TEST ONLY 205 PACKET STRESS CLASS`, 205 fictional POs, and one
fictional FTO. The separate packet editor check used the portal's clearly
marked fictional FTO test packet.

## Browser results

Interaction times are from one local Chromium run and are illustrative.

| Step | Result | Time |
| --- | --- | ---: |
| Load phase setup and switch to the fictional coordinator view | Passed | 1,037 ms |
| Parse and preview 205 roster rows | Passed; 205 assignments and one unique FTO | 56 ms |
| Add roster and render all assignment cards | Passed; 205 imported cards plus 2 pre-seeded fictional examples | 727 ms |
| Search for one imported PO and prefill its phase | Passed | 186 ms |
| Save phase setup | Passed; success notification shown | 347 ms |
| Open fictional packet list | Passed | 796 ms |
| Edit packet narrative and save draft | Passed | 371 ms |
| Return to list and reopen the edited packet without refreshing | Passed; edited text remained present | — |
| Agency access and upload controls in preview | Correctly disabled; preview-only warning shown | — |

The packet editor's preview is memory-only. Reopening by navigating back to the
list preserved the edit for that browser session; refreshing would discard it.
No upload, agency access check, or sync request was made.

## Real browser storage measurements

The portal's `OfflineStorage` implementation was also exercised from a page in a
fresh Chromium context using the 205-packet fictional workspace fixture and
actual browser IndexedDB and Web Crypto. This directly measures the storage
implementation in a browser, but it does not exercise the portal's vault dialog
or authenticated route.

| Measurement | Result |
| --- | ---: |
| Packet records saved | 205 |
| Vault key derivation / unlock | 104 ms |
| Encrypted workspace save | 116 ms |
| Lock, derive key again, and reopen | 118 ms |
| Packet records after reopen | 205 |
| Pending local packet records | 205 |
| Browser-reported origin storage before / after save | 0 / 7,663,616 bytes |

The disposable browser context was closed after the run. A new isolated context
did not see the test vault. Measurements are specific to this Chromium run and
are not a storage-capacity or device-performance guarantee.

## Coverage gaps

- A dedicated fictional Clerk identity was unavailable. The signed-in portal,
  signed-in role claims, and authenticated phase setup were not exercised.
- The built-in UI preview deliberately uses memory-only workspace state. Its
  settings screen states that browser storage is not used, and its vault
  controls are unavailable. Encrypted IndexedDB save/reopen was measured
  directly through the production storage module instead of through the vault
  dialog.
- The FTO test packet preview explicitly disables agency reads and uploads.
  Sync was verified only as disabled in the preview UI. No signed-in sync
  against a disposable API was performed.
- Browser timing and storage figures are from a single local run. They do not
  measure an agency workstation, production identity, agency network,
  production database, or 205-packet sync latency.
