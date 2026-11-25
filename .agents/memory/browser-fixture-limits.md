---
name: Browser suspension and route fixtures
description: Limits when simulating sleeping tabs and disconnected services in headless browser tests.
---

Verify that the chosen suspension or disconnection actually takes effect before
using it as evidence.

**Why:** Headless Chromium accepted a lifecycle-freeze command while JavaScript
kept running, and CDP offline emulation did not stop route-fulfilled Playwright
requests. Either could produce a false passing reconnect test.

**How to apply:** Probe tab responsiveness after suspension. If lifecycle freeze
does not work, use debugger pause and explicitly describe that narrower scope.
For route fixtures, abort requests at the fixture layer to simulate service
unavailability, and distinguish polling recovery from an observed immediate
focus/online refetch. Never claim OS sleep or real network coverage from those
substitutes.

Controlled browser events must reach the dependency's actual listener target.
For visibility recovery, a synthetic event sent on the document without
bubbling can miss a window listener. A focus-state getter alone is not proof
that the listener ran; assert the resulting network request with polling
suppressed instead.

**Why:** An isolated browser run initially appeared to reproduce a focus
failure, but only its synthetic event delivery was wrong. Separately, a minimal
silent channel stub broke authentication initialization because a dependency
also expected the channel's EventTarget API.

**How to apply:** Preserve the real event-listener path and compatible browser
interfaces in test controls. Scope channel counters to the feature under test,
since auth dependencies may also create and post to their own channels. Report
synthetic-event coverage separately from native OS or network transitions.

For React UI tests that rely on controlled input events, install the JSDOM
globals before importing the component. A component dependency can load React
DOM's event system early, leaving native `input` events disconnected from React
state even when the DOM value changes.

**Why:** A form test appeared to fill date inputs, but the DOM changed without
updating React state because the UI module had been imported before the DOM
fixture was installed.

**How to apply:** Create the JSDOM instance, install its browser globals, then
dynamically import the component and mount it. Assert both the rendered value
and the resulting enabled/disabled behavior.
