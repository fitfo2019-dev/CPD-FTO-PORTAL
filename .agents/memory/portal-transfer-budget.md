---
name: Portal transfer budget
description: The Field Training portal's initial and deferred JavaScript transfer limits.
---

The portal's initial static JavaScript import graph has a 1 MiB gzip budget.
JavaScript emitted outside that graph, including intentionally lazy-loaded
exports, has a separate combined 512 KiB gzip budget.

**Why:** The current initial payload is close to 1 MiB gzip, while intentionally
deferred exports should not consume initial-load headroom but still need a
separate ceiling.

**How to apply:** Preserve the separate initial and deferred accounting when
changing bundle structure. Re-evaluate the limits only with measured production
build output and a deliberate budget decision.
