import type { RoutineFreq } from "@prisma/client";

import { parseKSTDate } from "@/lib/date";

/** 반복 규칙 칸(반복 주기·요일·날짜·시작일·종료일)을 폼에서 읽는다. 루틴 만들기와 고치기, 반복 일정 만들기와 고치기가 같이 쓴다. */
export type RuleFormError = "pickFreq" | "pickWeekday" | "pickMonthday" | "endBeforeStart";

export type RuleForm = {
  freq: RoutineFreq;
  byWeekday: number[];
  byMonthday: number[];
  startDate: Date;
  endDate: Date | null;
};

const FREQS: RoutineFreq[] = ["DAILY", "WEEKLY", "MONTHLY"];

function readText(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

/** 체크박스는 체크된 것만 전송된다. 범위 밖은 버린다. */
function readNumbers(formData: FormData, key: string, min: number, max: number): number[] {
  return formData
    .getAll(key)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= min && value <= max);
}

function readDate(formData: FormData, key: string): Date | null {
  const value = readText(formData, key);
  if (!value) return null;

  try {
    return parseKSTDate(value);
  } catch (error) {
    console.error(`[routine] ${key} 날짜 형식이 잘못됐다.`, error);
    return null;
  }
}

/** 폼이 반복 규칙 칸을 실어 왔는가. 고치기에서 칸이 없으면 규칙은 건드리지 않는다. */
export function hasRuleForm(formData: FormData): boolean {
  return formData.has("freq");
}

/**
 * defaultStart는 시작일 칸이 비었을 때 쓸 날(만들 때는 오늘, 고칠 때는 지금 시작일).
 * 문제가 있으면 화면에 보일 문장의 열쇠를 돌려준다(루틴과 반복 일정이 각자 사전으로 옮긴다).
 */
export function readRuleForm(formData: FormData, defaultStart: Date): RuleForm | RuleFormError {
  const freq = FREQS.find((value) => value === readText(formData, "freq"));
  if (!freq) return "pickFreq";

  const byWeekday = freq === "WEEKLY" ? readNumbers(formData, "byWeekday", 0, 6) : [];
  const byMonthday = freq === "MONTHLY" ? readNumbers(formData, "byMonthday", 1, 31) : [];

  // 요일이나 날짜를 하나도 고르지 않으면 영원히 실행되지 않는다. 받지 않는다.
  if (freq === "WEEKLY" && byWeekday.length === 0) return "pickWeekday";
  if (freq === "MONTHLY" && byMonthday.length === 0) return "pickMonthday";

  const startDate = readDate(formData, "startDate") ?? defaultStart;
  const endDate = readDate(formData, "endDate");
  if (endDate && endDate < startDate) return "endBeforeStart";

  return { freq, byWeekday, byMonthday, startDate, endDate };
}
