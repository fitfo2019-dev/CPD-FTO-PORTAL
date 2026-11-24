---
name: Date and time entry
description: Keyboard-entry and browser-locale constraints for portal form dates and times.
---

Exercise normal keystrokes into prefilled dates, including spaces, colons, single-digit hours, backspace, and clearing. A successful whole-value paste or programmatic fill does not establish that the field can be typed into.

**Why:** Whole-value checks passed while the orientation formatter removed separators during typing, blocking the user's attempt to proceed. Native time controls also required an AM/PM segment despite instructions asking for 24-hour time.

**How to apply:** Keep incomplete input editable, validate before saving, and use explicit HH:MM entry when the workflow promises 24-hour time. Verify both typing and save/reopen behavior when changing time controls.
