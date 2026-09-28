"use client";

import { reorderTodos } from "@/app/(tabs)/actions";
import { SortableList, type SortableItem } from "@/components/sortable-list";

export type { SortableItem };

/** 그날 한 카테고리 묶음의 할 일 순서. 날짜와 함께 저장한다. */
export function SortableTodoList({ date, items }: { date: string; items: SortableItem[] }) {
  return <SortableList items={items} noun="할 일" save={(ids) => reorderTodos(date, ids)} />;
}
