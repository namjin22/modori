import { describe, expect, it } from "vitest";

import { applyTodoChange, type HomeTodo } from "@/components/todo-store";
import { canHaveSubTodos } from "@/lib/sub-todos";

// 세부 할 일(2026-11-20)을 화면이 서버보다 먼저 따라 그리는 규칙. 서버는 lib/sub-todos.ts의 settleSubTodos가 같은 약속을 맞춘다.
const todo = (id: string, patch: Partial<HomeTodo> = {}): HomeTodo => ({
  id,
  date: "2026-11-20",
  content: id,
  done: false,
  color: null,
  memo: null,
  doneAt: null,
  category: { id: "c1", name: "오늘", color: "#2563eb" },
  received: [],
  ...patch,
});

const list = () => [todo("P"), todo("A", { parentId: "P" }), todo("B", { parentId: "P", done: true }), todo("X")];
const byId = (todos: HomeTodo[]) => Object.fromEntries(todos.map((each) => [each.id, each]));

describe("applyTodoChange와 세부 할 일", () => {
  it("큰 할 일을 지우면 세부 할 일도 사라지고 남의 할 일은 그대로다", () => {
    expect(applyTodoChange(list(), { type: "remove", id: "P" }).map((each) => each.id)).toEqual(["X"]);
  });

  it("세부 할 일 하나만 지우면 나머지는 그대로다", () => {
    expect(applyTodoChange(list(), { type: "remove", id: "A" }).map((each) => each.id)).toEqual(["P", "B", "X"]);
  });

  it("큰 할 일이 다른 날로 가면 안 끝낸 세부 할 일은 같이 가고 끝낸 것은 남아 연결이 끊긴다", () => {
    const next = byId(applyTodoChange(list(), { type: "patch", id: "P", patch: { date: "2026-11-21" } }));
    expect(next.P.date).toBe("2026-11-21");
    expect(next.A).toMatchObject({ date: "2026-11-21", parentId: "P" });
    expect(next.B).toMatchObject({ date: "2026-11-20", parentId: null });
  });

  it("큰 할 일의 카테고리가 바뀌면 세부 할 일도 따라간다(끝낸 것도)", () => {
    const category = { id: "c2", name: "공부", color: "#dc2626" };
    const next = byId(applyTodoChange(list(), { type: "patch", id: "P", patch: { category, color: null } }));
    expect(next.A.category).toEqual(category);
    expect(next.B.category).toEqual(category);
    expect(next.X.category?.id).toBe("c1");
  });

  it("글자나 체크를 바꾸는 것은 세부 할 일에 번지지 않는다", () => {
    const next = byId(applyTodoChange(list(), { type: "patch", id: "P", patch: { content: "새 이름", done: true } }));
    expect(next.A).toMatchObject({ content: "A", done: false, parentId: "P" });
  });

  it("세부 할 일 하나를 고쳐도 큰 할 일은 그대로다", () => {
    const next = byId(applyTodoChange(list(), { type: "patch", id: "A", patch: { done: true } }));
    expect(next.A.done).toBe(true);
    expect(next.P.done).toBe(false);
  });

  it("안 끝낸 일을 모두 옮기면 큰 할 일과 안 끝낸 세부 할 일이 같이 가고, 남는 끝낸 세부 할 일은 연결이 끊긴다", () => {
    const next = byId(applyTodoChange(list(), { type: "moveUndone", from: "2026-11-20", to: "2026-11-21" }));
    expect(next.P).toMatchObject({ date: "2026-11-21" });
    expect(next.A).toMatchObject({ date: "2026-11-21", parentId: "P" });
    expect(next.B).toMatchObject({ date: "2026-11-20", parentId: null });
  });

  it("큰 할 일이 이미 끝났으면 안 끝낸 세부 할 일은 혼자 옮겨 가며 연결이 끊긴다", () => {
    const todos = [todo("P", { done: true }), todo("A", { parentId: "P" })];
    const next = byId(applyTodoChange(todos, { type: "moveUndone", from: "2026-11-20", to: "2026-11-21" }));
    expect(next.P.date).toBe("2026-11-20");
    expect(next.A).toMatchObject({ date: "2026-11-21", parentId: null });
  });
});

describe("canHaveSubTodos", () => {
  it("세부 할 일이 아닌 할 일에는 달 수 있고, 세부 할 일 밑에는 또 달지 못한다(2단계)", () => {
    expect(canHaveSubTodos({ parentId: null })).toBe(true);
    expect(canHaveSubTodos({ parentId: "P" })).toBe(false);
  });

  it("루틴이 만든 할 일에도 달 수 있다(2026-11-20 결정). 루틴 표시는 따지지 않는다", () => {
    // 루틴 할 일은 parentId만 비어 있으면 된다. 호출하는 쪽이 루틴 칸을 넘겨도 결과가 같다.
    expect(canHaveSubTodos({ parentId: null, routineId: "R" } as { parentId: string | null })).toBe(true);
  });
});
