import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  createCategoryInput,
  createRoutineInput,
  deleteTodosInput,
  friendRangeInput,
  setReactionInput,
  updateCategoryInput,
  updateEventsInput,
  updateProfileInput,
  updateRoutineInput,
  updateSettingsInput,
  updateTodosInput,
} from "@/lib/mcp/inputs-full";
import { normalizeRule, ruleProblem, type RuleValues } from "@/lib/mcp/routine-rule";
import { snapshotSchema } from "@/lib/mcp/snapshot";

// 모든 권한(FULL) 토큰의 도구 입력 모양과 반복 규칙 검사, 되돌리기 기록의 모양(2026-11-16, docs/mcp.md).

const parse = (shape: z.ZodRawShape, value: unknown) => z.object(shape).safeParse(value);

describe("updateTodosInput / updateEventsInput", () => {
  it("바꿀 칸이 하나도 없는 항목은 거절한다(아무 일도 안 하는 호출은 AI의 실수다)", () => {
    expect(parse(updateTodosInput, { updates: [{ id: "abc" }] }).success).toBe(false);
    expect(parse(updateTodosInput, { updates: [{ id: "abc", content: "새 글" }] }).success).toBe(true);
    expect(parse(updateEventsInput, { updates: [{ id: "abc" }] }).success).toBe(false);
    expect(parse(updateEventsInput, { updates: [{ id: "abc", title: "새 이름" }] }).success).toBe(true);
  });

  it("메모와 시각은 null로 지울 수 있고, 시각 모양은 HH:MM이다", () => {
    expect(parse(updateTodosInput, { updates: [{ id: "abc", memo: null }] }).success).toBe(true);
    expect(parse(updateEventsInput, { updates: [{ id: "abc", startTime: null }] }).success).toBe(true);
    expect(parse(updateEventsInput, { updates: [{ id: "abc", startTime: "25:00" }] }).success).toBe(false);
    expect(parse(updateEventsInput, { updates: [{ id: "abc", color: "red" }] }).success).toBe(false);
  });

  it("한 번에 할 일 20개, 일정 10개까지다", () => {
    const todos = Array.from({ length: 21 }, (_, index) => ({ id: `t${index}`, content: "x" }));
    expect(parse(updateTodosInput, { updates: todos }).success).toBe(false);
    expect(parse(updateTodosInput, { updates: todos.slice(0, 20) }).success).toBe(true);
    const events = Array.from({ length: 11 }, (_, index) => ({ id: `e${index}`, title: "x" }));
    expect(parse(updateEventsInput, { updates: events }).success).toBe(false);
  });

  it("지우기는 id 50개까지, 모양이 이상한 id는 거절한다", () => {
    expect(parse(deleteTodosInput, { ids: Array.from({ length: 50 }, (_, index) => `t${index}`) }).success).toBe(true);
    expect(parse(deleteTodosInput, { ids: Array.from({ length: 51 }, (_, index) => `t${index}`) }).success).toBe(false);
    expect(parse(deleteTodosInput, { ids: ["a b"] }).success).toBe(false);
    expect(parse(deleteTodosInput, { ids: [] }).success).toBe(false);
  });
});

describe("카테고리·루틴 입력", () => {
  it("카테고리 이름은 1~20자, 색은 #rrggbb", () => {
    expect(parse(createCategoryInput, { name: "독서", color: "#9333EA" }).success).toBe(true);
    expect(parse(createCategoryInput, { name: "", color: "#9333EA" }).success).toBe(false);
    expect(parse(createCategoryInput, { name: "가".repeat(21), color: "#9333EA" }).success).toBe(false);
    expect(parse(createCategoryInput, { name: "독서", color: "purple" }).success).toBe(false);
    expect(parse(updateCategoryInput, { id: "abc" }).success).toBe(true);
  });

  it("루틴의 주기는 DAILY·WEEKLY·MONTHLY, 요일은 0~6, 날짜는 1~31", () => {
    expect(parse(createRoutineInput, { title: "러닝", frequency: "WEEKLY", weekdays: [1, 3] }).success).toBe(true);
    expect(parse(createRoutineInput, { title: "러닝", frequency: "YEARLY" }).success).toBe(false);
    expect(parse(createRoutineInput, { title: "러닝", frequency: "WEEKLY", weekdays: [7] }).success).toBe(false);
    expect(parse(createRoutineInput, { title: "러닝", frequency: "MONTHLY", monthdays: [0] }).success).toBe(false);
    expect(parse(createRoutineInput, { title: "러닝", frequency: "MONTHLY", monthdays: [32] }).success).toBe(false);
    expect(parse(createRoutineInput, { title: "", frequency: "DAILY" }).success).toBe(false);
  });

  it("루틴 고치기는 끝 날짜와 시각을 null로 지울 수 있다", () => {
    expect(parse(updateRoutineInput, { id: "abc", endDate: null, startTime: null }).success).toBe(true);
    expect(parse(updateRoutineInput, { id: "abc", endDate: "2026-02-xx" }).success).toBe(false);
  });
});

describe("프로필·설정·반응·친구 입력", () => {
  it("닉네임은 1~20자, 소개는 100자까지, 빈 소개는 지우기다", () => {
    expect(parse(updateProfileInput, { nickname: "모도리" }).success).toBe(true);
    expect(parse(updateProfileInput, { nickname: "가".repeat(21) }).success).toBe(false);
    expect(parse(updateProfileInput, { bio: "" }).success).toBe(true);
    expect(parse(updateProfileInput, { bio: "가".repeat(101) }).success).toBe(false);
  });

  it("오늘 일정 알림 시각은 5분 단위이거나 null(끔)이다", () => {
    expect(parse(updateSettingsInput, { eventDigestMinute: 360 }).success).toBe(true);
    expect(parse(updateSettingsInput, { eventDigestMinute: null }).success).toBe(true);
    expect(parse(updateSettingsInput, { eventDigestMinute: 361 }).success).toBe(false);
    expect(parse(updateSettingsInput, { eventDigestMinute: 1440 }).success).toBe(false);
    expect(parse(updateSettingsInput, { eventDigestMinute: -5 }).success).toBe(false);
  });

  it("언어는 AI 도구로 바꾸지 않는다(기기의 쿠키가 계정 값을 덮어써서 약속할 수 없다)", () => {
    expect(Object.keys(updateSettingsInput)).not.toContain("locale");
  });

  it("반응은 할 일 id와 글자가 필요하고, 친구 기간 조회는 from이 필요하다", () => {
    expect(parse(setReactionInput, { todoId: "abc", emoji: "👍" }).success).toBe(true);
    expect(parse(setReactionInput, { todoId: "abc" }).success).toBe(false);
    expect(parse(friendRangeInput, { nickname: "친구", from: "2026-11-16" }).success).toBe(true);
    expect(parse(friendRangeInput, { nickname: "친구" }).success).toBe(false);
    expect(parse(friendRangeInput, { nickname: "", from: "2026-11-16" }).success).toBe(false);
  });
});

describe("반복 규칙 검사(ruleProblem, normalizeRule)", () => {
  const start = new Date("2026-11-16T00:00:00Z");
  const rule = (over: Partial<RuleValues>): RuleValues => ({ freq: "DAILY", byWeekday: [], byMonthday: [], startDate: start, endDate: null, ...over });

  it("매일은 요일·날짜 없이도 된다", () => {
    expect(ruleProblem(rule({}))).toBeNull();
  });

  it("주간은 요일이, 월간은 날짜가 하나는 있어야 한다(없으면 영원히 실행되지 않는다)", () => {
    expect(ruleProblem(rule({ freq: "WEEKLY" }))).toMatch(/weekdays/);
    expect(ruleProblem(rule({ freq: "WEEKLY", byWeekday: [2] }))).toBeNull();
    expect(ruleProblem(rule({ freq: "MONTHLY" }))).toMatch(/monthdays/);
    expect(ruleProblem(rule({ freq: "MONTHLY", byMonthday: [31] }))).toBeNull();
  });

  it("범위를 벗어난 요일·날짜와, 시작보다 이른 끝 날짜는 거절한다", () => {
    expect(ruleProblem(rule({ freq: "WEEKLY", byWeekday: [7] }))).toMatch(/0 \(Sunday\) to 6/);
    expect(ruleProblem(rule({ freq: "MONTHLY", byMonthday: [0] }))).toMatch(/1 to 31/);
    expect(ruleProblem(rule({ endDate: new Date("2026-11-15T00:00:00Z") }))).toMatch(/before startDate/);
    expect(ruleProblem(rule({ endDate: start }))).toBeNull();
  });

  it("저장할 모양: 쓰지 않는 칸은 비우고, 겹치는 값은 하나로 작은 것부터 둔다", () => {
    expect(normalizeRule(rule({ freq: "WEEKLY", byWeekday: [3, 1, 3], byMonthday: [5] }))).toMatchObject({ byWeekday: [1, 3], byMonthday: [] });
    expect(normalizeRule(rule({ freq: "MONTHLY", byWeekday: [2], byMonthday: [20, 5, 5] }))).toMatchObject({ byWeekday: [], byMonthday: [5, 20] });
    expect(normalizeRule(rule({ freq: "DAILY", byWeekday: [2], byMonthday: [5] }))).toMatchObject({ byWeekday: [], byMonthday: [] });
  });
});

describe("되돌리기 기록(snapshotSchema)", () => {
  const todoRow = {
    id: "t1",
    content: "수학",
    date: "2026-11-16",
    done: false,
    doneAt: null,
    order: 0,
    categoryId: null,
    color: null,
    routineId: null,
    memo: null,
    memoPublic: true,
    createdAt: "2026-11-16T00:00:00.000Z",
  };

  it("올바른 기록을 받는다", () => {
    expect(snapshotSchema.safeParse({ kind: "todos-deleted", rows: [todoRow] }).success).toBe(true);
    expect(snapshotSchema.safeParse({ kind: "todos-updated", rows: [{ id: "t1", content: "수학", memo: null, memoPublic: true, categoryId: null, color: null }] }).success).toBe(true);
    expect(snapshotSchema.safeParse({ kind: "category-deleted", category: { id: "c1", name: "공부", color: "#2563eb", isPublic: true, order: 0, todoIds: [], routineIds: [], pausedRoutineIds: [] } }).success).toBe(true);
  });

  it("모르는 종류, 빠진 칸, 잘못된 날짜 모양은 거절한다(DB에서 읽은 값도 믿지 않는다)", () => {
    expect(snapshotSchema.safeParse({ kind: "other", rows: [] }).success).toBe(false);
    expect(snapshotSchema.safeParse({ kind: "todos-deleted" }).success).toBe(false);
    expect(snapshotSchema.safeParse({ kind: "todos-deleted", rows: [{ ...todoRow, date: "내일" }] }).success).toBe(false);
    expect(snapshotSchema.safeParse({ kind: "todos-deleted", rows: [{ ...todoRow, content: undefined }] }).success).toBe(false);
    expect(snapshotSchema.safeParse(null).success).toBe(false);
  });
});
