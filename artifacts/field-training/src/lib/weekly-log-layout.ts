import { SEG_CATEGORIES, type Category, type WeeklyPerformanceLogEntry } from './model.js';

export const TRAINING_FOLDER_REFERENCE_PATTERN = /^W\d+D\d+P\d+$/i;
const MAX_NARRATIVE_FRAGMENT_CHARS = 2400;
const FIRST_PAGE_LINE_BUDGET = 36;
const CONTINUATION_PAGE_LINE_BUDGET = 44;
const ESTIMATED_CHARS_PER_LINE = 88;

export interface PrintableLogEntry {
  entry: WeeklyPerformanceLogEntry;
  narrativePart: string;
  continuation: boolean;
}

export interface PrintableLogPage {
  strengths: PrintableLogEntry[];
  corrective: PrintableLogEntry[];
  estimatedLines: number;
  blankCorrectiveRows: number;
}

export function parseTrainingFolderReferences(value: string): string[] {
  return value.split(',').map(reference => reference.trim().toUpperCase()).filter(Boolean);
}

export function isValidTrainingFolderReference(value: string): boolean {
  return TRAINING_FOLDER_REFERENCE_PATTERN.test(value.trim());
}

export function hasReviewedCorrectiveSource(entry: WeeklyPerformanceLogEntry): boolean {
  return entry.kind !== 'corrective' || (
    entry.sourceReferenceReviewed === true &&
    (entry.sourceReferences?.length ?? 0) > 0 &&
    entry.sourceReferences!.every(isValidTrainingFolderReference) &&
    entry.sourceReportIds.length > 0 &&
    !!entry.totalTime.trim()
  );
}

export function categoryNumberLabel(category: Category): string {
  const definition = SEG_CATEGORIES.find(item => item.key === category);
  if (!definition) return '—';
  const match = /^(?:SEGs?\s+|Related criteria in SEG\s+)([\d,\s–-]+)/i.exec(definition.manualReference);
  if (!match) return '—';
  const numbers: number[] = [];
  for (const token of match[1].split(',')) {
    const range = /^\s*(\d+)\s*[–-]\s*(\d+)\s*$/.exec(token);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (end >= start && end - start < 20) {
        for (let number = start; number <= end; number++) numbers.push(number);
      }
      continue;
    }
    const number = /^\s*(\d+)\s*$/.exec(token);
    if (number) numbers.push(Number(number[1]));
  }
  return [...new Set(numbers)].join(', ') || '—';
}

/** Category column: slash-joined numbers for a page 42 category set, e.g. "19/24/25". */
export function entryCategoryLabel(entry: Pick<WeeklyPerformanceLogEntry, 'category' | 'categories'>): string {
  return entry.categories?.length ? entry.categories.map(categoryNumberLabel).join('/') : categoryNumberLabel(entry.category);
}

function narrativeWithoutDuplicateReference(entry: WeeklyPerformanceLogEntry): string {
  const narrative = entry.narrative ?? '';
  if (entry.inlineReferences) return narrative;
  const references = entry.sourceReferences?.map(value => value.trim()).filter(Boolean) ?? [];
  const prefix = references.join(', ');
  return prefix && narrative.startsWith(`${prefix} `) ? narrative.slice(prefix.length + 1) : narrative;
}

export function weeklyLogNarrativeWithReference(entry: WeeklyPerformanceLogEntry): string {
  if (entry.inlineReferences) return entry.narrative ?? '';
  const references = entry.sourceReferences?.map(value => value.trim()).filter(Boolean) ?? [];
  const narrative = narrativeWithoutDuplicateReference(entry);
  const prefix = references.join(', ');
  return prefix ? `${prefix}${narrative ? ` ${narrative}` : ''}` : narrative;
}

function splitAtWords(value: string, maxChars: number): string[] {
  if (value.length <= maxChars) return [value];
  const chunks: string[] = [];
  let start = 0;
  while (start < value.length) {
    let end = Math.min(start + maxChars, value.length);
    if (end < value.length) {
      const space = value.lastIndexOf(' ', end);
      const newline = value.lastIndexOf('\n', end);
      const breakAt = Math.max(space, newline);
      if (breakAt > start + Math.floor(maxChars * 0.55)) end = breakAt + 1;
    }
    chunks.push(value.slice(start, end));
    start = end;
  }
  return chunks;
}

function estimatedLines(entry: WeeklyPerformanceLogEntry, text: string): number {
  const referenceLength = entry.sourceReferences?.join(', ').length ?? 0;
  return Math.max(2, Math.ceil((text.length + referenceLength) / ESTIMATED_CHARS_PER_LINE) + 2);
}

export function paginateWeeklyLogEntries(entries: WeeklyPerformanceLogEntry[]): PrintableLogPage[] {
  const pages: PrintableLogPage[] = [{ strengths: [], corrective: [], estimatedLines: 0, blankCorrectiveRows: 0 }];
  let usedLines = 0;
  const nextPage = () => {
    pages.push({ strengths: [], corrective: [], estimatedLines: 0, blankCorrectiveRows: 0 });
    usedLines = 0;
  };

  for (const kind of ['strength', 'corrective'] as const) {
    for (const entry of entries.filter(item => item.kind === kind)) {
      const parts = splitAtWords(narrativeWithoutDuplicateReference(entry), MAX_NARRATIVE_FRAGMENT_CHARS);
      parts.forEach((narrativePart, partIndex) => {
        const lineCost = estimatedLines(entry, narrativePart);
        const budget = pages.length === 1 ? FIRST_PAGE_LINE_BUDGET : CONTINUATION_PAGE_LINE_BUDGET;
        const hasRows = pages.at(-1)!.strengths.length + pages.at(-1)!.corrective.length > 0;
        if (hasRows && usedLines + lineCost > budget) nextPage();
        const row: PrintableLogEntry = { entry, narrativePart, continuation: partIndex > 0 };
        pages.at(-1)![kind === 'strength' ? 'strengths' : 'corrective'].push(row);
        usedLines += lineCost;
        pages.at(-1)!.estimatedLines += lineCost;
      });
    }
  }
  for (const [index,page] of pages.entries()) {
    const budget=index===0?FIRST_PAGE_LINE_BUDGET:CONTINUATION_PAGE_LINE_BUDGET;
    page.blankCorrectiveRows=Math.max(0,Math.min(34-page.corrective.length,Math.floor(Math.max(0,budget-page.estimatedLines)/1.25)));
  }
  return pages;
}
