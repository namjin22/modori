import { dateIn, formatKST, minuteOfDayIn } from "@/lib/date";
import { formatTime } from "@/lib/event-time";
import { translator, type Locale } from "@/lib/i18n";
import { notices } from "@/lib/i18n/messages/notices";
import type { PushMessage } from "@/lib/push";
import { timezoneOrDefault } from "@/lib/timezones";

/**
 * 오늘 일정 알림(2026-10-29 운영자 요청, CLAUDE.md 규칙 7): 그날 일정이 있으면 아침에 한 번 앱 푸시로 알린다. 일정이 없는 날은 보내지 않는다.
 * 기본은 켜짐, 시각은 6시(사람마다 바꾸거나 끌 수 있다). 앱 푸시로만 보낸다(웹 푸시로는 보내지 않는다).
 *
 * 서버가 1분마다 돌며(lib/push-loop.ts) 때가 된 사람을 찾는다. 서버가 잠깐 꺼져 있었어도 고른 시각부터 이 시간 안이면 늦게라도 보낸다.
 * "오늘 일정"이 점심에 오면 쓸모가 없으니 그보다 늦으면 그날은 건너뛴다.
 */
export const EVENT_DIGEST_WINDOW_MINUTES = 30;

export const DEFAULT_EVENT_DIGEST_MINUTE = 6 * 60;

/** 알림 문구에 넣는 일정 제목의 최대 글자 수. 잠금 화면에서 한 줄로 읽히는 길이로 잡았다. */
export const EVENT_DIGEST_TITLE_LENGTH = 20;

export type EventDigestOwner = { eventDigestMinute: number | null; eventDigestSentOn: Date | null; timezone: string };

/**
 * 지금 이 사람에게 오늘 일정 알림을 보낼 차례인가. 보낼 차례면 그 사람의 "오늘"을 돌려준다(그 날짜의 일정을 찾고, 보낸 날로 적는다).
 * 자정 직전에 고른 시각(예: 23:50)도 창이 자정을 넘기지 않게 그날 안에서만 센다.
 */
export function eventDigestDay(owner: EventDigestOwner, now: Date): Date | null {
  if (owner.eventDigestMinute === null) return null;
  const timezone = timezoneOrDefault(owner.timezone);
  const minute = minuteOfDayIn(now, timezone);
  if (minute < owner.eventDigestMinute || minute >= owner.eventDigestMinute + EVENT_DIGEST_WINDOW_MINUTES) return null;
  const today = dateIn(now, timezone);
  if (owner.eventDigestSentOn && formatKST(owner.eventDigestSentOn) === formatKST(today)) return null;
  return today;
}

export type EventDigestItem = { title: string; startDate: Date; startTime: number | null };

function shortTitle(title: string): string {
  const letters = [...title.replace(/\s+/g, " ").trim()];
  return letters.length > EVENT_DIGEST_TITLE_LENGTH ? `${letters.slice(0, EVENT_DIGEST_TITLE_LENGTH).join("")}…` : letters.join("");
}

/**
 * 오늘 일정 알림 문구. 일정이 없으면 null(보내지 않는다). 첫 일정(화면에 맨 위로 보이는 것)의 제목과 시각만 넣고, 더 있으면 "외"를 붙인다.
 * 시각은 일정이 오늘 시작할 때만 적는다(어제 시작한 여러 날 일정의 시작 시각은 오늘 일이 아니다). 메모는 넣지 않는다.
 * 문구는 푸시 회사(FCM·APNs)를 평문으로 거치므로 개인정보 방침 5번에 적어 두었다.
 */
export function eventDigestPush(events: EventDigestItem[], today: Date, locale: Locale = "ko"): PushMessage | null {
  const [first] = events;
  if (!first) return null;
  const startsToday = formatKST(first.startDate) === formatKST(today);
  const when = startsToday && first.startTime !== null ? ` ${formatTime(first.startTime)}` : "";
  const t = translator(notices, locale);
  const text = `${shortTitle(first.title)}${when}`;
  return {
    title: t("brand"),
    body: events.length > 1 ? t("digestMany", { count: events.length, first: text }) : t("digestOne", { first: text }),
    url: "/",
    tag: "event-digest",
  };
}
