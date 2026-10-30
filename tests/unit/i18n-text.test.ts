// 화면 언어를 따라 글이 바뀌는 순수 함수들(알림 문구, 반복 규칙, D-day, 반응 이름 등). 한국어 기본값은 각 기능의 기존 시험이 지킨다.
import { describe, expect, it } from "vitest";

import { alarmPush, describeWeekdays } from "@/lib/alarm";
import { ddayLabel } from "@/lib/dday";
import { updateButtonLabel, updateMessage, type UpdateState } from "@/lib/desktop-update";
import { statsMood } from "@/lib/dori-mood";
import { eventDigestPush } from "@/lib/event-digest";
import { describeEventWhen } from "@/lib/event-time";
import { doneNotice, followNotice, reactionNotice } from "@/lib/notices";
import { labelOfReaction } from "@/lib/reactions";
import { describeRoutineRule } from "@/lib/routine";

const day = (value: string) => new Date(`${value}T00:00:00Z`);

describe("알림 문구는 받는 사람의 언어로 만든다", () => {
  it("반응·새 팔로워·친구가 끝낸 일", () => {
    expect(reactionNotice("ko", "진")).toEqual({ title: "반응이 왔어요", body: "진님이 내 할 일에 반응을 보냈어요" });
    expect(reactionNotice("en", "Jin")).toEqual({ title: "New reaction", body: "Jin reacted to your todo" });
    expect(reactionNotice("ja", "ジン")).toEqual({ title: "リアクションが届きました", body: "ジンさんがあなたのやることにリアクションを送りました" });
    expect(followNotice("en", "Jin")).toEqual({ title: "New follower", body: "Jin followed you" });
    expect(doneNotice("ja", "ジン", "英単語")).toEqual({ title: "ジンさんがやることを終えました", body: "英単語" });
  });

  it("닉네임이 없으면 말로 대신한다", () => {
    expect(reactionNotice("en", null).body).toBe("A friend reacted to your todo");
    expect(followNotice("ko", null).body).toBe("누군가님이 나를 팔로우했어요");
  });

  it("오늘 일정 알림", () => {
    const events = [
      { title: "Dentist", startDate: day("2026-10-29"), startTime: 15 * 60 },
      { title: "Cram", startDate: day("2026-10-29"), startTime: 18 * 60 },
    ];
    expect(eventDigestPush(events, day("2026-10-29"), "en")).toMatchObject({ title: "Modori", body: "2 events today · Dentist 15:00 and more" });
    expect(eventDigestPush(events.slice(0, 1), day("2026-10-29"), "en")?.body).toBe("1 event today · Dentist 15:00");
    expect(eventDigestPush(events, day("2026-10-29"), "ja")?.body).toBe("今日の予定 2件 · Dentist 15:00 ほか");
  });

  it("내가 정한 알림은 문구를 그대로 두고 앱 이름만 언어를 따른다", () => {
    expect(alarmPush({ id: "a1", message: "물 마시기" })).toMatchObject({ title: "모도리", body: "물 마시기" });
    expect(alarmPush({ id: "a1", message: "Drink water" }, "en")).toMatchObject({ title: "Modori", body: "Drink water" });
  });
});

describe("반복 규칙·요일·D-day", () => {
  const weekly = { freq: "WEEKLY" as const, byWeekday: [3, 1], byMonthday: [] };
  const monthly = { freq: "MONTHLY" as const, byWeekday: [], byMonthday: [15, 1] };

  it("반복 규칙", () => {
    expect(describeRoutineRule(weekly)).toBe("매주 월·수");
    expect(describeRoutineRule(weekly, "en")).toBe("Every Mon, Wed");
    expect(describeRoutineRule(weekly, "ja")).toBe("毎週 月・水");
    expect(describeRoutineRule(monthly, "en")).toBe("Monthly on day 1, 15");
    expect(describeRoutineRule({ freq: "DAILY", byWeekday: [], byMonthday: [] }, "ja")).toBe("毎日");
  });

  it("알림 요일", () => {
    expect(describeWeekdays([], "en")).toBe("Every day");
    expect(describeWeekdays([1, 2, 3, 4, 5], "en")).toBe("Weekdays");
    expect(describeWeekdays([0, 6], "ja")).toBe("週末");
    expect(describeWeekdays([1, 3, 5], "ja")).toBe("月・水・金");
  });

  it("D-day와 일정 기간", () => {
    expect(ddayLabel(day("2026-10-28"), day("2026-10-31"), day("2026-10-29"), "en")).toBe("Ongoing");
    expect(ddayLabel(day("2026-10-28"), day("2026-10-31"), day("2026-10-29"), "ja")).toBe("進行中");
    expect(ddayLabel(day("2026-11-01"), day("2026-11-01"), day("2026-10-29"), "en")).toBe("D-3");
    expect(describeEventWhen({ startDate: day("2026-09-28"), endDate: day("2026-09-30"), startTime: null, endTime: null }, "en")).toBe("Sep 28 ~ Sep 30");
    expect(describeEventWhen({ startDate: day("2026-09-28"), endDate: day("2026-09-30"), startTime: null, endTime: null }, "ja")).toBe("9月28日 ~ 9月30日");
  });
});

describe("반응 이름", () => {
  it("이모지는 이름표에서, 캐릭터 표정은 이름과 번호로", () => {
    expect(labelOfReaction("🔥")).toBe("불타요");
    expect(labelOfReaction("🔥", "en")).toBe("On fire");
    expect(labelOfReaction("🔥", "ja")).toBe("燃えてる");
    expect(labelOfReaction("mong:pant", "ko")).toMatch(/^몽이 표정 \d+$/);
    expect(labelOfReaction("mong:pant", "en")).toMatch(/^Mongi expression \d+$/);
    expect(labelOfReaction("dori:calm", "ja")).toBe("ドリの表情（眠い）");
    expect(labelOfReaction("dori:calm")).toBe("도리 표정 졸려");
  });

  it("목록에 없는 값은 그대로 보인다", () => {
    expect(labelOfReaction("🦄", "en")).toBe("🦄");
  });
});

describe("그 밖의 글", () => {
  it("기록 화면의 한마디", () => {
    expect(statsMood({ rate: 100, streak: 0, isThisMonth: true }, "en").message).toBe("You did everything");
    expect(statsMood({ rate: 20, streak: 9, isThisMonth: true }, "ja").message).toBe("9日連続で続けています");
  });

  it("앱 안 업데이트 글", () => {
    const downloading = { status: "downloading", percent: 40, version: "1.0.8", supported: true } as unknown as UpdateState;
    expect(updateButtonLabel(downloading, "en")).toBe("Downloading 40%");
    expect(updateMessage(downloading, "ja")).toBe("1.0.8 をダウンロード中です（40%）");
    expect(updateButtonLabel(downloading)).toBe("받는 중 40%");
  });
});
