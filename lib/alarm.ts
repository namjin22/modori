import { dateIn, formatKST, minuteOfDayIn } from "@/lib/date";
import type { PushMessage } from "@/lib/push";
import { timezoneOrDefault } from "@/lib/timezones";

/**
 * 내가 정한 알림(2026-10-26 운영자 요청): 정한 시각·요일에 내가 쓴 문구를 푸시로 받는다. 사람마다 최대 MAX_ALARMS개.
 * 시각은 그 사람 시간대의 시계, 5분 단위(화면의 시각 고르기와 같다). 요일을 안 고르면 매일.
 *
 * 서버가 1분마다 돌며(lib/push-loop.ts의 startPushLoop) 때가 된 알림을 찾는다. 고른 시각부터 ALARM_WINDOW_MINUTES 안에 못 보내면 그날은 건너뛴다.
 * "아침 7시 약 먹기"가 서버가 늦어 7시 반에 오는 것보다 안 오는 것이 낫다.
 */
export const MAX_ALARMS = 10;
export const MAX_ALARM_MESSAGE = 60;
export const ALARM_WINDOW_MINUTES = 5;

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

/** 자정부터 몇 분째(0~1439)인 5분 단위 값인가. 화면의 시각 고르기(5분 단위)와 맞춘다. */
export function isAlarmMinute(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 24 * 60 && value % 5 === 0;
}

/** 문구: 앞뒤 공백을 걷고, 줄바꿈·연속 공백은 한 칸으로. 비었거나 MAX_ALARM_MESSAGE자를 넘으면 null. 제어 문자가 섞이면 null. */
export function readAlarmMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length === 0 || [...text].length > MAX_ALARM_MESSAGE) return null;
  return text;
}

/** 요일 목록: 0~6의 정수만, 중복은 한 번, 오름차순. 일곱 요일을 다 고르면 "매일"과 같으므로 비운다. 모양이 틀리면 null. */
export function readWeekdays(values: unknown): number[] | null {
  if (!Array.isArray(values) || values.length > 14) return null;
  const days = new Set<number>();
  for (const value of values) {
    const day = typeof value === "string" && /^[0-6]$/.test(value) ? Number(value) : value;
    if (typeof day !== "number" || !Number.isInteger(day) || day < 0 || day > 6) return null;
    days.add(day);
  }
  return days.size === 7 ? [] : [...days].sort((a, b) => a - b);
}

/** 화면에 보이는 요일 말. [] → "매일", [1..5] → "평일", [0, 6] → "주말", 그 밖에는 "월·수·금". */
export function describeWeekdays(weekdays: number[]): string {
  if (weekdays.length === 0) return "매일";
  const key = weekdays.join(",");
  if (key === "1,2,3,4,5") return "평일";
  if (key === "0,6") return "주말";
  return weekdays.map((day) => WEEKDAY_NAMES[day]).join("·");
}

export type AlarmTiming = { minute: number; weekdays: number[]; lastSentOn: Date | null };

/**
 * 지금 이 알림을 보낼 차례인가. 보낼 차례면 그 사람의 "오늘"을 돌려준다(보낸 날로 적는다).
 * 시각 창이 자정을 넘기지 않게 그날 안에서만 센다(23:55의 창은 23:59까지).
 */
export function alarmDay(alarm: AlarmTiming, timezone: string, now: Date): Date | null {
  if (!isAlarmMinute(alarm.minute)) return null;
  const zone = timezoneOrDefault(timezone);
  const minute = minuteOfDayIn(now, zone);
  if (minute < alarm.minute || minute >= alarm.minute + ALARM_WINDOW_MINUTES) return null;
  const today = dateIn(now, zone);
  // dateIn은 그 날짜의 UTC 자정이라 getUTCDay가 그 사람 쪽 요일이다.
  if (alarm.weekdays.length > 0 && !alarm.weekdays.includes(today.getUTCDay())) return null;
  if (alarm.lastSentOn && formatKST(alarm.lastSentOn) === formatKST(today)) return null;
  return today;
}

/**
 * 만들거나 시각·요일을 고치거나 켤 때 적어 둘 "보낸 날". 오늘의 그 시각이 이미 지났으면 오늘은 보낸 것으로 쳐서
 * 만들자마자 울리지 않게 한다(밤 10시에 7시 알림을 만들었을 때). 아직 안 지났으면 비워 오늘부터 울린다.
 */
export function alarmSentOnWhenSet(minute: number, timezone: string, now: Date): Date | null {
  const zone = timezoneOrDefault(timezone);
  return minuteOfDayIn(now, zone) >= minute ? dateIn(now, zone) : null;
}

export function alarmPush(alarm: { id: string; message: string }): PushMessage {
  return { title: "모도리", body: alarm.message, url: "/", tag: `alarm:${alarm.id}` };
}
