---
name: Portable runtime boundary
description: Project requirements for keeping application code portable beyond its current workspace.
---

The user requires deployable application code to avoid Replit-only packages and runtime strings, use modern ECMAScript modules, and include explicit extensions on local imports.

**Why:** The application is intended to be exportable to an agency-managed server.

**How to apply:** When changing app code, dependencies, or build configuration, preserve these portability requirements. Workspace-specific service metadata may still be necessary for local previews.

Spreadsheet portability checks must execute workbook construction, not just a
TypeScript or Vite build.

**Why:** The spreadsheet styling package's CommonJS interoperability allowed a
namespace import to compile successfully while its workbook utilities were
undefined when executed under Node/tsx.

**How to apply:** Preserve the tested default-import interop and exercise a real
workbook-generation test whenever spreadsheet imports or build transforms change.

JSX regression checks must actually render components under the Node test runner.

**Why:** In this workspace, tsx workers used classic JSX behavior despite the
nested test configuration requesting the automatic runtime. Type checks and Vite
builds passed while rendering failed because React was not in scope.

**How to apply:** Run a rendering test when introducing component-level Node
tests. Keep explicit React imports where needed by that runner rather than
assuming the browser build proves the test runtime works.
