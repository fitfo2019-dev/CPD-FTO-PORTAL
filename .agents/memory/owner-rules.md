---
name: Owner rules and decision sources
description: Where the owner's decisions live, and the standing rules for every portal change and every reply
---
The owner's decisions are in `docs/rebuild/DECISIONS_LOG.md` (later rows win)
and `docs/rebuild/REBUILD_SPECIFICATION.md`. The 2026 FTO manual governs program
rules unless a logged owner decision overrides it. Check the manual, Division
directives and SOP first; when they do not settle a question, ask the owner.
Never assume a business rule.

Standing rules:
- Ask at most 5 plain questions per set, recommended option first, each with
  its reason and effect. Always give a recommendation and why.
- Program terms come from the manual. Say Daily Performance Summary, never
  "DOR". No abbreviations except FTO and PO. Write PO's and UA's, never POS
  or UAS, including inside all-caps labels.
- Finish the current task before starting a new one.
- Every user-interface change gets its own preview branch with screenshots
  and is merged only after the owner explicitly approves it. On-screen
  instruction sentences are removed only after the owner approves each line.
- No instruction text, rule text or developer notes on screens; logic runs
  silently. Shell frames, sidebar links, tabs and buttons are uppercase by CSS;
  raw data keeps its exact case.
- Two-stage submission: `local_draft_pending` until the FTO's explicit
  Finalize, then `submitted_complete`.
- One deficiency per category per run page; Officer Safety overrides apply.
- PO status and every calculation must sustain litigation: signed Daily
  Performance Summaries only, one versioned formula, reproducible by hand.
- The Vercel website (cpd-fto-website.vercel.app) is the approved design
  reference; it is updated whenever Replit `main` changes.

**Why:** The owner reported that Replit Agent was not following their
commands. Their answers were recorded only in Perplexity project files, which
this workspace could not see.

**How to apply:** Read the decisions log before answering any portal question.
Code and user-interface changes are built in Perplexity (see
`perplexity-ui-builds.md`); hand them off instead of building them.
