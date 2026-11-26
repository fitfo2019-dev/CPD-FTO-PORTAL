# Field Training Office Forms: Replit Package

Prepared November 26, 2026. Every form proof built for the Field Training Office, in one package.

These are design proofs made with fictional records. They are not production exports or signed records. The portal's export code has not been changed to match them yet.

## Folders

| Folder | Contents | Status |
|---|---|---|
| 1-Original-Proofs | The 17 one-page form proofs, plus one combined review packet | Baseline. Keep unchanged. |
| 2-Visual-Refresh-Proofs | The same 17 forms with the visual refresh applied, plus one combined review packet | Proof. Owner approval not yet recorded. |
| 3-Export-Redesign-Preview | 5-page preview of the export redesign | Owner approved the features listed below. The remaining forms are previewed before any code change. |
| 4-Guides | Export implementation guide, visual refresh specification, earlier Substation Orientation branding proof | Reference |

## The 17 forms

| No. | Form | Orientation |
|---|---|---|
| 01 | Substation Orientation | Portrait |
| 02 | Reporting for Duty Form | Portrait |
| 03 | Call for Service | Portrait |
| 04 | Self-Initiated Run / Training | Portrait |
| 05 | Domestic Incident | Portrait |
| 06 | Traffic Crash Investigation | Portrait |
| 07 | Traffic Stop | Portrait |
| 08 | High Risk Traffic Stop | Portrait |
| 09 | Building Search (primary) | Portrait |
| 10 | Arrest Process | Portrait |
| 11 | OVI Process | Portrait |
| 12 | Building Search (supplement) | Portrait |
| 13 | Probationary Officer Daily Performance Summary | Landscape |
| 14 | Probationary Officer Weekly Performance Summary | Landscape |
| 15 | Monthly Performance Summary | Landscape |
| 16 | Probationary Officer Weekly Performance Log | Portrait |
| 17 | Weekly Packet Acknowledgement | Portrait |

File 13 keeps its original file name, "Daily-Performance-Log". The printed title was later renamed Daily Performance Summary.

## Rules every export must keep

- Exactly one US Letter page per form. Forms 13, 14 and 15 are landscape. The other 14 are portrait.
- City of Columbus wordmark upper left, larger color patch upper right, larger silver badge lower left.
- Keep the original content, form IDs, review and signature notices, checklist states, ratings and all form data unless the owner approves a change.
- Keep the primary and supplemental Building Search forms separate.
- Website frames, menus and buttons are uppercase through CSS. Entered data keeps its exact case.
- No instruction text, rule summaries or developer comments on any screen or printed form.

## Approved export redesign features (owner, November 25, 2026)

- New Weekly Packet cover page as page 1: contents with page numbers, automatic packet checks, due date and week at a glance.
- Record ID, version and QR code in every form footer.
- Day at a glance on the Daily Performance Summary.
- Not-completed box on checklists, carried to the Daily Performance Summary.
- Day-by-day grid on the Weekly Performance Summary.
- Week summary strip on the Weekly Comment/Signature Sheet.
- Run-page references on the Daily Performance Summary Activity Summary, using the record ID format WxDyPz (for example W1D2P4).

## Still waiting on owner decisions

- Form numbers. The owner chose to follow the manual (Daily U-10.173, Weekly Summary U-10.174), held for confirmation.
- Day 1 order. The manual puts Reporting for Duty as page 1 and Substation Orientation as page 2. The portal prints Substation Orientation first.
- Approval of the visual refresh proofs.

## How changes reach Replit

The owner's workflow: the code is built and tested outside Replit and pushed to GitHub main. Replit then uses only Git Pull, Deploy and Redeploy. Use these files as reference. Do not change the export code from this package without the owner's approval of a preview.
