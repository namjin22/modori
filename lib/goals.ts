import { daysBetween, formatKST, parseKSTDate } from "@/lib/date";

/**
 * 목표(2026-11-19 운영자 결정, docs/decisions.md)의 순수한 부분. 2단계: 목표 → 세부 목표(세부 목표 아래는 없다).
 * 달성은 직접 체크한다. 세부 목표가 있는 목표는 달성 여부를 칸에 저장하지 않고 세부 목표를 센 값으로 보인다.
 */
export const GOAL_TITLE_MAX = 100;

/** 이 목표(또는 세부 목표)로 연결된 내 할 일의 개수와 그중 끝낸 개수(2026-11-19). 참고로만 보여 주고 진행(세부 목표 체크)에는 쓰지 않는다. */
export type LinkedCount = { total: number; done: number };

export type SubGoalView = { id: string; title: string; done: boolean; linked?: LinkedCount };

export type GoalView = {
  id: string;
  title: string;
  /** "YYYY-MM-DD". 기한을 안 정했으면 null. */
  dueDate: string | null;
  isPublic: boolean;
  /** 직접 체크한 값. 세부 목표가 있으면 뜻이 없다(항상 false로 저장한다). */
  done: boolean;
  children: SubGoalView[];
  /** 목표와 세부 목표에 연결된 할 일을 모두 센 값. 내 화면에서만 채운다(친구 화면에는 보내지 않는다). */
  linked?: LinkedCount;
};

/** 연결된 할 일 수를 목표 id별로 센다. 목표 자신과 그 세부 목표에 달린 것은 `toGoalView`가 합친다. */
export function countLinked(rows: { goalId: string | null; done: boolean; _count: { _all: number } }[]): Map<string, LinkedCount> {
  const counts = new Map<string, LinkedCount>();
  for (const row of rows) {
    if (!row.goalId) continue;
    const entry = counts.get(row.goalId) ?? { total: 0, done: 0 };
    entry.total += row._count._all;
    if (row.done) entry.done += row._count._all;
    counts.set(row.goalId, entry);
  }
  return counts;
}

/** DB에서 읽은 목표(와 세부 목표)를 화면이 쓰는 모양으로 바꾼다. 날짜는 "YYYY-MM-DD" 문자열이 된다. */
export function toGoalView(row: {
  id: string;
  title: string;
  dueDate: Date | null;
  doneAt: Date | null;
  isPublic: boolean;
  children: { id: string; title: string; doneAt: Date | null }[];
}, counts?: Map<string, LinkedCount>): GoalView {
  const own = counts?.get(row.id);
  const childLinked = row.children.map((child) => counts?.get(child.id));
  return {
    id: row.id,
    title: row.title,
    dueDate: row.dueDate ? formatKST(row.dueDate) : null,
    isPublic: row.isPublic,
    done: row.doneAt !== null,
    children: row.children.map((child, index) => ({ id: child.id, title: child.title, done: child.doneAt !== null, ...(counts && { linked: childLinked[index] ?? { total: 0, done: 0 } }) })),
    ...(counts && {
      linked: {
        total: (own?.total ?? 0) + childLinked.reduce((sum, item) => sum + (item?.total ?? 0), 0),
        done: (own?.done ?? 0) + childLinked.reduce((sum, item) => sum + (item?.done ?? 0), 0),
      },
    }),
  };
}

export type GoalChoice = { value: string; label: string };

/** 할 일 수정 창의 "목표" 고르기 목록: 연결 안 함, 목표, 그리고 "목표 › 세부 목표". */
export function goalChoices(goals: Pick<GoalView, "id" | "title" | "children">[], noneLabel: string): GoalChoice[] {
  return [
    { value: "", label: noneLabel },
    ...goals.flatMap((goal) => [
      { value: goal.id, label: goal.title },
      ...goal.children.map((child) => ({ value: child.id, label: `${goal.title} › ${child.title}` })),
    ]),
  ];
}

/** 할 일 줄에 보이는 연결된 목표 이름. 세부 목표면 "목표 › 세부 목표", 목표가 없어졌으면 null. */
export function goalLabel(goals: Pick<GoalView, "id" | "title" | "children">[], id: string | null | undefined): string | null {
  if (!id) return null;
  for (const goal of goals) {
    if (goal.id === id) return goal.title;
    const child = goal.children.find((item) => item.id === id);
    if (child) return `${goal.title} › ${child.title}`;
  }
  return null;
}

export type GoalProgress = { total: number; done: number; complete: boolean; hasChildren: boolean };

/** 세부 목표가 있으면 그 개수를 센 값(전부 달성하면 달성), 없으면 직접 체크한 값이다. */
export function goalProgress(goal: Pick<GoalView, "done" | "children">): GoalProgress {
  if (goal.children.length > 0) {
    const done = goal.children.filter((child) => child.done).length;
    return { total: goal.children.length, done, complete: done === goal.children.length, hasChildren: true };
  }
  return { total: 0, done: 0, complete: goal.done, hasChildren: false };
}

/** 기한이 가까운 순으로, 기한이 없는 것은 뒤로. 달성한 목표는 맨 아래로 간다. 같으면 받은 순서(만든 순서)를 지킨다. */
export function sortGoals<T extends Pick<GoalView, "dueDate" | "done" | "children">>(goals: T[]): T[] {
  return goals
    .map((goal, index) => ({ goal, index, complete: goalProgress(goal).complete }))
    .sort((a, b) => Number(a.complete) - Number(b.complete) || dueRank(a.goal.dueDate, b.goal.dueDate) || a.index - b.index)
    .map(({ goal }) => goal);
}

function dueRank(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

export type DueLabel = { text: string; soon: boolean };

/** 기한까지 남은 날(D-n), 오늘(D-DAY), 지난 날(D+n). 가깝거나 지났으면 눈에 띄게(soon). */
export function dueLabel(dueDate: string, today: string): DueLabel {
  const days = daysBetween(parseKSTDate(today), parseKSTDate(dueDate));
  if (days === 0) return { text: "D-DAY", soon: true };
  if (days > 0) return { text: `D-${days}`, soon: days <= 7 };
  return { text: `D+${-days}`, soon: true };
}
