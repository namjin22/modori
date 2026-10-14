import { describe, expect, it } from "vitest";

import { minuteOfDayIn } from "@/lib/date";
import {
  formatReminderMinute,
  isReminderMinute,
  reminderDay,
  reminderMessage,
  REMINDER_WINDOW_MINUTES,
  sentOnWhenSet,
} from "@/lib/reminder";

// 2026-10-14 12:00 UTC = 서울 21:00, 토론토 08:00.
const NOON_UTC = new Date("2026-10-14T12:00:00Z");
const day = (key: string) => new Date(`${key}T00:00:00Z`);

describe("minuteOfDayIn", () => {
  it("그 시간대의 시계로 자정부터 몇 분째인지 센다(서머타임 포함)", () => {
    expect(minuteOfDayIn(NOON_UTC, "Asia/Seoul")).toBe(21 * 60);
    expect(minuteOfDayIn(NOON_UTC, "America/Toronto")).toBe(8 * 60);
    expect(minuteOfDayIn(new Date("2026-10-14T15:00:00Z"), "Asia/Seoul")).toBe(0);
  });
});

describe("reminderDay", () => {
  const owner = { reminderMinute: 21 * 60, reminderSentOn: null, timezone: "Asia/Seoul" };

  it("고른 시각부터 창 안이면 그 사람의 오늘을 돌려준다", () => {
    expect(reminderDay(owner, NOON_UTC)).toEqual(day("2026-10-14"));
    const late = new Date(NOON_UTC.getTime() + (REMINDER_WINDOW_MINUTES - 1) * 60_000);
    expect(reminderDay(owner, late)).toEqual(day("2026-10-14"));
  });

  it("고른 시각 전이거나 창이 지났으면 보내지 않는다(밤 9시 알림이 새벽에 오지 않게)", () => {
    expect(reminderDay(owner, new Date(NOON_UTC.getTime() - 60_000))).toBeNull();
    expect(reminderDay(owner, new Date(NOON_UTC.getTime() + REMINDER_WINDOW_MINUTES * 60_000))).toBeNull();
  });

  it("오늘 이미 보냈으면 다시 보내지 않고, 어제 보냈으면 오늘 또 보낸다", () => {
    expect(reminderDay({ ...owner, reminderSentOn: day("2026-10-14") }, NOON_UTC)).toBeNull();
    expect(reminderDay({ ...owner, reminderSentOn: day("2026-10-13") }, NOON_UTC)).toEqual(day("2026-10-14"));
  });

  it("끈 사람(시각 없음)에게는 보내지 않는다", () => {
    expect(reminderDay({ ...owner, reminderMinute: null }, NOON_UTC)).toBeNull();
  });

  it("그 사람의 시간대로 센다: 같은 순간 토론토는 아침 8시라 저녁 9시 알림 차례가 아니다", () => {
    expect(reminderDay({ ...owner, timezone: "America/Toronto" }, NOON_UTC)).toBeNull();
    expect(reminderDay({ ...owner, reminderMinute: 8 * 60, timezone: "America/Toronto" }, NOON_UTC)).toEqual(day("2026-10-14"));
  });
});

describe("sentOnWhenSet", () => {
  it("오늘의 그 시각이 이미 지났으면 오늘은 보낸 것으로 쳐서 고르자마자 울리지 않는다", () => {
    expect(sentOnWhenSet(20 * 60, "Asia/Seoul", NOON_UTC)).toEqual(day("2026-10-14"));
    expect(sentOnWhenSet(22 * 60, "Asia/Seoul", NOON_UTC)).toBeNull();
  });
});

describe("값과 문구", () => {
  it("5분 단위의 하루 안 값만 받는다", () => {
    expect(isReminderMinute(21 * 60)).toBe(true);
    expect(isReminderMinute(0)).toBe(true);
    expect(isReminderMinute(1437)).toBe(false);
    expect(isReminderMinute(24 * 60)).toBe(false);
    expect(isReminderMinute(-5)).toBe(false);
    expect(isReminderMinute("1260")).toBe(false);
  });

  it("남은 수만 알리고 할 일 내용은 넣지 않는다", () => {
    expect(reminderMessage(3)).toEqual({
      title: "모도리",
      body: "오늘 할 일이 3개 남았어요. 하루가 가기 전에 채워 볼까요?",
      url: "/",
      tag: "daily-reminder",
    });
  });

  it("시각을 오전·오후로 보인다", () => {
    expect(formatReminderMinute(21 * 60)).toBe("오후 9:00");
    expect(formatReminderMinute(0)).toBe("오전 12:00");
    expect(formatReminderMinute(12 * 60 + 5)).toBe("오후 12:05");
  });
});
