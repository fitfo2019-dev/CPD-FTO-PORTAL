export interface SearchChoice {
  value: string;
  label: string;
  searchText?: string;
}

function normalize(value: string) {
  return value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
}

function matchScore(choice: SearchChoice, query: string) {
  const needle = normalize(query);
  if (!needle) return 1;
  const label = normalize(`${choice.label} ${choice.value} ${choice.searchText ?? ''}`);
  if (label === needle) return 1000;
  if (label.startsWith(needle)) return 900;
  const containsAt = label.indexOf(needle);
  if (containsAt >= 0) return 700 - containsAt;
  let position = 0;
  let gaps = 0;
  for (const character of needle) {
    const next = label.indexOf(character, position);
    if (next < 0) return 0;
    if (position > 0) gaps += next - position;
    position = next + 1;
  }
  return 300 - gaps;
}

export function rankSearchChoices<T extends SearchChoice>(choices: T[], query: string) {
  return choices
    .map((choice, index) => ({ choice, index, score: matchScore(choice, query) }))
    .filter(entry => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(entry => entry.choice);
}
