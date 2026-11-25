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
