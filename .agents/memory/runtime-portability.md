---
name: Portable runtime boundary
description: Project requirements for keeping application code portable beyond its current workspace.
---

The user requires deployable application code to avoid Replit-only packages and runtime strings, use modern ECMAScript modules, and include explicit extensions on local imports.

**Why:** The application is intended to be exportable to an agency-managed server.

**How to apply:** When changing app code, dependencies, or build configuration, preserve these portability requirements. Workspace-specific service metadata may still be necessary for local previews.
