---
name: Verification boundaries
description: Differences between browser and Node JSX, React input focus in JSDOM, and emulated versus actual PostgreSQL permission checks.
---

Exercise actual JSX components, not only pure models or browser builds.

**Why:** Vite can supply a React runtime that Node's transformation of transitive JSX imports does not. Typechecking and the browser build alone missed a component-rendering failure.

**How to apply:** Include component `.test.tsx` files in alias-resolved regression commands, alongside `.test.ts` files. Keep those tests independent of browser-only runtime injection.

For React input tests in JSDOM, verify native `disabled` state rather than calling `.focus()` on inputs.

**Why:** React's legacy input-event polyfill can call unsupported `attachEvent` when JSDOM input focus triggers event setup.

**How to apply:** Use browser automation for actual focus behavior; keep JSDOM assertions on labels, values, placeholders, and disabled state.

Preserve the disposable real-PostgreSQL tests with a non-owner, column-restricted runtime role.

**Why:** The in-memory PostgreSQL engine did not expose the same privilege requirement for row-locking reads. Real PostgreSQL caught an accidental requirement for update authority on a trusted mapping.

**How to apply:** Test authority-table locks, runtime grants and competing packet transitions against actual disposable PostgreSQL; passing in-memory transaction tests are not a substitute.

Do not equate a successful PostgreSQL `GRANT` statement with a successful privilege change.

**Why:** A non-owner with access but no grant option can receive `warning_no_privileges_granted` rather than a rejected query when attempting to grant privileges.

**How to apply:** Permission-escalation regressions should accept only the expected permission error or warning, then verify unchanged ACLs and effective privileges for both grantor and recipient.
