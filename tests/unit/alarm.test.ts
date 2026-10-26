import { describe, expect, it } from "vitest";

import {
  ALARM_WINDOW_MINUTES,
  alarmDay,
  alarmPush,
  alarmSentOnWhenSet,
  describeWeekdays,
  MAX_ALARM_MESSAGE,
  readAlarmMessage,
  readWeekdays,
} from "@/lib/alarm";

// 2026-10-26(월) 07:00 서울 = 2026-10-25 22:00 UTC
const seoul0700 = new Date("2026-10-25T22:00:00Z");
const timing = (overrides: Partial<{ minute: number; weekdays: number[]; lastSentOn: Date | null }> = {}) => ({
  minute: 7 * 60,
  weekdays: [] as number[],
  lastSentOn: null,
  ...overrides,
});

describe("alarmDay", () => {
  it("정한 시각이 되면 그 사람의 오늘을 돌려준다", () => {
    expect(alarmDay(timing(), "Asia/Seoul", seoul0700)?.toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });

  it("시각 전이나 창이 지난 뒤에는 보내지 않는다(늦은 알림은 건너뛴다)", () => {
    expect(alarmDay(timing(), "Asia/Seoul", new Date(seoul0700.getTime() - 60_000))).toBeNull();
    expect(alarmDay(timing(), "Asia/Seoul", new Date(seoul0700.getTime() + (ALARM_WINDOW_MINUTES - 1) * 60_000))).not.toBeNull();
    expect(alarmDay(timing(), "Asia/Seoul", new Date(seoul0700.getTime() + ALARM_WINDOW_MINUTES * 60_000))).toBeNull();
  });

  it("그 사람의 시간대 시계를 따른다: 같은 순간이 서울에서는 7시, 뉴욕에서는 그 전날 18시", () => {
    expect(alarmDay(timing(), "America/New_York", seoul0700)).toBeNull();
    // 뉴욕 07:00(EDT, UTC-4) = 11:00 UTC
    const newYork0700 = new Date("2026-10-26T11:00:00Z");
    expect(alarmDay(timing(), "America/New_York", newYork0700)?.toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect(alarmDay(timing(), "Asia/Seoul", newYork0700)).toBeNull();
  });

  it("요일을 골랐으면 그 요일(그 사람 쪽 달력)에만, 비었으면 매일", () => {
    // 2026-10-26은 월요일(1)
    expect(alarmDay(timing({ weekdays: [1] }), "Asia/Seoul", seoul0700)).not.toBeNull();
    expect(alarmDay(timing({ weekdays: [0, 2, 3] }), "Asia/Seoul", seoul0700)).toBeNull();
    expect(alarmDay(timing({ weekdays: [] }), "Asia/Seoul", seoul0700)).not.toBeNull();
    // 같은 순간 하와이는 일요일 오후 9시라 월요일 알림이 아니다.
    const hawaiiSunday = new Date("2026-10-26T07:00:00Z"); // 하와이 10-25(일) 21:00
    expect(alarmDay(timing({ minute: 21 * 60, weekdays: [1] }), "Pacific/Honolulu", hawaiiSunday)).toBeNull();
    expect(alarmDay(timing({ minute: 21 * 60, weekdays: [0] }), "Pacific/Honolulu", hawaiiSunday)).not.toBeNull();
  });

  it("오늘 이미 보냈으면 다시 보내지 않는다. 어제 보낸 것은 상관없다", () => {
    expect(alarmDay(timing({ lastSentOn: new Date("2026-10-26T00:00:00Z") }), "Asia/Seoul", seoul0700)).toBeNull();
    expect(alarmDay(timing({ lastSentOn: new Date("2026-10-25T00:00:00Z") }), "Asia/Seoul", seoul0700)).not.toBeNull();
  });

  it("5분 단위가 아닌 값은 보내지 않는다", () => {
    expect(alarmDay(timing({ minute: 7 * 60 + 3 }), "Asia/Seoul", seoul0700)).toBeNull();
  });

  it("자정 직전 알림의 창은 자정을 넘기지 않는다", () => {
    const at2355 = new Date("2026-10-26T14:55:00Z"); // 서울 23:55
    expect(alarmDay(timing({ minute: 23 * 60 + 55 }), "Asia/Seoul", at2355)).not.toBeNull();
    const at0001 = new Date("2026-10-26T15:01:00Z"); // 서울 다음날 00:01
    expect(alarmDay(timing({ minute: 23 * 60 + 55 }), "Asia/Seoul", at0001)).toBeNull();
  });
});

describe("alarmSentOnWhenSet", () => {
  it("오늘의 그 시각이 이미 지났으면 오늘을 보낸 날로 적어 만들자마자 울리지 않게 한다", () => {
    const at2200 = new Date("2026-10-26T13:00:00Z"); // 서울 22:00
    expect(alarmSentOnWhenSet(7 * 60, "Asia/Seoul", at2200)?.toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect(alarmSentOnWhenSet(23 * 60, "Asia/Seoul", at2200)).toBeNull();
  });
});

describe("readAlarmMessage", () => {
  it("앞뒤 공백을 걷고 줄바꿈·연속 공백은 한 칸으로 줄인다", () => {
    expect(readAlarmMessage("  물   마시기\n  하기 ")).toBe("물 마시기 하기");
  });

  it("비었거나 너무 길거나 글자가 아닌 것(제어 문자)이 섞이면 거절한다", () => {
    expect(readAlarmMessage("")).toBeNull();
    expect(readAlarmMessage("   ")).toBeNull();
    expect(readAlarmMessage("가".repeat(MAX_ALARM_MESSAGE))).not.toBeNull();
    expect(readAlarmMessage("가".repeat(MAX_ALARM_MESSAGE + 1))).toBeNull();
    expect(readAlarmMessage("물\u0000마시기")).toBeNull();
    expect(readAlarmMessage(123)).toBeNull();
    expect(readAlarmMessage(null)).toBeNull();
  });

  it("이모지는 한 글자로 센다", () => {
    expect(readAlarmMessage("💧".repeat(MAX_ALARM_MESSAGE))).not.toBeNull();
  });
});

describe("readWeekdays", () => {
  it("문자열로 와도 숫자로 바꾸고 중복은 한 번, 오름차순", () => {
    expect(readWeekdays(["3", "1", "3"])).toEqual([1, 3]);
  });

  it("일곱 요일을 다 골랐으면 매일과 같아 빈 목록", () => {
    expect(readWeekdays(["0", "1", "2", "3", "4", "5", "6"])).toEqual([]);
  });

  it("범위 밖이거나 모양이 틀리면 거절", () => {
    expect(readWeekdays(["7"])).toBeNull();
    expect(readWeekdays(["-1"])).toBeNull();
    expect(readWeekdays(["1.5"])).toBeNull();
    expect(readWeekdays("1")).toBeNull();
    expect(readWeekdays(Array.from({ length: 20 }, () => "1"))).toBeNull();
  });
});

describe("describeWeekdays / alarmPush", () => {
  it("보기 좋은 말로", () => {
    expect(describeWeekdays([])).toBe("매일");
    expect(describeWeekdays([1, 2, 3, 4, 5])).toBe("평일");
    expect(describeWeekdays([0, 6])).toBe("주말");
    expect(describeWeekdays([1, 3, 5])).toBe("월·수·금");
  });

  it("푸시는 내가 쓴 문구 그대로, 같은 알림은 기기에서 하나로 묶인다", () => {
    expect(alarmPush({ id: "a1", message: "물 마시기" })).toEqual({ title: "모도리", body: "물 마시기", url: "/", tag: "alarm:a1" });
  });
});
