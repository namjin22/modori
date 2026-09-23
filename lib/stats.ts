import { addDays, formatKST, weekdayKST } from "@/lib/date";

/** 통계를 낼 때 필요한 할 일의 최소 모양. 화면과 테스트가 같은 것을 쓴다. */
export type StatTodo = {
  date: Date;
  done: boolean;
  category: { id: string; name: string; color: string } | null;
};

export type CategoryStat = {
  id: string;
  name: string;
  color: string | null;
  total: number;
  done: number;
};

/** 카테고리별 적은 개수와 끝낸 개수. 많이 적은 카테고리가 위로 온다. */
export function countByCategory(todos: StatTodo[]): CategoryStat[] {
  const stats = new Map<string, CategoryStat>();

  for (const todo of todos) {
    const id = todo.category?.id ?? "";
    let stat = stats.get(id);
    if (!stat) {
      stat = {
        id,
        name: todo.category?.name ?? "카테고리 없음",
        color: todo.category?.color ?? null,
        total: 0,
        done: 0,
      };
      stats.set(id, stat);
    }
    stat.total += 1;
    if (todo.done) stat.done += 1;
  }

  return [...stats.values()].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name),
  );
}

/** 요일별로 끝낸 개수. 0이 일요일이다. */
export function countByWeekday(todos: StatTodo[]): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];

  for (const todo of todos) {
    if (todo.done) counts[weekdayKST(todo.date)] += 1;
  }

  return counts;
}

/**
 * 오늘부터 거슬러 올라가며 하나라도 끝낸 날이 며칠 이어졌는지 센다.
 *
 * 오늘은 아직 안 했을 수 있으므로, 오늘이 비어 있으면 어제부터 센다.
 * 그렇게 하지 않으면 자정을 넘기는 순간 지금까지 쌓은 날이 0으로 보인다.
 */
export function streakDays(todos: StatTodo[], today: Date): number {
  const doneDays = new Set(
    todos.filter((todo) => todo.done).map((todo) => formatKST(todo.date)),
  );

  let day = doneDays.has(formatKST(today)) ? today : addDays(today, -1);
  let count = 0;

  while (doneDays.has(formatKST(day))) {
    count += 1;
    day = addDays(day, -1);
  }

  return count;
}
