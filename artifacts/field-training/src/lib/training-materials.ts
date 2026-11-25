import type { DirectiveReviewRecord } from './model.js';
import { formatSelectedDivisionDirectives } from './division-directives.js';

export interface ReviewedTrainingMaterial {
  type: string;
  reference: string;
}

export function parseReferenceEntries(value: string): string[] {
  return [...new Set(value.split(/[\n;,]+/).map(item => item.trim()).filter(Boolean))];
}

export function reviewedTrainingMaterials(record: DirectiveReviewRecord): ReviewedTrainingMaterial[] {
  const rows: ReviewedTrainingMaterial[] = [];
  if (record.divisionDirectives) {
    for (const reference of formatSelectedDivisionDirectives(record.selectedDirectives ?? [])) {
      rows.push({ type: 'Division Directive', reference });
    }
    for (const reference of parseReferenceEntries(record.directiveDetails)) {
      rows.push({ type: 'Division Directive', reference });
    }
  }
  if (record.ohioRevisedCode) {
    for (const reference of record.selectedOrcReferences ?? []) {
      rows.push({ type: 'Ohio Revised Code', reference });
    }
  }
  if (record.columbusCityCode) {
    for (const reference of record.selectedColumbusCodeReferences ?? []) {
      rows.push({ type: 'Columbus City Code', reference });
    }
  }
  if (record.other) {
    for (const reference of parseReferenceEntries(record.otherDetails)) {
      rows.push({ type: 'Other training material', reference });
    }
  }
  return rows;
}
