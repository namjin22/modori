import type { RoutineFreq } from "@prisma/client";

/**
 * 반복 규칙(루틴·반복 일정 공통). 서버 액션의 readRuleForm(lib/routine-rule-form.ts)과 같은 규칙을 폼이 아니라 값으로 검사한다.
 * 요일이나 날짜를 하나도 고르지 않은 주간·월간 규칙은 영원히 실행되지 않으므로 받지 않는다.
 */
export type RuleValues = {
  freq: RoutineFreq;
  byWeekday: number[];
  byMonthday: number[];
  startDate: Date;
  endDate: Date | null;
};

/** 문제가 있으면 AI가 읽고 고칠 문장, 없으면 null. */
export function ruleProblem(rule: RuleValues): string | null {
  if (rule.freq === "WEEKLY" && rule.byWeekday.length === 0) return "weekdays is required for WEEKLY (0=Sunday … 6=Saturday).";
  if (rule.freq === "MONTHLY" && rule.byMonthday.length === 0) return "monthdays is required for MONTHLY (1 … 31).";
  if (rule.byWeekday.some((value) => !Number.isInteger(value) || value < 0 || value > 6)) return "weekdays must be integers from 0 (Sunday) to 6 (Saturday).";
  if (rule.byMonthday.some((value) => !Number.isInteger(value) || value < 1 || value > 31)) return "monthdays must be integers from 1 to 31.";
  if (rule.endDate && rule.endDate < rule.startDate) return "endDate is before startDate.";
  return null;
}

/** 저장할 모양: 쓰지 않는 칸은 비운다(DAILY는 요일·날짜 없음, WEEKLY는 날짜 없음, MONTHLY는 요일 없음). 겹치는 값은 하나로, 작은 것부터. */
export function normalizeRule(rule: RuleValues): RuleValues {
  const unique = (values: number[]) => [...new Set(values)].sort((a, b) => a - b);
  return {
    freq: rule.freq,
    byWeekday: rule.freq === "WEEKLY" ? unique(rule.byWeekday) : [],
    byMonthday: rule.freq === "MONTHLY" ? unique(rule.byMonthday) : [],
    startDate: rule.startDate,
    endDate: rule.endDate,
  };
}
