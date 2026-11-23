---
name: Shared type freshness
description: Distinguish stale referenced-library declarations from genuinely missing API exports.
---

When the portal checker reports a missing shared API export, compare the generated source with the referenced library's declaration output before changing imports or replacing API calls.

**Why:** The development server can run against current source while its TypeScript checker reads older composite-library declarations. This has produced a blocking error overlay even though the requested API functions existed.

**How to apply:** Rebuild the referenced shared types first, then check the portal. Preserve the type checker rather than hiding its overlay or weakening type safety.
