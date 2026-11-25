import type { SubstationOrientationRecord } from './model.js';

/** Count explicit blank lines as well as wrapping; never truncate saved free text. */
function textPages(value:string, charactersPerLine:number, linesPerPage:number):string[] {
  const pages:string[] = [];
  let part = '', lines = 0;
  for (const line of value.match(/[^\n]*\n|[^\n]+$/gu) ?? []) {
    const chars = Array.from(line);
    for (let start=0; start<chars.length; start+=charactersPerLine) {
      if (lines === linesPerPage) { pages.push(part); part=''; lines=0; }
      part += chars.slice(start,start+charactersPerLine).join('');
      lines++;
    }
  }
  if (part) pages.push(part);
  return pages;
}

export function orientationPrintLayout(record:Pick<SubstationOrientationRecord,'directivesReview'|'narrative'>) {
  const continuations:{label:string;text:string}[] = [];
  const bounded = (value:string,label:string) => {
    // Each note can occupy at most three conservative lines on the base sheet.
    if (textPages(value,35,3).length <= 1 && Array.from(value).length <= 105) return value;
    continuations.push(...textPages(value,45,30).map(text => ({label,text})));
    return '';
  };
  const directives = bounded(record.directivesReview,'Division Directives / SOP reviewed');
  const narrative = bounded(record.narrative,'Additional narrative / continuation');
  return {directives,narrative,continuations};
}
