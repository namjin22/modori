import { describe, expect, it, vi } from "vitest";

// 겹침 검사(isNicknameTaken)는 DB를 쓴다. 여기서는 글자 정리만 본다.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { normalizeNickname, validateNickname } from "@/lib/nickname";

describe("normalizeNickname", () => {
  it("앞뒤 공백과 연속 공백을 정리한다", () => {
    expect(normalizeNickname("  모  도리 ")).toBe("모 도리");
  });

  it("보이지 않는 글자를 지워 똑같아 보이는 이름이 따로 생기지 않게 한다", () => {
    expect(normalizeNickname("남진​")).toBe("남진");
    expect(normalizeNickname("‍남⁦진")).toBe("남진");
  });

  it("한글 채움 문자만 있는 이름은 빈 이름이 된다", () => {
    expect(normalizeNickname("ㅤㅤ")).toBe("");
    expect(validateNickname(normalizeNickname("ㅤ")).ok).toBe(false);
  });

  it("자모로 풀린 한글(NFD)을 완성형(NFC)으로 모은다", () => {
    const nfd = "모도리".normalize("NFD");
    expect(nfd).not.toBe("모도리");
    expect(normalizeNickname(nfd)).toBe("모도리");
  });

  it("문자열이 아니면 빈 이름", () => {
    expect(normalizeNickname(null)).toBe("");
  });
});
