import { describe, expect, it } from "vitest";

import { buildWidget, WIDGET_MAX_TODOS, type WidgetSourceTodo } from "@/lib/widget";

// 홈 화면 위젯(2026-11-20)이 받는 "오늘 남은 할 일". 규칙은 서버에만 있고 위젯은 받은 대로 그린다.
const row = (id: string, patch: Partial<WidgetSourceTodo> = {}): WidgetSourceTodo => ({
  id,
  content: id,
  done: false,
  order: 0,
  parentId: null,
  color: null,
  category: { order: 0, color: "#2563eb" },
  ...patch,
});
const ids = (todos: { id: string }[]) => todos.map((todo) => todo.id);

describe("buildWidget", () => {
  it("끝낸 일은 빼고 남은 일만 센다", () => {
    const { remaining, todos } = buildWidget([row("a"), row("b", { done: true }), row("c", { order: 1 })]);
    expect(ids(todos)).toEqual(["a", "c"]);
    expect(remaining).toBe(2);
  });

  it("카테고리 순서, 그 안에서 할 일 순서로 늘어놓고 카테고리 없는 것은 맨 뒤다", () => {
    const { todos } = buildWidget([
      row("none", { category: null, order: 0 }),
      row("second-a", { category: { order: 1, color: "#dc2626" }, order: 0 }),
      row("first-b", { order: 5 }),
      row("first-a", { order: 2 }),
    ]);
    expect(ids(todos)).toEqual(["first-a", "first-b", "second-a", "none"]);
  });

  it("색은 할 일에 따로 고른 것, 없으면 카테고리, 둘 다 없으면 회색이다", () => {
    const { todos } = buildWidget([
      row("own", { color: "#16a34a", order: 0 }),
      row("cat", { order: 1 }),
      row("none", { category: null, order: 2 }),
    ]);
    expect(todos.map((todo) => todo.color)).toEqual(["#16a34a", "#2563eb", "#8b95a1"]);
  });

  it("안 끝낸 큰 할 일 밑의 세부 할 일은 따로 세지 않고 그 줄에 끝낸 개수가 붙는다", () => {
    const { remaining, todos } = buildWidget([
      row("big", { order: 0 }),
      row("s1", { parentId: "big", done: true, order: 1 }),
      row("s2", { parentId: "big", order: 2 }),
      row("s3", { parentId: "big", order: 3 }),
    ]);
    expect(ids(todos)).toEqual(["big"]);
    expect(todos[0]).toMatchObject({ subDone: 1, subTotal: 3 });
    expect(remaining).toBe(1);
  });

  it("세부 할 일이 없는 줄에는 개수 칸이 없다", () => {
    const { todos } = buildWidget([row("a")]);
    expect(todos[0]).not.toHaveProperty("subTotal");
    expect(todos[0]).not.toHaveProperty("subDone");
  });

  it("큰 할 일만 먼저 끝냈으면 안 끝낸 세부 할 일은 자기 줄로 나온다", () => {
    const { remaining, todos } = buildWidget([
      row("big", { done: true }),
      row("s1", { parentId: "big", done: true, order: 1 }),
      row("s2", { parentId: "big", order: 2 }),
    ]);
    expect(ids(todos)).toEqual(["s2"]);
    expect(remaining).toBe(1);
  });

  it("남은 일이 없으면 빈 목록이다", () => {
    expect(buildWidget([row("a", { done: true })])).toEqual({ remaining: 0, todos: [] });
    expect(buildWidget([])).toEqual({ remaining: 0, todos: [] });
  });

  it("내려 주는 줄은 상한까지만이고 남은 개수는 자르기 전의 수다", () => {
    const rows = Array.from({ length: WIDGET_MAX_TODOS + 7 }, (_, index) => row(`t${String(index).padStart(2, "0")}`, { order: index }));
    const { remaining, todos } = buildWidget(rows);
    expect(todos).toHaveLength(WIDGET_MAX_TODOS);
    expect(remaining).toBe(WIDGET_MAX_TODOS + 7);
    expect(todos[0].id).toBe("t00");
  });

  it("같은 순서면 id 순서로 늘 같은 줄 순서를 낸다", () => {
    const { todos } = buildWidget([row("b"), row("a")]);
    expect(ids(todos)).toEqual(["a", "b"]);
  });
});
