import { dateIn, formatKST, minuteOfDayIn } from "@/lib/date";
import type { PushMessage } from "@/lib/push";
import { timezoneOrDefault } from "@/lib/timezones";

/**
 * 할 일 리마인드: 켠 사람에게 하루 한 번, 고른 시각에 오늘 남은 할 일 수를 앱 푸시로 알린다(2026-10-14 운영자 결정, CLAUDE.md 규칙 7).
 * 남은 일이 없으면 보내지 않는다. 할 일마다 시각을 거는 알림이나 하루 여러 번은 하지 않는다.
 *
 * 서버가 1분마다 돌며(instrumentation.ts → startReminderLoop) 때가 된 사람을 찾는다. 외부 예약 서비스나 VM 예약 작업 없이
 * 앱 서버 하나로 돈다. 서버가 잠깐 꺼져 있었어도 고른 시각부터 이 시간 안이면 늦게라도 보낸다. 그보다 늦으면 그날은 건너뛴다
 * (밤 9시에 고른 알림이 새벽에 오면 안 된다).
 */
export const REMINDER_WINDOW_MINUTES = 30;

/** 처음 켤 때 고르는 시각. 하루가 가기 전에 남은 일을 볼 수 있는 저녁. */
export const DEFAULT_REMINDER_MINUTE = 21 * 60;

/** 자정부터 몇 분째(0~1439)인 5분 단위 값인가. 화면의 시각 고르기(5분 단위)와 맞춘다. */
export function isReminderMinute(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 24 * 60 && value % 5 === 0;
}

export type ReminderOwner = { reminderMinute: number | null; reminderSentOn: Date | null; timezone: string };

/**
 * 지금 이 사람에게 리마인드를 보낼 차례인가. 보낼 차례면 그 사람의 "오늘"을 돌려준다(그 날짜로 남은 일을 세고, 보낸 날로 적는다).
 * 자정 직전에 고른 시각(예: 23:50)도 창이 자정을 넘기지 않게 그날 안에서만 센다.
 */
export function reminderDay(owner: ReminderOwner, now: Date): Date | null {
  if (owner.reminderMinute === null) return null;
  const timezone = timezoneOrDefault(owner.timezone);
  const minute = minuteOfDayIn(now, timezone);
  if (minute < owner.reminderMinute || minute >= owner.reminderMinute + REMINDER_WINDOW_MINUTES) return null;
  const today = dateIn(now, timezone);
  if (owner.reminderSentOn && formatKST(owner.reminderSentOn) === formatKST(today)) return null;
  return today;
}

/**
 * 켜거나 시각을 바꿀 때 적어 둘 "보낸 날". 오늘의 그 시각이 이미 지났으면(밤 10시에 9시로 고름) 오늘은 보낸 것으로 쳐서
 * 고르자마자 알림이 울리지 않게 한다. 아직 안 지났으면 비워 두어 오늘부터 울린다.
 */
export function sentOnWhenSet(minute: number, timezone: string, now: Date): Date | null {
  const zone = timezoneOrDefault(timezone);
  return minuteOfDayIn(now, zone) >= minute ? dateIn(now, zone) : null;
}

export function reminderMessage(left: number): PushMessage {
  return {
    title: "모도리",
    body: `오늘 할 일이 ${left}개 남았어요. 하루가 가기 전에 채워 볼까요?`,
    url: "/",
    tag: "daily-reminder",
  };
}

/** 화면에 보이는 시각. 1260 → "오후 9:00". */
export function formatReminderMinute(minute: number): string {
  const hour = Math.floor(minute / 60);
  const rest = String(minute % 60).padStart(2, "0");
  const half = hour < 12 ? "오전" : "오후";
  const shown = hour % 12 === 0 ? 12 : hour % 12;
  return `${half} ${shown}:${rest}`;
}
