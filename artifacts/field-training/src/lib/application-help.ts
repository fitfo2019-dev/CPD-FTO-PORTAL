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
};

export const APPLICATION_HELP_TOPICS: readonly ApplicationHelpTopic[] = [
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
    expectedResult: 'Imported names and assignments stay on this device until you save the workspace. Shift, days off, emails, and patrol assignment are optional. Import does not activate a phase or grant account access.',
    recovery: 'Correct any reported row errors in the file and import it again. Save locally to keep the roster on this device.',
  },
  {
    id: 'account-access',
    title: 'Activate an account',
    roles: ['po'],
    keywords: 'account sign in invitation activation class phase access',
    steps: [
      'Sign in with your approved staff account.',
      'Account activation is invitation-only; self-service sign-up is not available.',
      'Training records appear after the account, class, and phase access are confirmed.',
    ],
    expectedResult: 'An invitation is required before portal access is available.',
    recovery: 'If you do not have an invitation or your class is not active, follow your established department process.',
  },
  {
    id: 'packet-status',
    title: 'Check an agency packet action',
    roles: ['po', 'fto', 'fto_coordinator', 'fto_coc'],
    keywords: 'packet release withdrawal acknowledge pending refresh retry status',
    steps: [
      'After an action, check the packet status for confirmation.',
      'If the result is pending, refresh the packet list before retrying.',
      'Use the same retry action when one is shown.',
    ],
    expectedResult: 'A completed status confirms the action. Acknowledgment confirms receipt and review, not agreement or an electronic signature.',
    recovery: 'If the status remains unclear, refresh again before retrying. Withdrawal permanently closes a packet.',
  },
  {
    id: 'phase-request',
    title: 'Check a phase-extension request',
    roles: ['fto', 'fto_coordinator'],
    keywords: 'phase extension request local draft send coordinator approval submitted pending denied approved',
    steps: [
      'Submit the request after entering the extension type, number of weeks, and written justification.',
      'Check whether the request is awaiting Coordinator review or is still saved on this device.',
      'If a saved request is shown, use Send saved request when the service is available.',
    ],
    expectedResult: 'A request saved on this device is not submitted. Awaiting Coordinator review means the request was submitted.',
    recovery: 'If submission is not confirmed, keep the local draft and use Send saved request. Check the request status again before retrying.',
  },
];

export function getApplicationHelpTopicsForRole(role: Role): readonly ApplicationHelpTopic[] {
  if (role === 'fto' || role === 'fto_sgt' || role === 'fto_coordinator' || role === 'fto_coc') {
    return APPLICATION_HELP_TOPICS;
  }
  return APPLICATION_HELP_TOPICS.filter(topic =>
    topic.roles === 'all' || topic.roles.includes(role),
  );
}

export function getApplicationHelpTopicForRole(
  role: Role,
  topicId: string | null | undefined,
): ApplicationHelpTopic {
  const topics = getApplicationHelpTopicsForRole(role);
  return topics.find(topic => topic.id === topicId) ?? topics[0];
}
