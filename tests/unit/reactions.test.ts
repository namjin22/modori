import { describe, expect, it } from "vitest";

import {
  DORI_REACTIONS,
  REACTIONS,
  doriMoodOf,
  groupReceivedReactions,
  isReactionValue,
  labelOfReaction,
  othersByEmoji,
  summarizeReactions,
} from "@/lib/reactions";

describe("반응 값", () => {
  it("이모지와 도리 표정 반응만 받는다", () => {
    expect(isReactionValue("👍")).toBe(true);
    expect(isReactionValue("dori:fire")).toBe(true);
    expect(isReactionValue("dori:nothing")).toBe(false);
    expect(isReactionValue("🤡")).toBe(false);
    expect(isReactionValue("")).toBe(false);
  });

  it("도리 반응은 표정으로, 이모지는 null로 푼다", () => {
    expect(doriMoodOf("dori:party")).toBe("party");
    expect(doriMoodOf("🎉")).toBeNull();
  });

  // 화면 읽기는 이름으로 버튼을 구별한다. 이모지 "불타요"와 도리 "불타요"가 같은 이름이면 안 된다.
  it("모든 반응의 이름이 서로 다르다", () => {
    const labels = [
      ...REACTIONS.map((reaction) => reaction.label),
      ...DORI_REACTIONS.map((reaction) => reaction.label),
    ];
    expect(new Set(labels).size).toBe(labels.length);
    expect(labelOfReaction("dori:fire")).toBe("도리 불타요");
    expect(labelOfReaction("🔥")).toBe("불타요");
  });

  it("반응 줄은 고르는 창 순서대로 도리가 먼저 온다", () => {
    const summary = summarizeReactions(
      [
        { emoji: "👍", userId: "a" },
        { emoji: "dori:sad", userId: "b" },
        { emoji: "dori:happy", userId: "me" },
        { emoji: "👍", userId: "me" },
      ],
      "me",
    );
    expect(summary).toEqual([
      { emoji: "dori:happy", count: 1, mine: true },
      { emoji: "dori:sad", count: 1, mine: false },
      { emoji: "👍", count: 2, mine: true },
    ]);
  });
});

describe("groupReceivedReactions", () => {
  it("종류별로 개수와 보낸 사람을 모으고, 고르는 창 순서로 세운다", () => {
    expect(
      groupReceivedReactions([
        { emoji: "🔥", nickname: "민아" },
        { emoji: "dori:clap", nickname: "지훈" },
        { emoji: "🔥", nickname: "서연" },
        { emoji: "🔥", nickname: null },
      ]),
    ).toEqual([
      { emoji: "dori:clap", count: 1, names: ["지훈"] },
      { emoji: "🔥", count: 3, names: ["민아", "서연"] },
    ]);
  });
});

describe("othersByEmoji", () => {
  it("내가 아닌 사람의 닉네임을 이모지별로, 먼저 누른 순서대로 모은다", () => {
    const names = othersByEmoji(
      [
        { emoji: "🔥", userId: "a", user: { nickname: "가" } },
        { emoji: "🔥", userId: "me", user: { nickname: "나" } },
        { emoji: "👍", userId: "b", user: { nickname: "나다" } },
        { emoji: "🔥", userId: "c", user: { nickname: "다" } },
        { emoji: "👍", userId: "d", user: { nickname: null } },
      ],
      "me",
    );
    expect(names).toEqual({ "🔥": ["가", "다"], "👍": ["나다"] });
  });
});
