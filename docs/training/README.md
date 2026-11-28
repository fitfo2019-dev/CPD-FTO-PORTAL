# FTO Portal training deck

`FTO-Portal-Training-Deck.pptx` explains the portal, its roles and workflows, the rating rules, PO status (PO-STD-2), PO score (PO-SCORE-2) and the NRT recommendation (PO-NRT-1), and how to teach FTO's. Manual citations are page numbers from a PDF render of the 2026 FTO Manual (.docx), so they may differ by a page in Word.

Update it after every merge to main: edit `build-deck.mjs` (rules, build status slide and version line), then rebuild with `node build-deck.mjs` with `DECK_FRAMEWORK` set to the slide framework module path, and replace the .pptx.
