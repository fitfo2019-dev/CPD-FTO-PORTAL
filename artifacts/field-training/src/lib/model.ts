export type Rating = 'NO'|'A'|'RT'|'UA'|'NRT'|'';
export const CATEGORIES = ['appearance','attitude','knowledge','performance','relationships'] as const;
export type Category = typeof CATEGORIES[number];
export const CATEGORY_LABEL: Record<Category,string> = { appearance:'Appearance', attitude:'Attitude', knowledge:'Knowledge', performance:'Performance', relationships:'Relationships' };
export const CATEGORY_HINT: Record<Category,string> = {
  appearance:'Uniform, equipment, grooming, bearing',
  attitude:'Acceptance of feedback, motivation, ethics',
  knowledge:'Policy, statutes, geography, procedure',
  performance:'Officer safety, driving, report writing, tactics',
  relationships:'Public, peers, supervisors, community',
};
export const RATINGS: Exclude<Rating,''>[] = ['NO','A','RT','UA','NRT'];
export const RATING_NAME: Record<Exclude<Rating,''>,string> = { NO:'Not Observed', A:'Acceptable', RT:'Responding to Training', UA:'Unacceptable', NRT:'Not Responding to Training' };
export const ratingLabel = (r: Rating) => r || '—';
export const needsJustification = (r: Rating) => r==='UA'||r==='NRT';
export const isBelowStandard = (r: Rating) => r==='UA'||r==='NRT';
export const isValidRating = (v: unknown): v is Rating => v === '' || (RATINGS as string[]).includes(v as string);
/** Returns report numbers whose ratings are not in the letter scale (e.g. legacy numeric). Never converts. */
export function findInvalidRatings(reports: Report[]): string[] {
  return reports.filter(r => !r.ratings || CATEGORIES.some(c => !r.ratings[c] || !isValidRating(r.ratings[c].rating))).map(r => r.number || r.id);
}
export type Role = 'fto'|'recruit'|'sergeant'|'admin';
export const ROLES: Role[] = ['fto','recruit','sergeant','admin'];
export const ROLE_LABEL: Record<Role,string> = { fto:'FTO', recruit:'Recruit', sergeant:'Sergeant', admin:'Admin' };
export type Phase = 1|2|3|4|5;
export const PHASES: Phase[] = [1,2,3,4,5];
export const phaseLabel = (p: Phase) => p === 5 ? 'Shadow phase' : 'Phase ' + p;
export type Status = 'draft'|'fto_signed'|'recruit_signed'|'locked';
export const STATUS_LABEL: Record<Status,string> = { draft:'Draft', fto_signed:'FTO signed', recruit_signed:'Recruit acknowledged', locked:'Locked' };
export interface Signature { name: string; badge: string; at: string; }
export interface Report {
  id: string; number: string; date: string; shift: 'Day'|'Swing'|'Night'; phase: Phase; precinct: string;
  recruitName: string; recruitBadge: string; ftoName: string; ftoBadge: string; sergeantName: string;
  beat: string; hours: number; calls: number;
  ratings: Record<Category,{ rating: Rating; justification: string }>;
  narrative: string; remedial: string; recruitComments: string;
  status: Status; signatures: { fto?: Signature; recruit?: Signature; sergeant?: Signature };
  createdAt: string; updatedAt: string;
}
export interface Task { id: string; phase: Phase; group: string; title: string; done: boolean; by?: string; at?: string; }
export interface Workspace { version: number; role: Role; reports: Report[]; tasks: Task[]; }

const PII = [
  { re: /\b\d{3}-\d{2}-\d{4}\b/, msg: 'Looks like a Social Security number' },
  { re: /\b(dob|d\.o\.b|date of birth)\b/i, msg: 'Date of birth reference' },
  { re: /\b(dl|driver'?s? licen[cs]e|cdl)\s*#?\s*[a-z]?\d{5,}/i, msg: 'Driver license number' },
  { re: /\b(ncic|clets|rap sheet|criminal history|priors?)\b/i, msg: 'Criminal history / restricted system reference' },
  { re: /\b(case|incident|booking)\s*(no\.?|#|number)\s*\d+/i, msg: 'Case or booking identifier' },
  { re: /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/, msg: 'Phone number' },
];
export function scanPII(text: string): string[] { return PII.filter(p => p.re.test(text)).map(p => p.msg); }

export function validateReport(r: Report): string[] {
  const errs: string[] = [];
  const req: [keyof Report, string][] = [['date','Shift date'],['shift','Shift'],['precinct','Precinct'],['beat','Beat / area'],['recruitName','Recruit name'],['recruitBadge','Recruit badge'],['ftoName','FTO name'],['ftoBadge','FTO badge'],['sergeantName','Sergeant name']];
  for (const [k,l] of req) if (!String(r[k] ?? '').trim()) errs.push(l + ' is required');
  if (!PHASES.includes(r.phase)) errs.push('Phase is required');
  for (const c of CATEGORIES) {
    const v = r.ratings[c];
    if (!v.rating) errs.push(CATEGORY_LABEL[c] + ': rating required');
    else if (needsJustification(v.rating) && v.justification.trim().length < 20) errs.push(CATEGORY_LABEL[c] + ': justification of at least 20 characters required for ' + ratingLabel(v.rating));
  }
  return errs;
}
export function uid() { return Math.random().toString(36).slice(2, 10); }
