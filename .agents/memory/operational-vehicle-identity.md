---
name: Operational vehicle identity
description: Columbus vehicle-profile semantics and their separation from training assignment and account authority.
---

Treat the user's `9150E-1` / `9150E-2` vehicle-profile examples as operational
identity, not a replacement grammar for legacy training roster assignments or
universal assignments. The user clarified that every supported assignment also
has an unsided form, including `9150E` and universal `80C`; an absent side must
remain absent. CAD unit digits are district tokens, not physical fleet numbers.
Validated CAD identities may supply their district token and trailing shift
letter, but do not establish mapped patrol geography, training company, role,
badge or record access. Preserve the full source CAD identity and optional side;
unsided units are not wildcards for sided units.

Universal `80C` takes precedence over the identically spelled ordinary
Precinct 8 company choice for new assignments; require an explicit mapped
district even there. Historical snapshots must keep their former meaning.
Historical ordinary `80C` records with `Day`, `Swing`, or `Night` shifts must
remain readable and exportable, including in class workbooks.

**Why:** The user requested a newer vehicle-profile notation while explicitly
preserving the portal's existing training assignment meanings, then clarified
that sides are optional and district/shift tokens come from CAD. Conflating
these values could silently reinterpret imported rosters, fleet numbers or
geographic context.
The universal code spelling overlaps an existing company code, so treating it
as ordinary would invent district 80 for selections made elsewhere.

**How to apply:** Keep account vehicle edits at the invitation-only verified
account boundary, separate from trusted roster provisioning. Snapshot the active
FTO's vehicle context only when creating a packet; PO account changes and later
vehicle changes must not rewrite saved FTO packet context. Preserve manual
Cruiser corrections and use CAD identity, not that display field, for dispatch.

The user approved the isolated own-account assignment-history preview for
integration beneath the existing Account Settings assignment editor. This is
not approval to replace that editor, restyle the portal, or expand history reads
to supervisors or other accounts.

**Why:** The preview approval was specifically for officers reviewing their
own operational token changes, with server time/actor and a clearly labeled
start of recorded history.

**How to apply:** Preserve that scope in later history enhancements. Do not
invent pre-tracking changes or infer a packet's frozen identity from current
account values.
