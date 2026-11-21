import {
  DIRECTIVE_PDF_INDEX_SOURCE,
  DIRECTIVE_PDF_LINKS,
} from './directive-pdf-index.js';

/** Current individual directive titles and numbers linked by the official City page. */
export const DIVISION_DIRECTIVE_SOURCE_REVISION = '09/30/2026';
export const DIVISION_DIRECTIVE_SOURCE_URL = DIRECTIVE_PDF_INDEX_SOURCE;
export const DIVISION_DIRECTIVES = DIRECTIVE_PDF_LINKS.map(({ number, title, url }) => ({
  number,
  title,
  url,
}));

export function formatSelectedDivisionDirectives(selected: readonly string[]): string[] {
  const selectedSet = new Set(selected);
  const indexed = DIVISION_DIRECTIVES
    .filter((directive) => selectedSet.has(directive.number))
    .map((directive) => `${directive.number} ${directive.title}`);
  const knownNumbers = new Set<string>(DIVISION_DIRECTIVES.map((directive) => directive.number));
  return [...indexed, ...selected.filter((number) => !knownNumbers.has(number))];
}
