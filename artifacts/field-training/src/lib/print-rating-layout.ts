import { SEG_CATEGORIES } from './model.js';

/** Fixed, form-structure-only split. Answers never hide or move a section. */
export function printRatingColumns<T extends string>(groups: readonly T[]): T[][] {
  if (groups.length < 2) return [groups.slice()];
  const weights = groups.map(group => 1 + SEG_CATEGORIES.filter(item => item.group === group).length);
  const total = weights.reduce((sum,value) => sum + value,0);
  let left = 0, cut = 1, best = Infinity;
  for (let index=1; index<groups.length; index++) {
    left += weights[index-1];
    const difference = Math.abs(total-left*2);
    if (difference < best) { best=difference; cut=index; }
  }
  return [groups.slice(0,cut),groups.slice(cut)];
}
