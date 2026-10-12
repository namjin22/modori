import type { DaySummary } from "@/components/month-calendar";
import { NO_CATEGORY_COLOR } from "@/lib/colors";

type SummaryTodo = {
  date: string;
  done: boolean;
  color: string | null;
  category: { color: string } | null;
  // 끝낸 시각(ms). 끝낸 차례대로 칸이 차게 정렬하는 데만 쓴다.
  doneAt: number | null;
};

/** 달력 칸마다 요약(전체 수, 끝낸 일의 색). 끝낸 순서대로 색을 쌓는다(먼저 끝낸 것이 위). */
export function summarizeByDate(todos: SummaryTodo[]): Map<string, DaySummary> {
  const sorted = [...todos].sort((a, b) => (a.doneAt ?? Infinity) - (b.doneAt ?? Infinity));
  const summaries = new Map<string, DaySummary>();
  for (const todo of sorted) {
    const summary = summaries.get(todo.date) ?? { total: 0, doneColors: [] };
    summary.total += 1;
    // 할 일에 따로 고른 색이 있으면 그것, 없으면 카테고리 색. 카테고리가 없어도 달력에 흔적은 남아야 한다.
    if (todo.done) summary.doneColors.push(todo.color ?? todo.category?.color ?? NO_CATEGORY_COLOR);
    summaries.set(todo.date, summary);
  }
  return summaries;
}
