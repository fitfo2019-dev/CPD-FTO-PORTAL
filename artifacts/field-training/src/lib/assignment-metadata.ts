import { isTacticalCallSign, PatrolAssignmentMetadataSchema } from './cpd-geography.js';

type SavedMetadata = {
  zone?: string; precinct?: string; cruiserDistrict?: string;
  shift?: string; ftoAssignment?: string;
};

/** Never infer patrol geography from a tactical call-sign. Invalid imported
 * metadata aborts before saved workspace state can be replaced. */
export function assertAssignmentMetadata(value: SavedMetadata): void {
  if ([value.zone,value.precinct,value.cruiserDistrict,value.ftoAssignment].some(Boolean)) {
    PatrolAssignmentMetadataSchema.parse(value);
  }
}

/** Older ordinary records may contain incomplete geography. Leave those alone;
 * tactical records must always reopen with their independent official area. */
export function requiresTacticalAssignmentMetadata(value: SavedMetadata): boolean {
  // 80C was also an ordinary company choice in older Precinct 8 records.
  // Do not newly reject those historical, pre-modern-shift snapshots. New
  // writes/imports still go through the full metadata validator above.
  if (value.ftoAssignment === '80C' && !['A-Co','B-Co','C-Co','DMW','EMW'].includes(value.shift ?? '')) return false;
  return isTacticalCallSign(value.ftoAssignment);
}
export function assertTacticalAssignmentMetadata(value: SavedMetadata): void {
  if (requiresTacticalAssignmentMetadata(value)) PatrolAssignmentMetadataSchema.parse(value);
}
