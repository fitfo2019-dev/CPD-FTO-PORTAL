/**
 * Revision of our exported template, not the source agency form's issue date,
 * record date, export time, approval, or signature. Update only affected entries
 * when a form's wording/layout changes. Never derive this from Date.now().
 */
export const FORM_TEMPLATE_REVISIONS = {
  'U-10.173': '2026-11-24',
  'U-10.174': '2026-11-24',
  'U-10.174S': '2026-11-24',
  reporting_for_duty: '2026-11-24',
  'U-10.181': '2026-11-24',
  'U-10.182': '2026-11-24',
  'U-10.183': '2026-11-24',
  'U-10.184': '2026-11-24',
  'U-10.185': '2026-11-24',
  'U-10.186': '2026-11-24',
  'U-10.187': '2026-11-24',
  'U-10.188': '2026-11-24',
  'U-10.189': '2026-11-24',
  'U-10.190': '2026-11-24',
  'U-10.192': '2026-11-24',
  monthly_summary: '2026-11-24',
  monthly_workbook: '2026-11-24',
  weekly_acknowledgement: '2026-11-24',
} as const;

export function formTemplateRevision(form: string): string {
  const value = FORM_TEMPLATE_REVISIONS[form as keyof typeof FORM_TEMPLATE_REVISIONS];
  if (!value) throw new Error(`Register the template revision for ${form} before exporting it.`);
  const [year, month, day] = value.split('-');
  return `${month}/${day}/${year}`;
}
