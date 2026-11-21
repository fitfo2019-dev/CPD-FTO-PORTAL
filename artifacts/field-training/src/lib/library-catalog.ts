export interface CatalogRecord {
  group: string;
  title: string;
  label: string;
}

export function sortCatalogRecords<T extends CatalogRecord>(records: T[], groupOrder: string[]): T[] {
  const groupRank = new Map(groupOrder.map((group, index) => [group, index]));
  return [...records].sort((a, b) => {
    const sourceOrder = (groupRank.get(a.group) ?? groupOrder.length) - (groupRank.get(b.group) ?? groupOrder.length);
    if (sourceOrder !== 0) return sourceOrder;
    const titleOrder = a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true });
    return titleOrder || a.label.localeCompare(b.label, undefined, { sensitivity: 'base', numeric: true });
  });
}
