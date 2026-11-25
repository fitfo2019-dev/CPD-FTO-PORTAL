# Assignment refresh without cross-tab delivery

## Retained browser coverage

`artifacts/field-training/tests/browser/assignment_fallback.py` exports
`run(context, base_url, subject)` for a **sync Playwright** browser context
already signed in as a disposable, verified fictional Clerk user with an
`example.com` address. It returns JSON-serializable evidence and raises on any
failed assertion. Authentication must be established by the browser test
environment; this repository does not store credentials or change sign-in.

Example invocation inside an authenticated Playwright session:

```python
import importlib.util
import json

spec = importlib.util.spec_from_file_location(
    "assignment_fallback",
    "artifacts/field-training/tests/browser/assignment_fallback.py",
)
suite = importlib.util.module_from_spec(spec)
spec.loader.exec_module(suite)
results = suite.run(context, portal_development_origin, fictional_clerk_subject)
print(json.dumps(results, indent=2))
```

Use the existing portal development workflow. No API server, agency database,
real CAD service, alternate profile store, or installed application data is
needed. Run only in a disposable test context, never an operational session.

The runner intercepts an otherwise nonexistent document URL and serves a
minimal test document. It dynamically imports
`tests/browser/assignment-fallback-harness.tsx` from Vite. There is **no new
production route**. The harness mounts the real Clerk provider and `useUser`,
`OperationalProfileProvider`, `QueryClient`, Account Settings editor, and
`usePatrolViewSync`. It does not substitute the exported profile context, call
manager setters, invalidate queries, or manually refetch to satisfy a
transition assertion. The only manual reload is the final explicit discard of
unsaved editor text, after the automatic refresh assertions have passed.

All `/api/` traffic is intercepted, including unexpected routes, which fail the
test. Operational-profile GETs return the exact raw API object, with the
subject, role, badge, version, and derived identity (including absence of
`side` for a side-free token), not a success-envelope approximation. History
and dispatch use their own response contracts. Unexpected profile writes
fail; external assignment changes are simulated by advancing the isolated
server fixture, not editing the client's query cache.

## Four independent cases

| Cross-tab control | Browser transition |
| --- | --- |
| `BroadcastChannel` absent | hidden → visible, then focus |
| `BroadcastChannel` absent | offline → online |
| Channel accepts a post but never delivers it | hidden → visible, then focus |
| Channel accepts a post but never delivers it | offline → online |

Each case starts with a fresh page and QueryClient. Test initialization
suppresses only `setInterval` calls with a 30,000 ms delay and records that the
polling path was actually suppressed. Production code and its 30-second
interval remain untouched. No query timer or production listener is replaced
by a manual refresh.

Each case asserts:

- Initial saved assignment `9150E-1`, version 1, and a held request for that
  exact CAD unit.
- Dirty editor text `9150E-2` survives an external save of side-free `9150E`,
  version 2.
- A fixture change (and, for the silent channel, an undelivered message) causes
  no profile request before the browser transition.
- The transition itself causes one new profile GET and version 2 becomes
  visible within four seconds, well below the production polling interval.
- The newer-assignment warning appears and saving the stale edit is disabled.
- The real ingress hook requests exact unit `9150E`. A late former-unit
  response cannot add a prefill or restore former-unit defaults; the current
  saved identity has no obsolete `side`.
- A separate failed profile GET makes the provider unavailable, preserves the
  dirty input, disables saving, and issues no request using the stale CAD unit.
- Restoring the fixture plus the same browser transition recovers the provider
  without polling or a reload. Only the final explicit discard replaces the
  dirty input and editor CAD preview with saved `9150E`.

## Rapid overlapping transitions

The runner also mounts one extra page with the same real provider, QueryClient,
editor, and ingress hook. It holds profile GET responses at the route fixture,
then toggles Chromium's actual `navigator.onLine` state through CDP while
repeatedly changing hidden/visible state. Every transition-triggered GET remains
held until the fixture releases the final raw profile object. The physical
connectivity signals and fixture response delays are separate controls; this
case does not abort profile requests to simulate an outage.

The overlap case asserts that the provider and subject-scoped query cache both
equal the exact latest server response, the dirty assignment remains in the
editor, recovery is not left unavailable or pending after the browser is online
and visible, and no late response for the former CAD unit can apply a prefill.
The polling interval and BroadcastChannel delivery remain suppressed only by
the same test controls as the four independent cases.

## What the test does not prove

These are deliberately controlled **browser event/listener tests**. In
TanStack Query v5 the default focus manager observes `visibilitychange`, not
the `window.focus` event alone. The runner changes the document's reported
visibility and dispatches the corresponding event, then checks the real
manager's observed state. For reconnect it dispatches offline/online events
and likewise checks the real online manager. It does not replace either
manager's event listener or set its state directly. The overlap case additionally
uses CDP to toggle Chromium's online signal, but its API responses are still
controlled by Playwright routes; this is not a real network outage.

Consequently a pass does not certify native operating-system focus, physical
network loss, workstation sleep, browser lifecycle freezing, or tab eviction.
The unavailable-service scenario aborts profile requests at the fixture layer;
it is **not** CDP offline emulation. Route-fulfilled requests can bypass CDP
offline emulation, as recorded in
`docs/ASSIGNMENT_RECONNECT_BROWSER_TEST.md`.

The ingress hook is mounted in the isolated harness, not an end-to-end
production-mounted event-ingress flow. The tests check current context and
callback results without writing packets or testing agency authorization.

The fictional Clerk account supplies only the signed-in subject and verified
email for this test. FTO role and badge come from the isolated profile response;
agency-side role claims and authorization are not exercised. The silent channel
stub implements `EventTarget` for compatibility with Clerk, and suppresses
Clerk's messages too; its counters count only operational-profile channels.
This does not test Clerk cross-tab synchronization.

## Recorded result — 2026-11-25

All four cases passed in headless Chromium 157.0.8103.38 with sync
Playwright 1.64.1. Each case observed five profile GETs: initial version 1,
transition-triggered version 2, one fixture-aborted GET, event-triggered
recovery, and the final explicit discard/reload. Each observed exact ingress
units `9150E-1`, `9150E`, `9150E` (the last is the post-recovery request).
All initial stale-response assertions passed before service failure/recovery.
There were no unexpected API routes or profile writes.

The focus test dispatches a **bubbling** `visibilitychange` from the document:
the installed Query listener is on the window. A non-bubbling synthetic
document event did not reach that listener in the first harness attempt.
Reading `focusManager.isFocused()` alone is not evidence that a listener ran,
because it can read the document getter directly. The request-count change
and successful refresh within four seconds are the listener evidence.

The final machine-readable report and end-of-case screenshots are local,
ignored evidence under `generated-artifacts/assignment-fallback/`. Diagnostic
attempts are retained there separately from the passing report. This was one
successful full run after test-fixture corrections, not a repeatability study.
No production behavior or sign-in code changed.

Ordinary checks passed: `pnpm typecheck`,
`pnpm --filter @workspace/field-training run typecheck:tests`,
`pnpm --filter @workspace/field-training run build`, and
`pnpm run bundle:production`. The combined archive was 12,914,112 bytes, below
26,214,400 bytes. The test harness is absent from the production archive.
