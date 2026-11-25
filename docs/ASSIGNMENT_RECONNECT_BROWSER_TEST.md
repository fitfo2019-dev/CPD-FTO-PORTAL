# Assignment refresh after a suspended tab reconnects

Run date: 2026-11-25.

## Scope and isolation

The existing portal was exercised in Chromium with two same-origin tabs and
fictional, verified Clerk FTO sessions, referred to here only as **TEST-A** and
**TEST-B**. Operational-profile requests used isolated browser-route fixtures
with raw, schema-shaped GET/PUT responses and compare-and-swap versions.
Every other `/api/` request was intercepted and returned an unavailable response
unless explicitly handled by the dispatch fixture. No agency database,
operational packet, or CAD feed was contacted.

The live portal supplied its actual `OperationalProfileProvider`, subject-scoped
React Query cache, native `BroadcastChannel`, Account Settings editor, and Clerk
account boundary. No sign-in implementation, production component, schema,
profile store, or presentation was changed.

## Browser observations

| Check | Result |
| --- | --- |
| Initial assignment | Both TEST-A tabs loaded `9150E-1`, version 1. |
| Suspended dirty editor | Tab A1 contained unsaved `9150E-2`; its JavaScript was paused and verified unresponsive. Tab A2 saved `9150E`, using `expectedVersion: 1`, and received version 2. |
| Resume | A1 refreshed its saved profile, retained unsaved `9150E-2`, displayed the existing newer-assignment warning, and disabled stale saving. |
| Clean editor | After explicitly discarding edits, A1 showed `9150E`. A subsequent save of `9150E-1` in A2 refreshed A1 to version 3 without a dirty warning. |
| Unavailable profile | Aborting fixture GETs made the editor fail closed, retain its dirty text, and disable saving. |
| Recovery | Restoring fixture GETs let the existing 30-second polling path recover the saved profile and clear the provider's unavailable alert. |
| Late former-unit ingress | A held `9150E-1` response released after switching the hook context to `9150E` produced no prefill and no identity-confirmation callback. The new request used exact unit `9150E`; its response produced one prefill and one confirmation for `TEST-A:2`. |
| New packet | The real draft factory snapshotted `9150E` exactly, with no side property. |
| Saved packet and Cruiser | The earlier `9150E-1` draft remained unchanged. A manually entered physical Cruiser `7751` carried forward unchanged; CAD district digits did not populate it. PO identity and an FTO badge mismatch supplied no packet identity. |
| Account switch during a held refresh | In the same tab A1, a TEST-A GET was held, then the actual Clerk session signed out and signed in as TEST-B. After navigating to Account Settings, B showed `9160E-2` and badge `TEST-FTO-B`. Releasing the old A responses and posting an A-subject broadcast did not change B's editor or cause additional profile requests during the four-second observation window. |
| Late former-account ingress | In the isolated hook probe, changing A to B sent exact unit `9160E-2`. B's response produced one prefill and confirmation; releasing A's held response afterward added neither. |

### Separate boundaries exercised

The event-ingress hook is not currently mounted by a production component.
Its browser check therefore mounted the **real** `usePatrolViewSync` beneath the
real exported context object, with fixture-driven context values and a
confirmation spy. Requests went through the real generated client. This proves
the hook rejects the obsolete response; it is not an end-to-end test of a
production-mounted event-ingress flow or of provider cache confirmation.

Packet checks imported and called the real `createDailyReportDraft` and
`activeFtoIdentity` in the browser. They did not create or save a packet through
the portal's form workflow or touch an existing vault.

The account-switch result comes from the same tab that owned the held A
request, not simply a second tab already displaying B. Clerk required sign-out
followed by ticket sign-in and one post-switch navigation to Account Settings.
The A provider was consequently unmounted and its request abandoned before
the late response arrived. This exercises the application's real teardown and
keyed-remount boundary, not a live CAS rejection while A remains mounted.
There was no page reload after releasing the delayed A responses.

## Suspension and network limits

- `Page.setWebLifecycleState("frozen")` did not actually freeze this headless
  browser. `Debugger.pause` did suspend tab JavaScript, confirmed by a timed-out
  evaluation probe. These results cover paused JavaScript, not operating-system
  sleep, browser eviction, or a real lifecycle freeze.
- CDP offline emulation did not prevent Playwright route-fulfilled responses.
  The unavailable-service check instead aborted profile requests at the fixture
  layer. This is a simulated service disconnect, not proof of a physical network
  disconnect.
- Focus/visibility manipulation did not produce an observed immediate refetch
  in this headless run. Recovery was observed through the existing polling
  interval, approximately 9–29 seconds after fixture connectivity returned.
  Do not cite this run as proof of immediate focus- or reconnect-triggered
  fetching.
- After a failed manual reload, its action-specific error text remained visible
  even after automatic recovery cleared the provider's unavailable alert.
  This was recorded as a separate recovery-feedback issue; no UI change was
  integrated as part of verification.

## Reproduction recipe

For retained, isolated fallback coverage with cross-tab delivery and polling
disabled by test controls, see
[`ASSIGNMENT_FALLBACK_BROWSER_TEST.md`](ASSIGNMENT_FALLBACK_BROWSER_TEST.md).
That suite exercises the actual Query focus/online listeners with controlled
browser signals; it does not reinterpret this earlier run as native-event
evidence.

1. Start the existing portal workflow. Use a disposable Chromium context and
   programmatic fictional verified FTO sessions; never copy operational claims
   or credentials into fixtures.
2. Intercept all `/api/` requests before opening the portal. Default-deny
   unhandled requests. Serve `/api/v1/account/operational-profile` with the real
   raw response shape: `subject`, `role`, `badge`, `version`, and `identity`
   derived by the shared operational-identity contract. Return 409 for an
   outdated PUT `expectedVersion`.
3. Open Account Settings in two tabs for the same subject. Follow the
   assignment/version sequence in the table, pausing A1 before A2 saves.
   Resume A1 and inspect the input, newer-version warning, and save-button
   disabled state. Do not substitute a page reload for resuming the editor.
4. Abort profile GETs, explicitly reload the saved assignment, and inspect
   dirty-text preservation and unavailable state. Restore GETs and observe the
   existing polling recovery without manually replacing client state.
5. In a disposable in-page React root, mount the real ingress hook with the
   exported context and held fixture responses. Change its subject/version/unit
   context before releasing the old response. Count both prefill and identity
   confirmation calls, not merely the final displayed value.
6. Import the real draft factory and identity selector in the browser. Compare
   whole saved drafts before/after creating the next draft, including optional
   side presence and manually corrected Cruiser.
7. Hold A's profile GET in the same portal tab that will switch accounts.
   Sign out and programmatically sign in as fictional B, then navigate to
   Account Settings. Verify B before releasing A's response. Post on A's
   subject channel and verify that B's input, badge, CAD identity, and request
   counts remain unchanged. Separately change the hook probe from A to B
   with a held ingress response and verify both callback counts remain
   unchanged when that former-account response is released.

## Evidence and ordinary checks

Detailed machine-readable assertions and disposable route/probe helpers were
saved in the ignored `generated-artifacts/task-165/` directory. They are local
run evidence, not production assets or a turnkey browser-test runner. This
document is the retained summary and reproduction procedure.

The context snapshot, `pnpm typecheck`, portal production build, targeted profile
client/editor/race/identity/persistence regressions, and
`pnpm run bundle:production` succeeded. The generated archive was 12,880,665 bytes,
below 26,214,400 bytes. These checks do not certify an agency installation,
production identity policy, dispatch connectivity, or physical workstation
sleep behavior.
