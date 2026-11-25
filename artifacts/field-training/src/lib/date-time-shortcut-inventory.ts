import type { ShortcutKind } from './date-time-shortcut.js';

/** Record-entry controls, including conditional run dialogs and repeated week rows. */
export const DATE_TIME_SHORTCUT_FIELDS: ReadonlyArray<{
  file: string; testId: string; kind: ShortcutKind; fixedDate?: boolean;
}> = [
  {file:'pages/report-editor.tsx',testId:'input-date',kind:'date'},
  {file:'pages/report-editor.tsx',testId:'input-shift-start-time',kind:'time'},
  {file:'pages/report-editor.tsx',testId:'input-run-date',kind:'date'},
  {file:'pages/report-editor.tsx',testId:'input-run-time',kind:'time'},
  {file:'pages/report-editor.tsx',testId:'input-run-dispatched-at',kind:'datetime'},
  {file:'pages/report-editor.tsx',testId:'input-run-cleared-at',kind:'datetime'},
  {file:'components/new-run-dialog.tsx',testId:'input-review-occurred',kind:'datetime'},
  {file:'components/new-run-dialog.tsx',testId:'input-review-dispatched-at',kind:'datetime'},
  {file:'components/new-run-dialog.tsx',testId:'input-review-cleared-at',kind:'datetime'},
  {file:'pages/substation-orientation.tsx',testId:'input-orientation-datetime',kind:'datetime',fixedDate:true},
  {file:'pages/substitute-fto.tsx',testId:'input-coverage-start',kind:'datetime'},
  {file:'pages/substitute-fto.tsx',testId:'input-coverage-end',kind:'datetime'},
  {file:'pages/phase-setup.tsx',testId:'input-phase-start',kind:'date'},
  {file:'pages/phase-setup.tsx',testId:'input-phase-week-${index+1}-start',kind:'date'},
  {file:'pages/phase-setup.tsx',testId:'input-phase-week-${index+1}-end',kind:'date'},
  {file:'pages/fto-classes.tsx',testId:'input-fto-post-start-date',kind:'date'},
];

// Not record timestamps: packet-history native date filters, weekly training
// duration (minutes), calculated week selectors, printed dates, signature audit
// timestamps, and raw narrative/charge text intentionally keep their own behavior.
