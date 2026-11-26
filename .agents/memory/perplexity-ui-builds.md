---
name: Perplexity builds the user interface
description: User-interface work is built in Perplexity and arrives through GitHub main; Replit Agent hands it off instead of building it
---
All code for the portal is built in Perplexity. All user-interface work for the portal (screens, components, styles, layouts,
screen wording, navigation, print/export layouts) is built in Perplexity,
verified there against the project gates, and merged to GitHub `main`. Replit
only pulls `main` (fast-forward) and republishes.

**Why:** The user directed that the portal is built in Perplexity and pushed to
Replit, that Replit Agent never builds or pushes to `main`, and that Replit use
Perplexity when user-interface work is needed.

**How to apply:** If asked for a user-interface change, make no workspace
changes. Reply with a handoff note for Perplexity: the requested change, the
affected screens and files, the governing FTO manual section, and open
questions. Never push or merge to `main`; push any Replit-made commits only to a
`replit-sync-N` branch.
