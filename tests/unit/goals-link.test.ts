// 목표와 할 일의 연결(lib/goals.ts, 2026-11-19): 연결된 할 일 수 세기, 고르기 목록, 줄에 보이는 이름.
import { describe, expect, it } from "vitest";

import { countLinked, goalChoices, goalLabel, toGoalView } from "@/lib/goals";

const row = (goalId: string | null, done: boolean, count: number) => ({ goalId, done, _count: { _all: count } });

describe("countLinked", () => {
  it("목표 id별로 전체와 끝낸 개수를 센다. 목표가 없는 행은 건너뛴다", () => {
    const counts = countLinked([row("g1", false, 3), row("g1", true, 2), row("g2", true, 1), row(null, false, 9)]);
    expect(counts.get("g1")).toEqual({ total: 5, done: 2 });
    expect(counts.get("g2")).toEqual({ total: 1, done: 1 });
    expect(counts.size).toBe(2);
  });
});

describe("toGoalView(연결된 할 일 수)", () => {
  const base = { id: "g1", title: "토익", dueDate: null, doneAt: null, isPublic: true, children: [{ id: "c1", title: "단어", doneAt: null }, { id: "c2", title: "LC", doneAt: null }] };

  it("세부 목표는 자기 것, 목표는 자기와 세부 목표의 것을 합쳐 채운다", () => {
    const counts = new Map([["g1", { total: 1, done: 0 }], ["c1", { total: 4, done: 3 }]]);
    const view = toGoalView(base, counts);
    expect(view.linked).toEqual({ total: 5, done: 3 });
    expect(view.children.map((child) => child.linked)).toEqual([{ total: 4, done: 3 }, { total: 0, done: 0 }]);
  });

  it("세는 값을 안 주면(친구 화면) 연결 수가 아예 없다", () => {
    const view = toGoalView(base);
    expect(view).not.toHaveProperty("linked");
    expect(view.children[0]).not.toHaveProperty("linked");
  });
});

describe("goalChoices / goalLabel", () => {
  const goals = [
    { id: "g1", title: "토익 900점", children: [{ id: "c1", title: "단어 1000개", done: false }] },
    { id: "g2", title: "포트폴리오", children: [] },
  ];

  it("연결 안 함을 맨 앞에 두고, 목표 다음에 그 세부 목표를 '목표 › 세부 목표'로 잇는다", () => {
    expect(goalChoices(goals, "연결 안 함")).toEqual([
      { value: "", label: "연결 안 함" },
      { value: "g1", label: "토익 900점" },
      { value: "c1", label: "토익 900점 › 단어 1000개" },
      { value: "g2", label: "포트폴리오" },
    ]);
    expect(goalChoices([], "연결 안 함")).toEqual([{ value: "", label: "연결 안 함" }]);
  });

  it("줄에 보일 이름: 목표는 이름, 세부 목표는 '목표 › 세부 목표', 없거나 지워졌으면 null", () => {
    expect(goalLabel(goals, "g2")).toBe("포트폴리오");
    expect(goalLabel(goals, "c1")).toBe("토익 900점 › 단어 1000개");
    expect(goalLabel(goals, "gone")).toBeNull();
    expect(goalLabel(goals, null)).toBeNull();
    expect(goalLabel(goals, undefined)).toBeNull();
  });
});
