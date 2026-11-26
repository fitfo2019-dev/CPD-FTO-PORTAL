# Replit Portal Workflow Map

Source: GitHub main at commit 7b69981 (the same code Replit runs after Pull). Read from the route table (App.tsx), the sidebar menus (shell.tsx), the role checks inside each page, and the agency server routes. Prepared November 26, 2026.

"Live" below means it works in the production build. "Preview only" means it appears only in the development preview and is excluded from production. "Device only" means records are saved encrypted on that device and are not sent to the agency server.

## Roles in the portal

| Role (as shown on screen) | Who it is | Lands on after sign-in |
|---|---|---|
| FTO | Field Training Officer | Home (My work) |
| FTO Coordinator | Field Training Office Coordinator | Home (Training office) |
| FTO Sergeant | Field Training Office Sergeant | Help Desk |
| FTO COC | FTO Chain of Command | Submitted Packets |
| PO | Probationary Officer | Account Access |
| POLICENET | Technical support account | Technical Access |
| POLICENET ADMIN — SGT | Technical support sergeant | Technical Access |

Old saved role names are translated automatically: recruit to PO, admin to FTO Coordinator, coc to FTO COC, sergeant to FTO Sergeant.

## Sidebar menu by role

| Role | Menu items, in order |
|---|---|
| FTO | Home · My PO's · Shifts & Runs · Daily Records · Weekly Packets · Agency Packets · Packet Submissions · Help Desk · Account Settings. Preview only: My Probationary Officer, Phase Sign-Up |
| FTO Coordinator | Home · Packet Submission Inbox · Classes & Rosters · Assignments · Coverage · Packet Monitor · Agency Packets · Help Desk. Preview only: Phase Setup (rebuild), PO Progress |
| FTO Sergeant | Packet Monitor · Help Desk. Preview only: Phase Setup (rebuild), PO Progress |
| FTO COC | Submitted Packets · Help Desk |
| PO | Agency Packets · Packet Status · Account Access · Help Desk · Account Settings |
| POLICENET and POLICENET ADMIN — SGT | Technical Access · Help Desk |

## Page by page

### Home (/)
- Roles: FTO and FTO Coordinator.
- FTO: Start shift or Continue shift, missing Daily Performance Summary dates (each opens that day), five-step paperwork cards (Phase setup, Shift and run forms, Weekly packet, Class reports, Class and phase sign-up), current phase folder, recent shift records, Unacceptable and Not Responding to Training follow-up list, phase extension panel.
- FTO Coordinator: Training office view with Classes and rosters, Post class phases, Coverage, Packet queue (weekly acknowledgements), Not Responding to Training review panel. Preview only: a "PO's Below Standard" count card that opens PO Progress.
- Saved: Device only.

### Phase Setup (/phase-setup), menu name "Assignments" for the Coordinator
- Roles: FTO (edit own phase folder), FTO Coordinator (edit and manage training assignments).
- Workflow: Step 1 of the paperwork. Enter the PO, class, phase, FTO assignment, shift and start date. The Coordinator also sees the Training Assignments panel to load or change assignments.
- Saved: Device only, with the assignment transition records on the agency server (assignment-transitions routes).

### Substation Orientation · U-10.181 (/substation-orientation)
- Roles: FTO (completes it), FTO Coordinator (read only, only if one is saved).
- Workflow: Required on the first scheduled day of each phase. If the FTO tries to start a shift before it exists, the portal sends them here first.
- Saved: Device only.

### Shifts & Runs, the daily shift record (/reports/new and /reports/:id)
- Roles: FTO edits drafts. PO can add PO comments only when the record is in the FTO-signed state. FTO Coordinator and others read only.
- Stages: Shift metadata · Reporting for Duty Form · Runs & forms · Activity (Daily Activity Summary) · SEG evaluation (ratings) · Narrative & comments.
- Runs: New run dialog (Call for Service, Self-Initiated Run / Training, Domestic Incident, Traffic Crash Investigation, Traffic Stop, High Risk Traffic Stop, Building Search, Arrest Process, OVI Process, Narrative Addition / Continuation), run checklists with PO FAILED TO selections, supplemental forms attach and detach, incident-number search across saved days, dispatch lookup prefill.
- Ratings: Unacceptable and Not Responding to Training need justification. Not Responding to Training opens the follow-up page. Officer Safety Unacceptable locks for the day. Checklist failures require Unacceptable in the mapped category.
- Actions: Save draft, Save and open next workday, Print daily log, Print narrative continuation, Delete draft.
- Saved: Device only (encrypted local vault), then sent to the agency server only through Packet Submissions finalize.

### Not Responding to Training follow-up (/reports/:id/nrt-follow-up)
- Roles: FTO edits while the record is a draft and the rating is Not Responding to Training. Others read only.
- Reached from: the SEG evaluation stage and the NRT / UA Portal. No menu item.
- Saved: Device only.

### Daily Records (/reports)
- Roles: FTO in the menu. FTO Coordinator reaches it from Home ("Find daily paperwork").
- Workflow: Search and filter saved Daily Performance Summaries (status, phase, shift, Unacceptable or Not Responding to Training only), saved incident search, packet transfer panel. Links to Weekly Performance Summary, Monthly Performance Summary, Weekly Packet Acknowledgement and Agency Packets.
- Saved: Device only.

### Weekly Packets (/reports/weekly-packet), menu name "Packet Monitor" for office roles
- FTO view: build one PO's weekly packet, print the full packet, send a Not Responding to Training review request to the Coordinator, Save local draft. "Sign and send to PO" is present but disabled.
- FTO Coordinator and FTO Sergeant view: Office weekly packet monitor across POs.
- Saved: Device only.

### Weekly Performance Summary · U-10.173 (/reports/weekly-summary)
- Roles: anyone in the FTO route set. Reached from Daily Records, Weekly Packets and the Weekly Performance Log. No menu item.
- Workflow: Week totals and rating counts, print. Open question: the print counts ratings from all Daily Performance Summaries, not only reviewed ones.

### Weekly Performance Log Supplement · U-10.174S (/reports/weekly-log)
- Roles: FTO edits. FTO Coordinator reads.
- Workflow: Gathers the week's Unacceptable articulations and corrective-training time. Reached from Weekly Packets and the Weekly Performance Summary.

### Monthly Performance Summary (/reports/monthly-summary)
- Roles: FTO route set. Reached from Daily Records and the Weekly Performance Summary.
- Workflow: Month totals and print.

### Weekly Packet Acknowledgement (/reports/weekly-ack)
- Roles: FTO route set. Reached from Home, Daily Records, the shift record and the Weekly Performance Summary.
- Workflow: Signature path draft, PO signed, FTO signed, office signed. Signature recording is disabled until server role, report-version and audit checks are connected.

### NRT / UA Portal (/nrt-ua)
- Roles: FTO and FTO Coordinator.
- Workflow: Lists reviewed Unacceptable ratings and opens the Not Responding to Training follow-up for each. Reached only from the shift record. No menu item.

### My PO's (FTO) or Classes & Rosters (Coordinator) (/class-overview)
- Roles: FTO (only their assigned POs), FTO Coordinator (all classes, and the only role that can export the class workbook).
- Workflow: Pick a class and PO, see records, ratings and activity, link to coverage.

### Class and Phase Sign-Up (FTO) or Post Class Phases (Coordinator) (/fto-classes)
- Roles: FTO signs up for posted phases. FTO Coordinator posts and closes class phases and reviews FTO interest.
- Reached from: Home and Coverage. No menu item.
- Saved: Device only.

### Coverage (/substitute-fto)
- Roles: FTO requests or offers coverage. FTO Coordinator sees coverage requests.
- Saved: Device only. Other FTOs are not notified.

### Packet Submissions (/packet-submissions), menu names "Packet Submission Inbox" (Coordinator) and "Packet Status" (PO)
- Roles: decided by the signed agency server role, not the preview role.
- PO: review own Unacceptable details and daily, weekly and monthly counts, then Confirm My Review. Only then does the packet reach the Coordinator.
- FTO Coordinator: Acknowledge Packet (receipt), Approve Packet, Return for Correction. Can reassign the Coordinator.
- FTO: read packets in assigned classes, Open Correction on own returned packets.
- Saved: Agency server (packet-review routes). This is the live two-stage submission path.

### Agency Packets (/agency-packets)
- Roles: FTO (read assigned classes, correct own returned packets), FTO Coordinator (approve, then release separately, or withdraw), PO (sees only packets released to them and records receipt).
- Saved: Agency server (training-packets release, withdraw and acknowledge routes).

### Submitted Packets, command review (/command-review)
- Roles: FTO COC (only page they have besides Help Desk).
- Status: Placeholder. It shows that no submitted packets are available and that review, export, printing, comments and return-for-review are unavailable.

### Help Desk (/resources)
- Roles: everyone.
- Workflow: Role-specific application help, Resources library (law library and reference files), Official directives link. Related links to Phase setup and Saved daily records are hidden for FTO COC.

### Account Settings (/settings)
- Roles: FTO and PO in the menu.
- Workflow: Operational profile (enter once, reused on daily headers; history kept on the agency server), local vault lock and unlock, reset local workspace.

### Account Access (/role-access) and Technical Access (/technical-access)
- PO: "First, confirm your access" page. This is the PO's landing page.
- POLICENET and POLICENET ADMIN — SGT: Technical role approval status only. No training records.

### Phase Competency Tasks (/training)
- Roles: FTO checks off tasks. Others read only.
- Status: Route exists, but no menu item or link points to it.

### FTO Forum (/fto-forum)
- Roles: FTO and FTO Coordinator. Messages are local drafts only.
- Status: Route exists, but no menu item or link points to it.

### Preview only (excluded from production)
- Phase Setup rebuild (/rebuild-phase-setup): FTO Coordinator and FTO Sergeant.
- PO Progress (/po-progress): FTO Coordinator and FTO Sergeant.
- Phase Sign-Up (/phase-sign-up): FTO.
- My Probationary Officer (/my-probationary-officer): FTO.
- Run checklist preview, approval preview, FTO test packet preview, fictional UI preview: development only.

## End-to-end workflows

1. Phase start (FTO): Phase Setup, then Substation Orientation on the first day, then the first shift record.
2. Daily paperwork (FTO): Shifts & Runs (Reporting for Duty, runs and checklists, Daily Activity Summary, SEG ratings, narrative). Save the draft on the device.
3. Unacceptable or Not Responding to Training (FTO): justification in the shift record, then the Not Responding to Training follow-up, then the NRT / UA Portal list, then a Not Responding to Training review request from Weekly Packets to the Coordinator.
4. Daily submission (FTO, PO, FTO Coordinator), live on the agency server: FTO finalizes, PO confirms their own counts in Packet Status, the Coordinator acknowledges receipt, then approves or returns for correction. A returned packet goes back to the FTO through Open Correction.
5. Release (FTO Coordinator, PO), live on the agency server: Coordinator releases the approved packet in Agency Packets, and the PO records receipt.
6. Weekly packet (FTO, office): Weekly Packets, Weekly Performance Summary, Weekly Performance Log Supplement, Weekly Packet Acknowledgement. Signing is disabled until the server checks are connected.
7. Monthly (FTO, office): Monthly Performance Summary and the class workbook export (Coordinator only).
8. Staffing (FTO, FTO Coordinator): Post class phases and sign-up, Coverage, Assignments. All device only today.
9. Command review (FTO COC): placeholder only.

## Gaps found while mapping

1. FTO COC Submitted Packets is a placeholder with no data source.
2. FTO Sergeant sees only Packet Monitor and Help Desk in production. Phase Setup and PO Progress for the Sergeant are preview only.
3. Phase Competency Tasks (/training) and FTO Forum (/fto-forum) have no menu item or link.
4. Weekly Packet "Sign and send to PO" and Weekly Packet Acknowledgement signatures are disabled until server checks exist.
5. Coverage, class phase posting and sign-up, and the FTO Forum are device only, so other users never see them.
6. The PO has no Home page; the landing page is Account Access.
7. Daily Records is not in the Coordinator's menu, only on Home.
8. Shift record statuses "FTO signed" and "PO signed" are labeled "Legacy status · signature not verified".
9. The printed Weekly Performance Summary counts unreviewed ratings (decision pending).
