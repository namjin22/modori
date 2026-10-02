import { describe, expect, it } from "vitest";

import {
  CHARACTER_REACTIONS,
  REACTIONS,
  characterMoodOf,
  groupReceivedReactions,
  isReactionValue,
  labelOfReaction,
  othersByEmoji,
  summarizeReactions,
} from "@/lib/reactions";

describe("반응 값", () => {
  it("이모지와 캐릭터 표정 반응만 받는다", () => {
    expect(isReactionValue("👍")).toBe(true);
    expect(isReactionValue("dori:fire")).toBe(true);
    expect(isReactionValue("mong:pant")).toBe(true);
    expect(isReactionValue("haru:shy")).toBe(true);
    expect(isReactionValue("peng:snowman")).toBe(true);
    // 예전에 보낸 도리 반응(졸려·놀람)은 계속 받는다.
    expect(isReactionValue("dori:calm")).toBe(true);
    expect(isReactionValue("dori:wow")).toBe(true);
    // 다른 캐릭터에게 없는 표정이나 없는 캐릭터는 거절한다.
    expect(isReactionValue("mong:fire")).toBe(false);
    expect(isReactionValue("dori:nothing")).toBe(false);
    expect(isReactionValue("cat:happy")).toBe(false);
    expect(isReactionValue("🤡")).toBe(false);
    expect(isReactionValue("")).toBe(false);
  });

  it("캐릭터 반응은 캐릭터와 표정으로, 이모지는 null로 푼다", () => {
    expect(characterMoodOf("dori:party")).toEqual({ character: "dori", mood: "party" });
    expect(characterMoodOf("peng:fish")).toEqual({ character: "peng", mood: "fish" });
    expect(characterMoodOf("🎉")).toBeNull();
  });

  it("캐릭터마다 표정 열 개(공통 여섯 + 개성 넷)이고 값이 서로 다르다", () => {
    for (const id of ["dori", "mong", "haru", "peng"]) {
      expect(CHARACTER_REACTIONS.filter((reaction) => reaction.character === id)).toHaveLength(10);
    }
    const values = CHARACTER_REACTIONS.map((reaction) => reaction.value);
    expect(new Set(values).size).toBe(values.length);
  });

  // 화면 읽기는 이름으로 버튼을 구별한다. 표정마다 이름을 붙이지 않고 번호만 달아도 서로 달라야 한다.
  it("모든 반응의 이름이 서로 다르다", () => {
    const labels = [
      ...REACTIONS.map((reaction) => reaction.label),
      ...CHARACTER_REACTIONS.map((reaction) => reaction.label),
    ];
    expect(new Set(labels).size).toBe(labels.length);
    expect(labelOfReaction("dori:fire")).toBe("도리 표정 7");
    expect(labelOfReaction("mong:pant")).toBe("몽이 표정 7");
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
