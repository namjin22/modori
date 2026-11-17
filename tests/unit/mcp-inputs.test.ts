import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  MCP_LIMITS,
  addTodoMemosInput,
  completeTodosInput,
  createEventsInput,
  createTodosInput,
  listTodosInput,
  moveTodosInput,
  undoBatchInput,
} from "@/lib/mcp/inputs";

const schema = (shape: z.ZodRawShape) => z.object(shape);
const createTodosSchema = z.object(createTodosInput);
const createEventsSchema = z.object(createEventsInput);
const todo = { content: "수학 문제집 3단원", date: "2026-11-20" };

describe("createTodosInput", () => {
  const parse = (value: unknown) => createTodosSchema.safeParse(value);

  it("올바른 할 일을 받고, 글 앞뒤 공백은 자른다", () => {
    const result = parse({ todos: [{ ...todo, content: "  영어 단어  ", category: "공부", memo: "  p.30  " }] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.todos[0].content).toBe("영어 단어");
      expect(result.data.todos[0].memo).toBe("p.30");
    }
  });

  it("한 번에 20개까지, 0개나 21개는 거절한다", () => {
    expect(parse({ todos: Array.from({ length: MCP_LIMITS.todosPerCall }, () => todo) }).success).toBe(true);
    expect(parse({ todos: Array.from({ length: MCP_LIMITS.todosPerCall + 1 }, () => todo) }).success).toBe(false);
    expect(parse({ todos: [] }).success).toBe(false);
  });

  it("내용은 1~200자, 메모는 500자까지", () => {
    expect(parse({ todos: [{ ...todo, content: "" }] }).success).toBe(false);
    expect(parse({ todos: [{ ...todo, content: "   " }] }).success).toBe(false);
    expect(parse({ todos: [{ ...todo, content: "가".repeat(200) }] }).success).toBe(true);
    expect(parse({ todos: [{ ...todo, content: "가".repeat(201) }] }).success).toBe(false);
    expect(parse({ todos: [{ ...todo, memo: "가".repeat(501) }] }).success).toBe(false);
  });

  it("날짜는 YYYY-MM-DD 모양만 받는다(진짜 날짜인지는 도구가 따로 본다)", () => {
    for (const date of ["2026/11/20", "2026-1-2", "내일", "2026-11-20T00:00:00Z", ""]) {
      expect(parse({ todos: [{ ...todo, date }] }).success, date).toBe(false);
    }
  });
});

describe("createEventsInput", () => {
  const parse = (value: unknown) => createEventsSchema.safeParse(value);
  const event = { title: "중간고사", startDate: "2026-12-01" };

  it("일정은 한 번에 10개까지", () => {
    expect(parse({ events: Array.from({ length: MCP_LIMITS.eventsPerCall }, () => event) }).success).toBe(true);
    expect(parse({ events: Array.from({ length: MCP_LIMITS.eventsPerCall + 1 }, () => event) }).success).toBe(false);
  });

  it("시각은 HH:MM(24시간), 색은 #rrggbb만", () => {
    expect(parse({ events: [{ ...event, startTime: "09:30", endTime: "23:59" }] }).success).toBe(true);
    for (const startTime of ["9:30", "24:00", "12:60", "09:30:00", "오전"]) {
      expect(parse({ events: [{ ...event, startTime }] }).success, startTime).toBe(false);
    }
    expect(parse({ events: [{ ...event, color: "#2563eb" }] }).success).toBe(true);
    for (const color of ["2563eb", "#25e", "red", "#gggggg", "#2563eb00"]) {
      expect(parse({ events: [{ ...event, color }] }).success, color).toBe(false);
    }
  });

  it("공개 여부는 안 적으면 비어 있다(도구가 비공개로 처리한다)", () => {
    const result = parse({ events: [event] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.events[0].isPublic).toBeUndefined();
  });
});

describe("id 목록", () => {
  it("완료·옮기기는 id를 50개까지, 이상한 글자가 든 id는 거절한다", () => {
    const ids = (count: number) => Array.from({ length: count }, (_, index) => `id${index}`);
    expect(schema(completeTodosInput).safeParse({ ids: ids(MCP_LIMITS.idsPerCall) }).success).toBe(true);
    expect(schema(completeTodosInput).safeParse({ ids: ids(MCP_LIMITS.idsPerCall + 1) }).success).toBe(false);
    expect(schema(completeTodosInput).safeParse({ ids: [] }).success).toBe(false);
    for (const bad of ["a b", "a;b", "../x", "a".repeat(65), ""]) {
      expect(schema(completeTodosInput).safeParse({ ids: [bad] }).success, bad).toBe(false);
      expect(schema(moveTodosInput).safeParse({ ids: [bad], date: "2026-11-20" }).success, bad).toBe(false);
    }
    expect(schema(undoBatchInput).safeParse({ batchId: "cmabc123_-X" }).success).toBe(true);
    expect(schema(undoBatchInput).safeParse({ batchId: "x y" }).success).toBe(false);
  });

  it("목록 조회의 to는 안 적어도 된다", () => {
    expect(schema(listTodosInput).safeParse({ from: "2026-11-20" }).success).toBe(true);
    expect(schema(listTodosInput).safeParse({ to: "2026-11-20" }).success).toBe(false);
  });
});

describe("addTodoMemosInput", () => {
  const parse = (value: unknown) => z.object(addTodoMemosInput).safeParse(value);

  it("id와 메모를 받고, 메모의 앞뒤 공백을 자른다", () => {
    const result = parse({ memos: [{ id: "abc", memo: "  p.30~45  " }] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.memos[0].memo).toBe("p.30~45");
  });

  it("빈 메모·500자 넘는 메모·모양이 틀린 id·빈 목록·한 번에 너무 많은 개수는 거절한다(지우기는 update_todos의 일)", () => {
    expect(parse({ memos: [{ id: "abc", memo: "   " }] }).success).toBe(false);
    expect(parse({ memos: [{ id: "abc", memo: "가".repeat(501) }] }).success).toBe(false);
    expect(parse({ memos: [{ id: "abc", memo: "가".repeat(500) }] }).success).toBe(true);
    expect(parse({ memos: [{ id: "../x", memo: "메모" }] }).success).toBe(false);
    expect(parse({ memos: [] }).success).toBe(false);
    expect(parse({ memos: Array.from({ length: MCP_LIMITS.todosPerCall + 1 }, (_, index) => ({ id: `t${index}`, memo: "메모" })) }).success).toBe(false);
  });

  it("replace는 true·false만 받는다", () => {
    expect(parse({ memos: [{ id: "abc", memo: "메모" }], replace: true }).success).toBe(true);
    expect(parse({ memos: [{ id: "abc", memo: "메모" }], replace: "yes" }).success).toBe(false);
  });
});
