// 목표(lib/goals.ts, 2026-11-19): 진행 계산, 정렬, 기한 표시, DB 행을 화면 값으로 바꾸기.
import { describe, expect, it } from "vitest";

import { dueLabel, goalProgress, sortGoals, toGoalView, type GoalView } from "@/lib/goals";

const goal = (overrides: Partial<GoalView> & { id: string }): GoalView => ({ title: overrides.id, dueDate: null, isPublic: true, done: false, children: [], ...overrides });
const sub = (id: string, done: boolean) => ({ id, title: id, done });

describe("goalProgress", () => {
  it("세부 목표가 없으면 직접 체크한 값이다", () => {
    expect(goalProgress(goal({ id: "a" }))).toEqual({ total: 0, done: 0, complete: false, hasChildren: false });
    expect(goalProgress(goal({ id: "a", done: true }))).toEqual({ total: 0, done: 0, complete: true, hasChildren: false });
  });

  it("세부 목표가 있으면 달성한 개수를 센다. 전부 달성해야 달성이고, 목표의 직접 체크 값은 무시한다", () => {
    expect(goalProgress(goal({ id: "a", children: [sub("x", true), sub("y", false), sub("z", false)] }))).toEqual({ total: 3, done: 1, complete: false, hasChildren: true });
    expect(goalProgress(goal({ id: "a", children: [sub("x", true), sub("y", true)] }))).toMatchObject({ total: 2, done: 2, complete: true });
    expect(goalProgress(goal({ id: "a", done: true, children: [sub("x", false)] })).complete).toBe(false);
  });
});

describe("sortGoals", () => {
  it("기한이 가까운 순, 기한 없는 것은 뒤, 달성한 것은 맨 아래, 같으면 받은 순서", () => {
    const sorted = sortGoals([
      goal({ id: "later", dueDate: "2027-03-01" }),
      goal({ id: "none1" }),
      goal({ id: "done", dueDate: "2026-12-01", done: true }),
      goal({ id: "soon", dueDate: "2026-12-05" }),
      goal({ id: "none2" }),
      goal({ id: "allSubDone", dueDate: "2026-11-30", children: [sub("a", true)] }),
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["soon", "later", "none1", "none2", "allSubDone", "done"]);
  });

  it("받은 배열을 바꾸지 않는다", () => {
    const input = [goal({ id: "b", dueDate: "2027-01-01" }), goal({ id: "a", dueDate: "2026-01-01" })];
    sortGoals(input);
    expect(input.map((item) => item.id)).toEqual(["b", "a"]);
  });
});

describe("dueLabel", () => {
  it("남은 날은 D-n, 오늘은 D-DAY, 지난 날은 D+n이다. 일주일 안과 지난 것은 눈에 띈다", () => {
    expect(dueLabel("2026-11-30", "2026-11-19")).toEqual({ text: "D-11", soon: false });
    expect(dueLabel("2026-11-26", "2026-11-19")).toEqual({ text: "D-7", soon: true });
    expect(dueLabel("2026-11-19", "2026-11-19")).toEqual({ text: "D-DAY", soon: true });
    expect(dueLabel("2026-11-17", "2026-11-19")).toEqual({ text: "D+2", soon: true });
  });

  it("10년이 넘는 먼 날짜도 계산한다(기한은 할 일 날짜 범위와 별개다)", () => {
    expect(dueLabel("2099-01-01", "2026-11-19").text).toMatch(/^D-\d{5}$/);
  });
});

describe("toGoalView", () => {
  it("날짜는 문자열로, 달성 시각은 done으로 바꾼다", () => {
    const view = toGoalView({
      id: "g1",
      title: "토익",
      dueDate: new Date("2026-12-24T00:00:00Z"),
      doneAt: null,
      isPublic: false,
      children: [{ id: "c1", title: "단어", doneAt: new Date("2026-11-19T01:00:00Z") }, { id: "c2", title: "LC", doneAt: null }],
    });
    expect(view).toEqual({ id: "g1", title: "토익", dueDate: "2026-12-24", isPublic: false, done: false, children: [{ id: "c1", title: "단어", done: true }, { id: "c2", title: "LC", done: false }] });
    expect(toGoalView({ id: "g2", title: "x", dueDate: null, doneAt: new Date(), isPublic: true, children: [] })).toMatchObject({ dueDate: null, done: true });
  });
});
