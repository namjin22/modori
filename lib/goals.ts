import { daysBetween, formatKST, parseKSTDate } from "@/lib/date";

/**
 * 목표(2026-11-19 운영자 결정, docs/decisions.md)의 순수한 부분. 2단계: 목표 → 세부 목표(세부 목표 아래는 없다).
 * 달성은 직접 체크한다. 세부 목표가 있는 목표는 달성 여부를 칸에 저장하지 않고 세부 목표를 센 값으로 보인다.
 */
export const GOAL_TITLE_MAX = 100;

export type SubGoalView = { id: string; title: string; done: boolean };

export type GoalView = {
  id: string;
  title: string;
  /** "YYYY-MM-DD". 기한을 안 정했으면 null. */
  dueDate: string | null;
  isPublic: boolean;
  /** 직접 체크한 값. 세부 목표가 있으면 뜻이 없다(항상 false로 저장한다). */
  done: boolean;
  children: SubGoalView[];
};

/** DB에서 읽은 목표(와 세부 목표)를 화면이 쓰는 모양으로 바꾼다. 날짜는 "YYYY-MM-DD" 문자열이 된다. */
export function toGoalView(row: {
  id: string;
  title: string;
  dueDate: Date | null;
  doneAt: Date | null;
  isPublic: boolean;
  children: { id: string; title: string; doneAt: Date | null }[];
}): GoalView {
  return {
    id: row.id,
    title: row.title,
    dueDate: row.dueDate ? formatKST(row.dueDate) : null,
    isPublic: row.isPublic,
    done: row.doneAt !== null,
    children: row.children.map((child) => ({ id: child.id, title: child.title, done: child.doneAt !== null })),
  };
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
