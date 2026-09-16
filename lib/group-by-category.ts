type WithCategory = {
  category: { id: string; name: string; color: string } | null;
};

export type CategoryGroup<T> = {
  key: string;
  name: string;
  // 카테고리를 고르지 않은 묶음은 색이 없다. 화면에서 회색 칩으로 그린다.
  color: string | null;
  items: T[];
};

/**
 * 카테고리별로 묶는다. 순서는 카테고리 관리 화면에서 정한 순서를 따르고,
 * 카테고리 없는 것이 맨 뒤다. 보관한 카테고리는 목록에 없으므로 항목이
 * 들고 있는 값을 쓰고, 살아 있는 카테고리 뒤에 둔다.
 */
export function groupByCategory<T extends WithCategory>(
  items: T[],
  categories: { id: string }[],
): CategoryGroup<T>[] {
  const rankById = new Map(categories.map((c, index) => [c.id, index]));
  const ARCHIVED_RANK = categories.length;
  const NO_CATEGORY_RANK = categories.length + 1;

  const groups = new Map<string, CategoryGroup<T> & { rank: number }>();

  for (const item of items) {
    const key = item.category?.id ?? "";
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        name: item.category?.name ?? "카테고리 없음",
        color: item.category?.color ?? null,
        rank: item.category
          ? (rankById.get(item.category.id) ?? ARCHIVED_RANK)
          : NO_CATEGORY_RANK,
        items: [],
      };
      groups.set(key, group);
    }
    group.items.push(item);
  }

  return [...groups.values()].sort((a, b) => a.rank - b.rank);
}
