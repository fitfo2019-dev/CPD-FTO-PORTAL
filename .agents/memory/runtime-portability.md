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

DOCX import through Mammoth has separate browser and Node input adapters: the
browser adapter reads `arrayBuffer`, while Node reads `buffer`.

**Why:** A browser-targeted input can pass Vite builds yet fail when the same file
import is exercised in Node-based tests.

**How to apply:** Keep both inputs available when Node's `Buffer` exists, guarded
with `typeof Buffer` so browser execution does not require a Buffer polyfill.
