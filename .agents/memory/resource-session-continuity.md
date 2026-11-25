---
name: Resource session continuity
description: Authentication continuity for uploaded resources in the Field Training Officer Portal.
---

Resource listings and downloads must use the existing Field Training Officer Portal sign-in. Do not add a second login flow for files.

**Why:** The user asked that people who are already signed in should not have to sign in again to access files.

**How to apply:** Keep resource API requests on the portal’s same-origin `/api` routes and preserve the existing Clerk session checks and permissions.
