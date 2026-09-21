type WithCategory = {
  category: { id: string; name: string; color: string } | null;
};

type CategoryInfo = {
  id: string;
  name: string;
  color: string;
  isPublic?: boolean;
};

export type CategoryGroup<T> = {
  key: string;
  // 카테고리 없는 묶음은 null. 그 자리에서 할 일을 적을 때 어느 카테고리인지 쓴다.
  categoryId: string | null;
  name: string;
  // 카테고리를 고르지 않은 묶음은 색이 없다. 화면에서 회색 칩으로 그린다.
  color: string | null;
  isPublic: boolean;
  // 보관한 카테고리. 지난 할 일은 이름을 달고 남지만 새로 적을 수는 없다.
  archived: boolean;
  items: T[];
};

/**
 * 카테고리별로 묶는다. 순서는 카테고리 관리 화면에서 정한 순서를 따르고,
 * 카테고리 없는 것이 맨 뒤다. 보관한 카테고리는 목록에 없으므로 항목이
 * 들고 있는 값을 쓰고, 살아 있는 카테고리 뒤에 둔다.
 *
 * includeEmpty를 켜면 항목이 없는 카테고리도 빈 묶음으로 넣는다.
 * 투두메이트처럼 카테고리마다 그 자리에서 할 일을 적으려면 빈 카테고리도 보여야 한다.
 */
export function groupByCategory<T extends WithCategory>(
  items: T[],
  categories: CategoryInfo[],
  { includeEmpty = false }: { includeEmpty?: boolean } = {},
): CategoryGroup<T>[] {
  const rankById = new Map(categories.map((c, index) => [c.id, index]));
  const ARCHIVED_RANK = categories.length;
  const NO_CATEGORY_RANK = categories.length + 1;

  const groups = new Map<string, CategoryGroup<T> & { rank: number }>();

  if (includeEmpty) {
    categories.forEach((category, index) => {
      groups.set(category.id, {
        key: category.id,
        categoryId: category.id,
        name: category.name,
        color: category.color,
        isPublic: category.isPublic ?? true,
        archived: false,
        rank: index,
        items: [],
      });
    });
  }

  for (const item of items) {
    const key = item.category?.id ?? "";
    let group = groups.get(key);
    if (!group) {
      const known = item.category
        ? categories.find((c) => c.id === item.category?.id)
        : undefined;
      group = {
        key,
        categoryId: item.category?.id ?? null,
        name: item.category?.name ?? "카테고리 없음",
        color: item.category?.color ?? null,
        isPublic: known?.isPublic ?? true,
        archived: Boolean(item.category) && !known,
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
