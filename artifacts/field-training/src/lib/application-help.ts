import type { Role } from './model.js';

type ApplicationHelpAudience = 'all' | readonly Role[];

export type ApplicationHelpTopic = {
  id: string;
  title: string;
  roles: ApplicationHelpAudience;
  keywords: string;
  steps: readonly string[];
  expectedResult: string;
  recovery: string;
  /** FTO manual page the steps follow. Omitted for portal-only mechanics the manual does not cover. */
  manual?: string;
};

export type ApplicationHelpWorkflow = {
  id: string;
  title: string;
  roles: readonly Role[];
  manual?: string;
  /** Ordered steps; each links to the how-to that explains it. */
  steps: readonly { text: string; topic: string }[];
};

// Workflows and how-to's cover live screens only. Preview-only screens add their topics in preview builds.

export const APPLICATION_HELP_WORKFLOWS: readonly ApplicationHelpWorkflow[] = [
  {
    id: 'wf-fto-daily-packet',
    title: 'Document a shift and submit the Daily Packet',
    roles: ['fto'],
    manual: 'FTO Manual pp. 29-30, 56',
    steps: [
      { text: 'Start the shift from Daily Packet.', topic: 'fto-start-shift' },
      { text: 'First scheduled day of a phase: complete the Substation Orientation.', topic: 'fto-orientation' },
      { text: 'Complete the Reporting for Duty form.', topic: 'fto-reporting-duty' },
      { text: 'Document each run with its checklist forms and narrative.', topic: 'fto-runs' },
      { text: 'Enter the Daily Activity Summary totals.', topic: 'fto-activity' },
      { text: 'Rate the 38 performance categories, except on limbo days.', topic: 'fto-seg' },
      { text: 'Review the shift and save it on this device.', topic: 'local-save' },
      { text: 'Sync the draft, then Finalize and Submit to Coordinator.', topic: 'fto-finalize' },
    ],
  },
  {
    id: 'wf-fto-ua-review',
    title: "Review UA's and NRT's with the PO",
    roles: ['fto'],
    manual: 'FTO Manual p. 15, item 9',
    steps: [
      { text: "Before the next shift, open the previous Daily Performance Summary and go over every UA with the PO.", topic: 'fto-ua-review' },
      { text: 'For an NRT, contact the FTO Office immediately.', topic: 'fto-ua-review' },
      { text: "The PO confirms the review of their UA totals in My Training.", topic: 'packet-status' },
    ],
  },
  {
    id: 'wf-fto-correction',
    title: 'Correct a returned Daily Packet',
    roles: ['fto'],
    manual: 'FTO Manual p. 31',
    steps: [
      { text: 'Open the returned packet from Packet Submissions.', topic: 'fto-correction' },
      { text: 'Open the correction, make the changes and save.', topic: 'fto-correction' },
      { text: 'Sync and finalize the corrected packet again.', topic: 'fto-finalize' },
    ],
  },
  {
    id: 'wf-fto-weekly-packet',
    title: 'Prepare the Weekly Packet',
    roles: ['fto'],
    manual: 'FTO Manual p. 15, item 10; pp. 30, 47',
    steps: [
      { text: 'Finalize every Daily Performance Summary for the week.', topic: 'fto-finalize' },
      { text: 'Open Weekly Packets, choose the PO and week, and review each part.', topic: 'fto-weekly-packet' },
      { text: 'Write the FTO comment and save the draft.', topic: 'fto-weekly-packet' },
      { text: 'Phase IV, Week 15: record the release recommendation.', topic: 'fto-week15' },
    ],
  },
  {
    id: 'wf-fto-coverage',
    title: 'Arrange coverage for a day off',
    roles: ['fto'],
    manual: 'FTO Manual p. 14, item 4; p. 15, item 13',
    steps: [
      { text: 'Find an alternate FTO, or contact the FTO Office for help.', topic: 'fto-coverage' },
      { text: 'Record the coverage request in Day-Off Coverage.', topic: 'fto-coverage' },
    ],
  },
  {
    id: 'wf-coord-daily-review',
    title: 'Review submitted Daily Packets',
    roles: ['fto_coordinator'],
    manual: 'FTO Manual p. 8',
    steps: [
      { text: 'Open the packet from the Review Desk.', topic: 'coord-review-desk' },
      { text: 'Acknowledge the packet to record receipt.', topic: 'coord-review-desk' },
      { text: 'Approve it, or return it for correction with a note.', topic: 'coord-review-desk' },
    ],
  },
  {
    id: 'wf-coord-phase-setup',
    title: 'Set up a class phase',
    roles: ['fto_coordinator'],
    manual: 'FTO Manual p. 7',
    steps: [
      { text: 'Import the roster on Assignments.', topic: 'roster-import' },
      { text: 'Save the phase folder for each PO.', topic: 'coord-assignments' },
      { text: 'Post open class phases for FTO sign-up.', topic: 'coord-phase-postings' },
    ],
  },
  {
    id: 'wf-coord-reports',
    title: 'Monitor PO progress and reports',
    roles: ['fto_coordinator'],
    manual: 'FTO Manual p. 8',
    steps: [
      { text: "Check the Coordinator Dashboard and Probationary Officers.", topic: 'coord-pos' },
      { text: 'Review Weekly Packets and their alerts.', topic: 'office-weekly-packets' },
      { text: 'Export a Monthly Report workbook.', topic: 'coord-monthly' },
    ],
  },
  {
    id: 'wf-sgt-monitor',
    title: 'Monitor training and alerts',
    roles: ['fto_sgt'],
    manual: 'FTO Manual p. 7',
    steps: [
      { text: 'Review open alerts on the Sergeant Dashboard.', topic: 'sgt-dashboard' },
      { text: 'Review Weekly Packets for problems or negative patterns.', topic: 'office-weekly-packets' },
    ],
  },
  {
    id: 'wf-po-review',
    title: 'Review your Daily Performance Summary',
    roles: ['po'],
    manual: 'FTO Manual p. 15, item 9',
    steps: [
      { text: 'Go over every UA with your FTO before your next shift.', topic: 'po-review-sign' },
      { text: 'Open the packet in My Training under Review and Sign.', topic: 'po-review-sign' },
      { text: 'Review your UA totals and confirm your review.', topic: 'po-review-sign' },
    ],
  },
  {
    id: 'wf-coc-review',
    title: 'Review submitted packets',
    roles: ['fto_coc'],
    manual: 'FTO Manual p. 15, item 10',
    steps: [
      { text: 'Open Submitted Packets to see packets forwarded for command review.', topic: 'coc-submitted-packets' },
    ],
  },
];

// PO Progress is a development preview; its status definitions ship with it.
const PO_PROGRESS_TOPICS: readonly ApplicationHelpTopic[] = [
  {
    id: 'po-status',
    title: "Read a PO's progress status",
    roles: ['fto_coordinator', 'fto_sgt'],
    keywords: 'PO Progress status below standard emerging concern meets standard NRT UA previously flagged',
    steps: [
      "Each rated week is banded by the UA's on the signed daily records.",
      "MEETS STANDARD: 0-9 UA's in the week.",
      "EMERGING CONCERN: 10-19 UA's in the week.",
      "BELOW STANDARD: 20 or more UA's, 3 or more UA's in one category, or an NRT in the week.",
      'A worse week raises the status to that band. Each rated week that meets standard lowers it one level. A flag can last the whole program.',
      'Limbo weeks are not rated and do not count. Late packets count toward the FTO, not the PO.',
    ],
    expectedResult: 'SHOW CALCULATION in the PO panel lists every rated week, its band and the status after it, with the formula version. A PO who cleared a flag shows a PREVIOUSLY FLAGGED tag with the week it cleared. Status is based on documented ratings; it is not a release recommendation.',
    recovery: 'If a status looks wrong, open the PO and check the week strip and the category ratings for each rated week.',
    manual: 'FTO Manual p. 15, item 9',
  },
];

export const APPLICATION_HELP_TOPICS: readonly ApplicationHelpTopic[] = [
  // Shared by every role.
  {
    id: 'local-save',
    title: 'Save and reopen a local draft',
    roles: 'all',
    keywords: 'save locally passphrase encrypted unlock reopen',
    steps: [
      'Choose Save locally. Create a passphrase if this is your first save.',
      'To continue later on this device, choose Unlock saved work and enter that passphrase.',
    ],
    expectedResult: 'The last successful save is encrypted on this device. It is not uploaded.',
    recovery: 'If saving fails, keep the page open and retry. Do not leave until the save succeeds.',
  },
  {
    id: 'record-status',
    title: 'Check record status',
    roles: 'all',
    keywords: 'unsaved saved pending uploaded server confirmed online offline',
    steps: [
      'Unsaved changes remain on screen only.',
      'Saved locally means the draft is on this device.',
      'Pending means no server confirmation has been received.',
      'Server-confirmed means the service confirmed the record.',
    ],
    expectedResult: 'Online or offline describes the connection. It does not confirm a save or submission.',
    recovery: 'If no confirmation appears, do not treat the record as submitted. Refresh its status before retrying.',
  },
  {
    id: 'use-resources',
    title: 'Use Resources',
    roles: ['fto', 'fto_coordinator', 'fto_sgt', 'po', 'fto_coc'],
    keywords: 'resources charging lookup complaint wording map cruiser districts law handbook library directives',
    steps: [
      'Charging lookup: search an offense to see its level, elements and complaint wording. Copy unlocks after every element is checked.',
      'Cruiser district map: open the interactive map, or use Open Original Map if it does not load.',
      'Law handbook and library: open signed-in files and official division directive PDFs.',
      'Official directives opens the division directive index.',
    ],
    expectedResult: 'Reference material opens from official agency sources.',
    recovery: 'Confirm current geography, assignments and policy through official agency sources.',
  },
  {
    id: 'account-settings',
    title: 'Use Account Settings',
    roles: ['fto', 'fto_coordinator', 'po'],
    keywords: 'account settings local queue encrypted storage unsent records device',
    steps: [
      'Open Account Settings to see the device status and the count of unsent local records.',
      "PO's open it from the account area: the sidebar foot on a computer, or the settings button at the top on a phone.",
    ],
    expectedResult: 'The local queue is encrypted on this device and is not uploaded.',
    recovery: 'Persistent storage reduces automatic browser clean-up, but it cannot protect against clearing site data, device loss or storage failure.',
  },

  // FTO
  {
    id: 'fto-start-shift',
    title: 'Start a shift',
    roles: ['fto'],
    keywords: 'start shift daily packet date time cruiser unit number phase folder',
    steps: [
      'On Daily Packet, choose Start Shift.',
      'On the Shift stage, confirm the PO, the date (MM/DD/YYYY) and the actual start time (24-hour HH:MM). Enter ? then press Tab for the current date and time.',
      'Enter the cruiser. When using a relief car, enter the unit number, not the cruiser number.',
      'Your name and badge come from the phase assignment.',
    ],
    expectedResult: 'The shift opens with six stages: Shift, Reporting for Duty, Runs & forms, Activity, SEG evaluation, and Narrative & comments.',
    recovery: 'If the PO or your assignment is missing, ask the FTO Coordinator to confirm the roster assignment.',
    manual: 'FTO Manual p. 56, items 4-5',
  },
  {
    id: 'fto-orientation',
    title: 'Complete the Substation Orientation',
    roles: ['fto'],
    keywords: 'substation orientation first day phase walkthrough checklist',
    steps: [
      'Complete it once per phase, on the first day of training, directly after roll call.',
      'Enter the substation number, then press Tab or Enter to show its details.',
      'Every item starts checked. Clear any item not covered, and any equipment the PO did not have, and explain it in the narrative.',
      'List the directives and SOP reviewed and any training given at the substation.',
      'Confirm the review below the checklist, then save.',
    ],
    expectedResult: 'Review confirmed shows after you confirm. Any later edit clears the confirmation.',
    recovery: 'If the orientation is not saved, the shift cannot continue past the phase-start packet.',
    manual: 'FTO Manual p. 60',
  },
  {
    id: 'fto-reporting-duty',
    title: 'Complete the Reporting for Duty form',
    roles: ['fto'],
    keywords: 'reporting for duty roll call cruiser inspection appearance limbo alternate non-FTO training sick',
    steps: [
      'Complete it every day as page 1, even when the PO did not work patrol.',
      'Check a box only when the PO completed the task acceptably. Leave it unchecked and explain in the narrative when not acceptable. Leave it unchecked when not applicable.',
      'Note a limbo day, an alternate FTO or a non-FTO officer, and any training the PO attended with its hours.',
      'Confirm that you reviewed the duty checklist.',
    ],
    expectedResult: "The form accounts for the PO's whereabouts for the day.",
    recovery: 'If the PO was off or in training, still complete the form and state the reason.',
    manual: 'FTO Manual p. 56',
  },
  {
    id: 'fto-runs',
    title: 'Document a run',
    roles: ['fto'],
    keywords: 'new run call for service self-initiated checklist form arrest OVI building search incident number',
    steps: [
      'On Runs & forms, choose New run. Work one run at a time.',
      'Choose the run type and enter the incident number, date and times so they match CAD.',
      'Complete the primary checklist form, then any attached forms, such as Arrest Process or OVI Process.',
      'Check a box only when acceptable. Leave it unchecked and articulate the deficient performance and the corrective training in the narrative.',
      'Write the run narrative, then choose Ready for the next run.',
    ],
    expectedResult: 'The run appears in the daily log with its sheets.',
    recovery: 'An open run is held on screen only. Add or discard it before leaving the stage.',
    manual: 'FTO Manual p. 63',
  },
  {
    id: 'fto-narrative',
    title: 'Write a run narrative',
    roles: ['fto'],
    keywords: 'narrative run summary UA articulation corrective training abbreviations',
    steps: [
      'Open with a brief description of the call.',
      'Articulate each unacceptable performance.',
      'Document the corrective training given.',
      'Do not use abbreviations except FTO and PO.',
    ],
    expectedResult: 'Every run has a complete narrative before the shift can be finalized.',
    recovery: 'An unfinished narrative blocks Finalize. Open the run and complete it.',
    manual: 'FTO Manual pp. 30, 63',
  },
  {
    id: 'fto-activity',
    title: 'Enter the Daily Activity Summary',
    roles: ['fto'],
    keywords: 'activity summary totals tally limbo',
    steps: [
      'On the Activity stage, enter a numerical total for every task performed.',
      'Complete it every day of training, including limbo days.',
    ],
    expectedResult: 'Daily totals carry into the Weekly Performance Summary.',
    recovery: 'Correct a total on the Activity stage before you finalize.',
    manual: 'FTO Manual p. 33, item 7',
  },
  {
    id: 'fto-seg',
    title: 'Rate the performance categories',
    roles: ['fto'],
    keywords: 'SEG evaluation rating acceptable responding unacceptable NRT not observed limbo',
    steps: [
      'On SEG evaluation, rate each of the 38 categories using the Standard Evaluation Guidelines. Only one rating per category.',
      'Responding to Training cannot be used in Officer Safety or Driving Skills.',
      'Support every UA and NRT with documentation and corrective training in the narrative.',
      'On a limbo day, leave all categories blank.',
    ],
    expectedResult: 'Ratings feed the Weekly Performance Summary and the Weekly Performance Log.',
    recovery: 'Use Review before submission to find missing ratings.',
    manual: 'FTO Manual pp. 18, 29, 33',
  },
  {
    id: 'fto-finalize',
    title: 'Finalize and Submit to Coordinator',
    roles: ['fto'],
    keywords: 'finalize submit coordinator sync draft sealed daily records two-stage',
    steps: [
      'Save the shift locally.',
      'On Daily Records, choose Sync Editable Drafts. A synced draft stays editable and is not a submission.',
      'Choose Finalize and Submit to Coordinator, check the box confirming you reviewed the exact snapshot, and confirm.',
    ],
    expectedResult: "The packet shows Submitted · Sealed. The PO reviews their UA totals next, then the packet reaches the Coordinator's Review Desk.",
    recovery: 'If finalization is unconfirmed, choose Retry Finalization. If the snapshot changed, sync the current draft and review it again.',
    manual: 'FTO Manual p. 29',
  },
  {
    id: 'fto-daily-records',
    title: 'Use Daily Records',
    roles: ['fto'],
    keywords: 'daily records refresh shared records filters find run incident number not loaded',
    steps: [
      'Each record covers one shift and holds its duty, run, activity and evaluation forms. Open a saved record to review or continue it.',
      'Save Locally writes to the encrypted vault on this device. A separate draft sync may follow when online. Saving never submits or finalizes a packet.',
      'Only the assigned FTO can sync or finalize a packet. Synced drafts stay hidden from the Coordinator and PO until finalized.',
      'Choose Refresh Shared Records to load authorized copies. Refresh never uploads, replaces or merges local drafts, and loads up to 100 records at a time.',
      'Date filters include both end dates. Applying filters starts a new search from the newest matching packet.',
    ],
    expectedResult: 'Not Loaded means shared records have not been requested yet.',
    recovery: 'If shared records do not load, local drafts are unchanged. Refresh again.',
  },
  {
    id: 'fto-correction',
    title: 'Correct a returned packet',
    roles: ['fto'],
    keywords: 'correction returned coordinator note open correction resubmit',
    steps: [
      'Open Packet Submissions and select the packet the Coordinator returned.',
      "Read the Coordinator's note, then choose Open Correction.",
      'Make the changes, save locally, then sync and finalize again.',
    ],
    expectedResult: 'The corrected packet goes back through PO review to the Coordinator.',
    recovery: 'Only the assigned FTO can correct their own returned packet.',
    manual: 'FTO Manual p. 31',
  },
  {
    id: 'fto-ua-review',
    title: "Review UA's and NRT's with the PO",
    roles: ['fto'],
    keywords: 'UA NRT review next shift training plan FTO Office notify',
    steps: [
      'By the beginning of the next shift, open the previous Daily Performance Summary from Daily Records and review each UA with the PO.',
      'Make the PO aware of consistent UA or NRT ratings and agree on a training plan.',
      'For an NRT in any category, contact the FTO Office immediately.',
    ],
    expectedResult: 'The PO confirms the review of their UA totals in My Training.',
    recovery: 'The NRT review request on Weekly Packets is saved on this device only. Contact the FTO Office directly.',
    manual: 'FTO Manual p. 15, item 9; p. 19',
  },
  {
    id: 'fto-weekly-packet',
    title: 'Prepare the Weekly Packet',
    roles: ['fto'],
    keywords: 'weekly packet summary log comment signature due print',
    steps: [
      'Open Weekly Packets and choose the PO and the week (Sunday through Saturday).',
      'Check each part: Weekly Comment/Signature, Weekly Performance Summary, Weekly Performance Log, Daily Performance Summaries and Daily Checklist Forms.',
      "Write the FTO comment on the PO's overall performance and any concerns, then choose Save local draft.",
      'Use Print full packet for a complete copy.',
    ],
    expectedResult: 'The Due box shows the deadline, 3 days after the end of the week.',
    recovery: 'A Missing chip lists days without a Daily Performance Summary. Complete them before the due date.',
    manual: 'FTO Manual p. 15, item 10; pp. 30, 47',
  },
  {
    id: 'fto-week15',
    title: 'Record the Week 15 recommendation',
    roles: ['fto'],
    keywords: 'week 15 recommendation release not release phase IV',
    steps: [
      'In Phase IV, open the Week 15 recommendation panel on Weekly Packets.',
      'Choose Release or Not release. The manual wording is filled in for the FTO comment.',
      'Before recommending Not release, notify the FTO Office in advance.',
    ],
    expectedResult: 'The choice and its history show in the panel.',
    recovery: 'Contact the FTO Office directly for a Not release; the alert is saved on this device only.',
    manual: 'FTO Manual p. 48',
  },
  {
    id: 'fto-coverage',
    title: 'Request day-off coverage',
    roles: ['fto'],
    keywords: 'coverage substitute alternate FTO day off request',
    steps: [
      'Finding an alternate FTO is your responsibility. Contact the FTO Office for help.',
      'On Day-Off Coverage, enter when coverage starts and ends and a reason, then choose Save Request Locally.',
      'The alternate FTO completes the Daily Performance Summary and forwards it to you.',
    ],
    expectedResult: 'The request is listed under My Coverage Requests on this device.',
    recovery: "Other FTO's are not notified by the portal and cannot accept or decline here. Do not begin substitute work until the covering FTO has accepted and the Coordinator confirms the assignment.",
    manual: 'FTO Manual p. 14, item 4; p. 15, item 13',
  },
  {
    id: 'fto-my-pos',
    title: "Use My PO's",
    roles: ['fto'],
    keywords: "my PO's class overview UA NRT follow-up workbook export",
    steps: [
      "Only PO's assigned to your department email appear.",
      'Filter by class or PO, or show UA / NRT follow-up.',
      "The roster lists PO's even before they have daily records.",
      'Substitute coverage creates a new day without changing the regular FTO assignment.',
      'Workbook export uses only the filtered records on this device. Export does not send records to a server.',
    ],
    expectedResult: "Your PO's and their saved records are listed.",
    recovery: 'If the list shows None, ask the FTO Coordinator to import the roster.',
  },
  {
    id: 'shift-sheet',
    title: 'Leave an edited shift sheet',
    roles: ['fto'],
    keywords: 'leave close navigate unsaved changes warning stay report',
    steps: [
      'Save the draft locally before leaving, or stay on the page and finish your edits.',
      'If warned, choose Stay and keep working to return to the sheet.',
    ],
    expectedResult: 'Leaving without saving does not keep edits that are still on screen.',
    recovery: 'If you already left, reopen the last successful local draft. Unsaved edits cannot be restored.',
  },
  {
    id: 'phase-request',
    title: 'Check a phase-extension request',
    roles: ['fto', 'fto_coordinator'],
    keywords: 'phase extension request local draft send coordinator approval submitted pending denied approved',
    steps: [
      'FTO: enter the extension type, number of weeks and written justification, then submit.',
      'Coordinator: approve or deny each request on the dashboard.',
      'If a saved request is shown, use Send saved request when the service is available.',
    ],
    expectedResult: 'A request saved on this device is not submitted. Awaiting Coordinator review means the request was submitted.',
    recovery: 'If submission is not confirmed, keep the local draft and use Send saved request. Check the request status again before retrying.',
  },

  // FTO Coordinator
  {
    id: 'coord-review-desk',
    title: 'Review a Daily Packet',
    roles: ['fto_coordinator'],
    keywords: 'review desk acknowledge approve return correction note packet',
    steps: [
      "Open the packet on the Review Desk. Packets arrive after the PO confirms their review.",
      'Choose Acknowledge Packet to record receipt. Acknowledgement is not approval.',
      'Choose Approve Packet to mark it complete, or Return for Correction and write the note the FTO must follow.',
    ],
    expectedResult: 'Approved packets show Complete. Returned packets go back to the FTO.',
    recovery: 'If an action fails, refresh the packet before retrying. No records are changed by a failed action.',
    manual: 'FTO Manual p. 8',
  },
  {
    id: 'coord-reassign',
    title: 'Reassign a PO to another Coordinator',
    roles: ['fto_coordinator'],
    keywords: 'coordinator assignments reassign PO',
    steps: [
      'On the Review Desk, find the PO under Coordinator Assignments.',
      'Choose Reassign to, pick the Coordinator, then Confirm Reassignment.',
    ],
    expectedResult: "The PO's packets route to the new Coordinator.",
    recovery: 'You can reassign only PO\u2019s currently assigned to you.',
  },
  {
    id: 'roster-import',
    title: 'Import a roster',
    roles: ['fto_coordinator'],
    keywords: 'roster import csv xlsx excel docx word template assignment fto po',
    steps: [
      'Download the CSV template, or choose a CSV, Excel XLSX, or Word DOCX table with a header row. Files can be up to 2 MB.',
      'Include class, PO name and badge, FTO name and badge, and phase start date. Phase defaults to Phase I when omitted.',
      'Use one row per PO assignment. Repeating an FTO badge reuses that FTO record; a row with blank PO fields adds an FTO only.',
      'For 80C-1 or 80C-2, include Zone, Precinct, Shift, and the mapped Cruiser District.',
      'Review the import preview, correct errors, then add the roster to this device.',
    ],
    expectedResult: "Imported names and assignments stay on this device until you save the workspace. Shift, days off, emails, and patrol assignment are optional. Import does not activate phases, invite PO's, confirm roles or make the roster official.",
    recovery: 'Correct any reported row errors in the file and import it again. Save locally to keep the roster on this device.',
    manual: 'FTO Manual p. 7',
  },
  {
    id: 'coord-assignments',
    title: 'Save a phase folder',
    roles: ['fto_coordinator'],
    keywords: 'assignments phase setup folder week dates email draft',
    steps: [
      'On Assignments, choose the PO phase and confirm the PO, the assigned FTO, shift, zone, precinct and cruiser district.',
      'Check the phase week dates. Each week runs Sunday through Saturday with no gaps. The dates set the workbook phase-week tabs; extra approved weeks are included with Week 4.',
      'The universal FTO assignment is an owner-requested option, not an SOP requirement.',
      'Choose Save and open phase folder.',
      'Use the email draft to notify the PO and FTO from your email app.',
    ],
    expectedResult: 'New shifts use the folder values. Saved records keep their original values.',
    recovery: 'Add both PO and FTO emails to enable the email draft.',
    manual: 'FTO Manual pp. 7, 16',
  },
  {
    id: 'coord-phase-postings',
    title: 'Post class phases for sign-up',
    roles: ['fto_coordinator'],
    keywords: 'phase postings class phase start date sign-up',
    steps: [
      'On Phase Postings, enter the class and the phase start date, then choose Save phase posting locally.',
      "Unfilled PO assignments shows how many PO's still need an FTO.",
    ],
    expectedResult: 'The posting is saved on this device.',
    recovery: "FTO's are not notified by the portal. Share the posting through the FTO Office.",
  },
  {
    id: 'coord-pos',
    title: "Review Probationary Officers",
    roles: ['fto_coordinator'],
    keywords: 'probationary officers class overview dashboard FTO directory',
    steps: [
      "The Coordinator Dashboard shows FTO's training, finalized Daily Performance Summaries and PO's below standard.",
      'Probationary Officers lists each PO by class with UA / NRT follow-up.',
      "FTO Directory shows each FTO's PO's trained and phases covered.",
    ],
    expectedResult: 'Counts come from saved and finalized records.',
    recovery: 'If a PO is missing, import or update the roster.',
    manual: 'FTO Manual p. 8',
  },
  {
    id: 'coord-monthly',
    title: 'Export a Monthly Report',
    roles: ['fto_coordinator'],
    keywords: 'monthly report summary export excel workbook',
    steps: [
      'Open Monthly Reports, choose the PO and month.',
      'Choose Export Excel.',
    ],
    expectedResult: 'The monthly workbook downloads.',
    recovery: 'If the workbook cannot be created, saved daily records are unchanged. Try again.',
  },
  {
    id: 'coord-agency-packets',
    title: 'Use Agency Packets',
    roles: ['fto_coordinator', 'fto'],
    keywords: 'agency packets approve release withdraw read-only',
    steps: [
      "Coordinator: packets arrive after the PO reviews their own UA details and counts. Acknowledge receipt, approve, then release separately. Receipt is separate from approval and release.",
      'Coordinator: withdrawal permanently closes a packet and cannot be undone.',
      'FTO: read submitted packets for your assigned classes. You can correct only your own returned packets.',
      'Access is limited by the agency server to your authorized training classes. Drafts and withdrawn packets stay hidden.',
    ],
    expectedResult: 'Packet state and your role come only from the agency server.',
    recovery: 'If a packet snapshot is unavailable, refresh. No packet state is changed.',
  },
  {
    id: 'packet-status',
    title: 'Check a packet action',
    roles: ['po', 'fto', 'fto_coordinator', 'fto_coc'],
    keywords: 'packet acknowledge review confirm pending refresh retry status',
    steps: [
      'After an action, check the packet status for confirmation.',
      'If the result is pending, refresh the packet list before retrying.',
      'Use the same retry action when one is shown.',
    ],
    expectedResult: 'A completed status confirms the action. Acknowledgment confirms receipt and review, not agreement or an electronic signature.',
    recovery: 'If the status remains unclear, refresh again before retrying. Withdrawal permanently closes a packet.',
  },
  {
    id: 'office-weekly-packets',
    title: 'Review Weekly Packets',
    roles: ['fto_coordinator', 'fto_sgt'],
    keywords: 'weekly packets office NRT review request not release alerts',
    steps: [
      'Open Weekly Packets to see each PO\u2019s weekly packet and its alerts.',
      'Review packets for program guidelines, goals, problems and negative patterns.',
    ],
    expectedResult: 'NRT review requests and Not release recommendations are listed as alerts.',
    recovery: 'Alerts are saved on the device where they were created. Confirm with the FTO directly.',
    manual: 'FTO Manual pp. 7-8',
  },

  // FTO Sergeant
  {
    id: 'sgt-dashboard',
    title: 'Use the Sergeant Dashboard',
    roles: ['fto_sgt'],
    keywords: 'sergeant dashboard alerts NRT non-release withdrawal close alert',
    steps: [
      'Review the counts for open NRT, Non-Release and FTO Withdrawals.',
      'Open an alert to see the PO, then choose Close alert once it is handled.',
      'Closed alerts stay listed under Closed.',
    ],
    expectedResult: 'Each alert links to the PO it concerns.',
    recovery: 'Alerts are saved on the device where they were created. Confirm with the FTO or Coordinator directly.',
    manual: 'FTO Manual p. 7',
  },
  {
    id: 'fto-sergeant-access',
    title: 'Understand FTO Sergeant access',
    roles: ['fto_sgt'],
    keywords: 'FTO Sergeant assigned class monitoring assignment management Coordinator COC scope',
    steps: [
      'Use class-monitoring or assignment-management actions only when they are enabled for your assigned scope.',
      'Coordinator roster controls and COC packet review are separate roles.',
    ],
    expectedResult: 'FTO Sergeant access does not include editing narratives, ratings, or statistics by default.',
    recovery: 'If an expected action is unavailable, confirm the assigned scope with the authorized Coordinator.',
  },

  // PO
  {
    id: 'po-review-sign',
    title: 'Review and confirm your UA totals',
    roles: ['po'],
    keywords: 'my training review and sign confirm my review UA totals packet',
    steps: [
      'Go over every UA with your FTO by the beginning of your next shift.',
      'In My Training, open the packet under Review and Sign.',
      'Review your UA details and totals, then choose Confirm My Review.',
    ],
    expectedResult: 'Your review is recorded and the packet goes to your Coordinator.',
    recovery: 'If your summary does not load, retry or contact your training Coordinator.',
    manual: 'FTO Manual p. 15, item 9',
  },
  {
    id: 'account-access',
    title: 'Activate an account',
    roles: ['po'],
    keywords: 'account sign in invitation activation class phase access',
    steps: [
      'Sign in with your approved staff account.',
      'Account activation is invitation-only; self-service sign-up is not available.',
      'Verify your department email and confirm your class assignment.',
      'My Training opens after your class and phase are activated.',
    ],
    expectedResult: 'An invitation is required before portal access is available.',
    recovery: 'If you do not have an invitation or your class is not active, follow your established department process.',
  },

  // FTO COC
  {
    id: 'coc-submitted-packets',
    title: 'Use Submitted Packets',
    roles: ['fto_coc'],
    keywords: 'FTO COC command review submitted packets queue',
    steps: [
      'Packets forwarded for command review appear in Your Review Queue.',
      'Only completed and submitted packets belong in this queue. Drafts and unfinished packets never appear here.',
    ],
    expectedResult: 'None means no packet has been forwarded to you.',
    recovery: 'Packet review, export, printing, comments and return-for-review are not available yet.',
    manual: 'FTO Manual p. 15, item 10',
  },

  // PoliceNet
  {
    id: 'page-technical-access',
    title: 'Technical access notes',
    roles: ['policenet', 'policenet_admin_sgt'],
    keywords: 'POLICENET technical access prepare test delete records two approvals SGT LT boundary',
    steps: [
      'POLICENET staff prepare and test technical changes. Plan the change, then use an approved test environment.',
      'Deleting training records requires separate approval from a POLICENET admin with SGT rank and one with LT rank. This portal does not offer deletion.',
      'The two-person rule applies only to deleting training records. It does not apply to other technical work.',
      'Technical roles cannot change training judgments or bypass operational access rules.',
    ],
    expectedResult: 'Technical roles cannot open operational training records.',
    recovery: 'If approved test tools are needed, request them through your established POLICENET process.',
  },
  ...(import.meta.env?.DEV ? PO_PROGRESS_TOPICS : []),
];

const forRole = (audience: ApplicationHelpAudience, role: Role) => audience === 'all' || audience.includes(role);

export function getApplicationHelpTopicsForRole(role: Role): readonly ApplicationHelpTopic[] {
  return APPLICATION_HELP_TOPICS.filter(topic => forRole(topic.roles, role));
}

export function getApplicationHelpWorkflowsForRole(role: Role): readonly ApplicationHelpWorkflow[] {
  return APPLICATION_HELP_WORKFLOWS.filter(workflow => workflow.roles.includes(role));
}

export function getApplicationHelpTopicForRole(
  role: Role,
  topicId: string | null | undefined,
): ApplicationHelpTopic {
  const topics = getApplicationHelpTopicsForRole(role);
  return topics.find(topic => topic.id === topicId) ?? topics[0];
}
