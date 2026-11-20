import { NO_CATEGORY_COLOR } from "@/lib/colors";

/**
 * 홈 화면 위젯(2026-11-20 운영자 요청)이 받는 "오늘 남은 할 일" 목록을 만든다. 위젯은 읽기 전용이고 남은 일만 본다.
 * 서버가 목록과 개수를 정해 주므로 위젯(Android 네이티브)에는 규칙이 없다. 나중에 iOS·맥 위젯이 생겨도 같은 응답을 쓴다.
 */

export type WidgetSourceTodo = {
  id: string;
  content: string;
  done: boolean;
  order: number;
  parentId: string | null;
  color: string | null;
  category: { order: number; color: string } | null;
};

export type WidgetTodo = {
  id: string;
  content: string;
  // "#rrggbb". 할 일에 따로 고른 색이 있으면 그것, 없으면 카테고리 색.
  color: string;
  // 이 할 일 밑에 세부 할 일이 있으면 끝낸 개수와 전체 개수.
  subDone?: number;
  subTotal?: number;
};

/** 위젯은 작아서 몇 줄밖에 못 보여 준다. 응답을 키우지 않으려고 이만큼만 내려 준다. 남은 개수(remaining)는 자르기 전의 수다. */
export const WIDGET_MAX_TODOS = 20;

/**
 * 오늘의 할 일 전부(끝낸 것 포함)에서 남은 일만 고른다.
 * - 안 끝낸 큰 할 일은 한 줄이고, 세부 할 일이 있으면 그 줄에 끝낸 개수(1/3)가 붙는다. 세부 할 일은 따로 세지 않는다(홈과 같다).
 * - 큰 할 일을 먼저 끝냈는데 안 끝낸 세부 할 일이 남았으면 그 세부 할 일은 자기 줄로 나온다(앱에서 큰 할 일 체크는 따로라서).
 * - 순서는 홈과 같다: 카테고리 순서, 그 안에서 할 일 순서. 카테고리가 없는 것은 맨 뒤.
 */
export function buildWidget(rows: WidgetSourceTodo[]): { remaining: number; todos: WidgetTodo[] } {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const subsOf = new Map<string, WidgetSourceTodo[]>();
  for (const row of rows) {
    if (!row.parentId || !byId.has(row.parentId)) continue;
    subsOf.set(row.parentId, [...(subsOf.get(row.parentId) ?? []), row]);
  }

  const shown = rows
    .filter((row) => {
      if (row.done) return false;
      // 안 끝낸 큰 할 일 밑의 세부 할 일은 그 큰 할 일의 줄에 합쳐진다.
      const parent = row.parentId ? byId.get(row.parentId) : undefined;
      return !(parent && !parent.done);
    })
    .sort((a, b) => (a.category?.order ?? Infinity) - (b.category?.order ?? Infinity) || a.order - b.order || a.id.localeCompare(b.id));

  const todos = shown.slice(0, WIDGET_MAX_TODOS).map((row): WidgetTodo => {
    const subs = subsOf.get(row.id) ?? [];
    return {
      id: row.id,
      content: row.content,
      color: row.color ?? row.category?.color ?? NO_CATEGORY_COLOR,
      ...(subs.length > 0 && { subDone: subs.filter((sub) => sub.done).length, subTotal: subs.length }),
    };
  });
  return { remaining: shown.length, todos };
}
