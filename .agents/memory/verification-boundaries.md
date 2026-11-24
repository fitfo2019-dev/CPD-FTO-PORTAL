---
name: Verification boundaries
description: Differences between browser and Node JSX, and between emulated and actual PostgreSQL permission checks.
---

Exercise actual JSX components, not only pure models or browser builds.

**Why:** Vite can supply a React runtime that Node's transformation of transitive JSX imports does not. Typechecking and the browser build alone missed a component-rendering failure.

**How to apply:** Include component `.test.tsx` files in alias-resolved regression commands, alongside `.test.ts` files. Keep those tests independent of browser-only runtime injection.

Preserve the disposable real-PostgreSQL tests with a non-owner, column-restricted runtime role.

**Why:** The in-memory PostgreSQL engine did not expose the same privilege requirement for row-locking reads. Real PostgreSQL caught an accidental requirement for update authority on a trusted mapping.

**How to apply:** Test authority-table locks, runtime grants and competing packet transitions against actual disposable PostgreSQL; passing in-memory transaction tests are not a substitute.
