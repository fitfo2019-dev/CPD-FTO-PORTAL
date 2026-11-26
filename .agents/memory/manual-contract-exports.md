---
name: Manual shared contract exports
description: Prevents code generation from silently removing hand-written contract exports.
---

Expose hand-written shared validation modules through an explicit package subpath,
not an extra export appended to the generated API package's root barrel.

**Why:** API code generation replaces the root export barrel. An appended manual
export disappeared on regeneration and broke both frontend and backend imports,
even though the hand-written module itself was retained.

**How to apply:** Keep manual validators outside generated output directories and
give them a package export that code generation does not own. Regenerating the
API must not be able to remove their public entry point.
