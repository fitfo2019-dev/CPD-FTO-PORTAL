---
name: Test administrator boundary
description: How the isolated portal test administrator is scoped, and what must never widen it.
---

The test administrator is a synthetic-staging-only directory role, never an agency
role claim. It needs non-production, both staging switches, recent MFA, a session
WITHOUT the agency-verified claim, and a developer-provisioned directory entry.
It may read/create/update synthetic records but never acknowledge on a PO's behalf.
Production refuses to boot if the test-admin switch is present.

**Why:** The task required full test capability without creating a production
privilege path or exposing real agency records; the owner must create the Clerk
account themselves (agent never handles credentials).

**How to apply:** Do not add the test role to agency claim allowlists, the browser
role preview, or agency packet/review routes. Extend test capability only inside
the synthetic staging repository and its SQL scope.
