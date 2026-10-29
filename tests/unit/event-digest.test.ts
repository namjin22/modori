// 오늘 일정 알림(lib/event-digest.ts): 보낼 차례인지, 알림 문구.
import { describe, expect, it } from "vitest";

import { eventDigestDay, eventDigestPush } from "@/lib/event-digest";

const day = (value: string) => new Date(`${value}T00:00:00Z`);
const seoul0600 = new Date("2026-10-28T21:00:00Z"); // 서울 2026-10-29 06:00
const owner = (overrides: Partial<Parameters<typeof eventDigestDay>[0]> = {}) => ({
  eventDigestMinute: 6 * 60,
  eventDigestSentOn: null,
  timezone: "Asia/Seoul",
  ...overrides,
});

describe("eventDigestDay", () => {
  it("고른 시각이 되면 그 사람의 오늘을 돌려준다", () => {
    expect(eventDigestDay(owner(), seoul0600)).toEqual(day("2026-10-29"));
  });

  it("끈 사람(시각이 비어 있음)에게는 보내지 않는다", () => {
    expect(eventDigestDay(owner({ eventDigestMinute: null }), seoul0600)).toBeNull();
  });

  it("고른 시각 전에는 보내지 않고, 시각부터 30분 안이면 늦게라도 보내고, 그 뒤에는 건너뛴다", () => {
    expect(eventDigestDay(owner(), new Date("2026-10-28T20:59:00Z"))).toBeNull();
    expect(eventDigestDay(owner(), new Date("2026-10-28T21:29:00Z"))).toEqual(day("2026-10-29"));
    expect(eventDigestDay(owner(), new Date("2026-10-28T21:30:00Z"))).toBeNull();
  });

  it("오늘 이미 보냈으면 보내지 않고, 어제 보낸 것은 막지 않는다", () => {
    expect(eventDigestDay(owner({ eventDigestSentOn: day("2026-10-29") }), seoul0600)).toBeNull();
    expect(eventDigestDay(owner({ eventDigestSentOn: day("2026-10-28") }), seoul0600)).toEqual(day("2026-10-29"));
  });

  it("그 사람의 시간대 시계로 센다", () => {
    // 같은 순간이 뉴욕에서는 2026-10-28 17:00이라 6시가 아니다.
    expect(eventDigestDay(owner({ timezone: "America/New_York" }), seoul0600)).toBeNull();
    // 뉴욕 6시(EDT, UTC-4) = 10:00Z.
    expect(eventDigestDay(owner({ timezone: "America/New_York" }), new Date("2026-10-28T10:00:00Z"))).toEqual(day("2026-10-28"));
  });

  it("자정 직전에 고른 시각의 창은 그날 안에서만 센다", () => {
    const late = owner({ eventDigestMinute: 23 * 60 + 50 });
    expect(eventDigestDay(late, new Date("2026-10-29T14:55:00Z"))).toEqual(day("2026-10-29")); // 서울 23:55
    expect(eventDigestDay(late, new Date("2026-10-29T15:05:00Z"))).toBeNull(); // 서울 다음 날 00:05
  });
});

describe("eventDigestPush", () => {
  const today = day("2026-10-29");

  it("일정이 없으면 보내지 않는다", () => {
    expect(eventDigestPush([], today)).toBeNull();
  });

  it("하나면 개수와 제목·시각을 적는다", () => {
    const push = eventDigestPush([{ title: "치과", startDate: today, startTime: 15 * 60 }], today);
    expect(push).toEqual({ title: "모도리", body: "오늘 일정 1개 · 치과 15:00", url: "/", tag: "event-digest" });
  });

  it("여럿이면 첫 일정만 적고 '외'를 붙인다", () => {
    const push = eventDigestPush(
      [
        { title: "치과", startDate: today, startTime: 15 * 60 },
        { title: "학원", startDate: today, startTime: 18 * 60 },
        { title: "시험", startDate: today, startTime: null },
      ],
      today,
    );
    expect(push?.body).toBe("오늘 일정 3개 · 치과 15:00 외");
  });

  it("하루 종일 일정은 시각 없이 제목만 적는다", () => {
    expect(eventDigestPush([{ title: "체험학습", startDate: today, startTime: null }], today)?.body).toBe("오늘 일정 1개 · 체험학습");
  });

  it("어제 시작한 여러 날 일정은 시작 시각을 적지 않는다", () => {
    const push = eventDigestPush([{ title: "수련회", startDate: day("2026-10-28"), startTime: 9 * 60 }], today);
    expect(push?.body).toBe("오늘 일정 1개 · 수련회");
  });

  it("긴 제목은 20자까지만 적고 줄바꿈은 한 칸으로 줄인다", () => {
    const long = eventDigestPush([{ title: "가".repeat(30), startDate: today, startTime: null }], today);
    expect(long?.body).toBe(`오늘 일정 1개 · ${"가".repeat(20)}…`);
    const lines = eventDigestPush([{ title: "수학\n  숙제", startDate: today, startTime: null }], today);
    expect(lines?.body).toBe("오늘 일정 1개 · 수학 숙제");
  });
});
