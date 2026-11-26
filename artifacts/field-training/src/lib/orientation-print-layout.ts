import type { SubstationOrientationRecord } from './model.js';
import { paginateNarrativeToPages, ORIENTATION_NARRATIVE_LAYOUT } from './narrative-continuation.js';

export function orientationPrintLayout(record:Pick<SubstationOrientationRecord,'directivesReview'|'narrative'>) {
  const continuations:{label:string;text:string}[] = [];
  const bounded = (value:string,label:string) => {
    // Each note can occupy at most three conservative lines on the base sheet.
    if (value.length <= 105 && value.split(/\r\n|\r|\n/).length <= 3) return value;
    continuations.push(...paginateNarrativeToPages(value,ORIENTATION_NARRATIVE_LAYOUT).map(text => ({label,text})));
    return '';
  };
  const directives = bounded(record.directivesReview,'Division Directives / SOP reviewed');
  const narrative = bounded(record.narrative,'Additional narrative / continuation');
  return {directives,narrative,continuations};
}
