---
name: Shared type freshness
description: Distinguish stale referenced-library declarations from genuinely missing API exports.
---

When the portal checker reports a missing shared API export, compare the generated source with the referenced library's declaration output before changing imports or replacing API calls.

**Why:** The development server can run against current source while its TypeScript checker reads older composite-library declarations. This has produced a blocking error overlay even though the requested API functions existed.

**How to apply:** Rebuild the referenced shared types first, then check the portal. Preserve the type checker rather than hiding its overlay or weakening type safety.

After syncing branches, align installed dependencies with the lockfile as well as rebuilding shared declarations. Multiple React type versions can report incompatible `Ref` cleanup signatures even when the displayed signatures look identical.

**Why:** React's cleanup-return types contain private unique symbols, so two installed type versions are not always structurally compatible.

**How to apply:** Derive wrapper props from the wrapped library component. At a ref boundary, forward callback cleanup through a locally typed callback rather than weakening type safety or changing unrelated dependency versions.
