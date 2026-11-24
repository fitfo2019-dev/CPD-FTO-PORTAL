---
name: Verification boundaries
description: Differences between browser and Node JSX, React input focus in JSDOM, and emulated versus actual PostgreSQL permission checks.
---

Exercise actual JSX components, not only pure models or browser builds.

**Why:** Vite can supply a React runtime that Node's transformation of transitive JSX imports does not. Typechecking and the browser build alone missed a component-rendering failure.

**How to apply:** Include component `.test.tsx` files in alias-resolved regression commands, alongside `.test.ts` files. Keep those tests independent of browser-only runtime injection.

Browser-specific focus and input behavior needs verification at the browser boundary.

**Why:** A DOM emulator does not implement every browser capability; emulator limitations can be mistaken for application defects.

**How to apply:** Use mounted component tests for state and rendering, and real-browser checks when correctness depends on native browser behavior.

Preserve the disposable real-PostgreSQL tests with a non-owner, column-restricted runtime role.

**Why:** The in-memory PostgreSQL engine did not expose the same privilege requirement for row-locking reads. Real PostgreSQL caught an accidental requirement for update authority on a trusted mapping.

**How to apply:** Test authority-table locks, runtime grants and competing packet transitions against actual disposable PostgreSQL; passing in-memory transaction tests are not a substitute.

Do not equate a successful PostgreSQL `GRANT` statement with a successful privilege change.

**Why:** A non-owner with access but no grant option can receive `warning_no_privileges_granted` rather than a rejected query when attempting to grant privileges.

**How to apply:** Verify effective permissions, not just whether the database accepted a permission-related statement.

API success fixtures must reproduce each operation's actual response shape,
including the distinction between a raw object and a legacy success envelope.

**Why:** A profile editor passed with an envelope-augmented fixture but could
not load the real server's raw response because the shared transport assumed
all APIs used the older envelope. The browser check exposed the mismatch.

**How to apply:** Exercise generated clients with exact server-shaped responses.
Validate object responses against their operation-specific shared contracts;
do not relax validation globally or add undocumented wrapper fields to fixtures.

Preview generators can rewrite tracked registries during task handoff.

**Why:** Task completion reconciles the fork with main; a running preview
watcher can dirty its generated component registry between rebase steps and
interrupt an otherwise clean merge.

**How to apply:** Account for generator writes when checking whether a task's
working tree is stable enough for handoff.
