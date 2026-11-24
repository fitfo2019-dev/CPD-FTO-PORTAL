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
export function assertTacticalAssignmentMetadata(value: SavedMetadata): void {
  if (isTacticalCallSign(value.ftoAssignment)) PatrolAssignmentMetadataSchema.parse(value);
}
