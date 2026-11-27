export type CodeKind = 'ORC' | 'CCC';

export interface ComplaintEntry {
  heading: string;
  variant: string;
  text: string;
  notes: string;
  page: number;
  end: number;
  citations: string[];
  conflict: boolean;
  example: boolean;
  ambiguous: boolean;
  processedBy?: 'DICE';
  citationOnly?: boolean;
}

export interface ChargeCode {
  key: string;
  kind: CodeKind;
  section: string;
  offense: string;
  entries: ComplaintEntry[];
  searchText: string;
}

export interface StatuteClauses {
  clauses: string[];
  penaltyIndexes: number[];
}

export interface ElementLine {
  index: number;
  text: string;
  depth: number;
}

export interface ElementGroup {
  lead: ElementLine[];
  alternatives: ElementLine[];
  requiresOne: boolean;
}

const LABEL = /^\s*\(([A-Za-z]{1,4}|\d{1,3})\)/;
const ROMAN = /^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv)$/;

/**
 * Manual headings that print a section number that does not exist. The complaint wording
 * of each entry already cites the corrected section (ORC 2913.02 and ORC 2911.211).
 */
export const SECTION_CORRECTIONS: Readonly<Record<string, string>> = {
  'ORC:2913.0': 'ORC:2913.02',
  'ORC:2909.211': 'ORC:2911.211',
};

function correctEntry(entry: ComplaintEntry, from: string, to: string): ComplaintEntry {
  const pattern = new RegExp(`${from.replace(/\./g, '\\.')}(?!\\d)`, 'g');
  return {
    ...entry,
    heading: entry.heading.replace(pattern, to),
    citations: entry.citations.map(citation => citation.replace(pattern, to)),
  };
}

export function mergeComplaintSources(
  ...sources: ReadonlyArray<Record<string, ComplaintEntry[]> | undefined>
): Record<string, ComplaintEntry[]> {
  const merged: Record<string, ComplaintEntry[]> = {};
  sources.forEach(source => Object.entries(source ?? {}).forEach(([key, entries]) => {
    merged[key] = [...(merged[key] ?? []), ...entries];
  }));
  return merged;
}

export function normalizeComplaintCodes(codes: Record<string, ComplaintEntry[]>): ChargeCode[] {
  const merged = new Map<string, ComplaintEntry[]>();
  Object.entries(codes).forEach(([key, entries]) => {
    const target = SECTION_CORRECTIONS[key];
    const finalKey = target ?? key;
    const list = target
      ? entries.map(entry => correctEntry(entry, key.split(':')[1], target.split(':')[1]))
      : entries;
    merged.set(finalKey, [...(merged.get(finalKey) ?? []), ...list]);
  });
  return [...merged].map(([key, entries]) => {
    const [kind, section] = key.split(':') as [CodeKind, string];
    const offense = offenseName(entries[0]?.heading ?? '', section);
    const searchText = [
      key, section, `${kind} ${section}`, offense,
      ...entries.flatMap(entry => [entry.heading, entry.variant]),
    ].join(' ').toLocaleLowerCase();
    return { key, kind, section, offense, entries, searchText };
  });
}

export function offenseName(heading: string, section: string): string {
  const at = heading.indexOf(section);
  const name = (at > 0 ? heading.slice(0, at) : heading).trim();
  return name || heading.trim();
}

export function searchCharges(codes: readonly ChargeCode[], query: string, limit = 25): ChargeCode[] {
  const normalized = query.trim().toLocaleLowerCase().replace(/[§]/g, ' ');
  if (!normalized) return [];
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const sectionQuery = normalized.match(/\d{3,4}\.\d{1,4}/)?.[0];
  const scored = codes.flatMap(code => {
    if (!tokens.every(token => code.searchText.includes(token))) return [];
    let score = 0;
    if (sectionQuery && code.section === sectionQuery) score += 100;
    else if (sectionQuery && code.section.startsWith(sectionQuery)) score += 50;
    if (code.offense.toLocaleLowerCase().startsWith(normalized)) score += 30;
    if (code.offense.toLocaleLowerCase().includes(normalized)) score += 10;
    if (code.kind === 'ORC') score += 1;
    return [{ code, score }];
  });
  return scored
    .sort((a, b) => b.score - a.score || a.code.section.localeCompare(b.code.section, undefined, { numeric: true }))
    .slice(0, limit)
    .map(item => item.code);
}

/** Leading division labels of a clause, such as ["B", "1"] for "(B)(1) Whoever ...". */
export function clauseLabels(text: string): string[] {
  const labels: string[] = [];
  let rest = text;
  for (;;) {
    const match = rest.match(LABEL);
    if (!match) return labels;
    labels.push(match[1]);
    rest = rest.slice(match[0].length);
  }
}

function labelLevel(label: string, previous: { level: number; label: string } | undefined): number {
  if (/^\d+$/.test(label)) return 2;
  const deepUpperRoman = /^[IVX]+$/.test(label) && previous !== undefined && previous.level >= 4
    && (label === 'I' || previous.level === 5);
  if (deepUpperRoman) return 5;
  if (/^[A-Z]+$/.test(label)) return 1;
  if (ROMAN.test(label)) {
    const prior = previous?.label ?? '';
    const priorIsLetterRun = previous?.level === 3 && !ROMAN.test(prior)
      && prior.length === 1 && label.length === 1
      && label.charCodeAt(0) === prior.charCodeAt(0) + 1;
    if (priorIsLetterRun) return 3;
    if (previous && previous.level >= 3) return 4;
    return 3;
  }
  return 3;
}

interface ParsedClause { index: number; text: string; path: string[] }

export function parseClausePaths(clauses: readonly string[]): ParsedClause[] {
  const stack: string[] = [];
  let previous: { level: number; label: string } | undefined;
  return clauses.map((raw, index) => {
    const text = raw.replace(/\s+/g, ' ').trim();
    const labels = clauseLabels(text);
    labels.forEach(label => {
      const level = labelLevel(label, previous);
      stack.length = level - 1;
      while (stack.length < level - 1) stack.push('');
      stack.push(label);
      previous = { level, label };
    });
    return { index, text, path: [...stack] };
  });
}

/** Division path from a complaint citation, such as "ORC 2913.02(A)(1)" -> ["A", "1"]. */
export function citationPath(citation: string, section: string): string[] {
  const at = citation.indexOf(section);
  const tail = at >= 0 ? citation.slice(at + section.length) : '';
  return [...tail.matchAll(/\(([A-Za-z]{1,4}|\d{1,3})\)/g)].map(match => match[1]);
}

const startsWith = (path: readonly string[], prefix: readonly string[]) =>
  prefix.every((label, index) => path[index] === label);

const ALTERNATIVE_LEAD = /\b(any of the following|one of the following|the following applies|any of the following applies|either of the following|following ways)\b/i;

/**
 * Elements are the statute's own divisions for the cited path: every ancestor lead-in,
 * the cited division and its sub-divisions. When the cited division lists alternatives
 * ("any of the following"), its immediate sub-divisions are alternatives and at least
 * one must be confirmed. Penalty clauses are never elements.
 */
export function elementsForCitation(statute: StatuteClauses, path: readonly string[]): ElementGroup {
  const parsed = parseClausePaths(statute.clauses);
  const penalty = new Set(statute.penaltyIndexes);
  const usable = parsed.filter(clause => !penalty.has(clause.index) && clause.text.length > 0);
  const target = path.length ? path : firstOperativePath(usable);
  const lead: ElementLine[] = [];
  const children: ParsedClause[] = [];
  usable.forEach(clause => {
    const isAncestorOrSelf = clause.path.length > 0 && clause.path.length <= target.length
      && startsWith(target, clause.path) && clauseLabels(clause.text).length > 0;
    if (isAncestorOrSelf) lead.push({ index: clause.index, text: clause.text, depth: clause.path.length - 1 });
    else if (clause.path.length > target.length && startsWith(clause.path, target)) children.push(clause);
  });
  if (!lead.length && !children.length && !path.length && usable.every(clause => clause.path.length === 0)) {
    return { lead: usable.map(clause => ({ index: clause.index, text: clause.text, depth: 0 })), alternatives: [], requiresOne: false };
  }
  const leadText = lead[lead.length - 1]?.text ?? '';
  const directDepth = target.length + 1;
  const requiresOne = children.some(child => child.path.length === directDepth) && ALTERNATIVE_LEAD.test(leadText);
  const lines = children.map(child => ({ index: child.index, text: child.text, depth: child.path.length - 1 }));
  return requiresOne
    ? { lead, alternatives: lines, requiresOne }
    : { lead: [...lead, ...lines], alternatives: [], requiresOne: false };
}

function firstOperativePath(clauses: readonly ParsedClause[]): string[] {
  const first = clauses.find(clause => /\bno person shall\b/i.test(clause.text)) ?? clauses[0];
  return first ? first.path.slice(0, 1) : [];
}

export function elementsComplete(group: ElementGroup, checked: ReadonlySet<number>): boolean {
  if (!group.lead.length && !group.alternatives.length) return false;
  if (!group.lead.every(line => checked.has(line.index))) return false;
  if (!group.requiresOne) return true;
  return group.alternatives.some(line => checked.has(line.index));
}

/** Penalty sentences quoted from the statute, limited to the ones that name an offense level. */
export function penaltySentences(statute: StatuteClauses): string[] {
  return statute.penaltyIndexes
    .map(index => statute.clauses[index]?.replace(/\s+/g, ' ').trim() ?? '')
    .filter(text => /\bguilty of\b|\b(felony|misdemeanor) of the \w+ degree\b|\b(first|second|third|fourth|fifth) degree (felony|misdemeanor)\b|\bminor misdemeanor\b|\bunclassified (felony|misdemeanor)\b/i.test(text));
}

/** True when the wording cites at least one of the entry's own sections (e.g. 2921.52 for ORC 2921.52(B)(3)). */
export function wordingCitesOwnSection(entry: ComplaintEntry): boolean {
  const sections = entry.citations
    .map(citation => /^(?:ORC|CCC)\s+(\d[\d.]*?)(?=\(|$)/.exec(citation.trim())?.[1])
    .filter((section): section is string => Boolean(section));
  if (sections.length === 0) return true;
  return sections.some(section =>
    new RegExp(`(?<![\\d.])${section.replace(/\./g, '\\.')}(?!\\.?\\d)`).test(entry.text));
}

export function canCopyWording(entry: ComplaintEntry): boolean {
  return !entry.conflict && !entry.ambiguous && !entry.example && !entry.processedBy && !entry.citationOnly
    && entry.text.trim().length > 0 && wordingCitesOwnSection(entry);
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', sect: '§' };

export function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
      if (code[0] === '#') {
        const value = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(value) ? String.fromCodePoint(value) : whole;
      }
      return ENTITIES[code.toLowerCase()] ?? whole;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/** ORC snapshot HTML marks each division with class "clause"; penalty divisions add "penalty-clause". */
export function clausesFromStatuteHtml(html: string): StatuteClauses {
  const clauses: string[] = [];
  const penaltyIndexes: number[] = [];
  for (const match of html.matchAll(/<p class="([^"]*\bclause\b[^"]*)">([\s\S]*?)<\/p>/g)) {
    if (/\bpenalty-clause\b/.test(match[1])) penaltyIndexes.push(clauses.length);
    clauses.push(htmlToText(match[2]));
  }
  return { clauses, penaltyIndexes };
}

export interface StatuteRecord { html?: string; clauses?: string[]; penalties?: number[] }
export interface SupplementRecord { clauses: string[]; penaltyIndexes: number[] }

/**
 * Statute text for a charge: the chapter record first, then the official text kept in the
 * charging supplement for sections the chapter files do not carry.
 */
export function resolveStatute(
  code: Pick<ChargeCode, 'kind' | 'section'>,
  record: StatuteRecord | undefined,
  supplement: Record<string, SupplementRecord> | undefined,
): StatuteClauses | null {
  if (record) {
    if (code.kind === 'CCC' && Array.isArray(record.clauses) && record.clauses.length) {
      return { clauses: record.clauses, penaltyIndexes: record.penalties ?? [] };
    }
    if (code.kind === 'ORC') {
      const parsed = clausesFromStatuteHtml(record.html ?? '');
      if (parsed.clauses.length) return parsed;
    }
  }
  const extra = supplement?.[`${code.kind}:${code.section}`];
  return extra && extra.clauses.length
    ? { clauses: extra.clauses, penaltyIndexes: extra.penaltyIndexes }
    : null;
}

export const OFFICIAL_STATUTE_URL = (kind: CodeKind, section: string) => kind === 'ORC'
  ? `https://codes.ohio.gov/ohio-revised-code/section-${section}`
  : 'https://library.municode.com/oh/columbus/codes/code_of_ordinances';
