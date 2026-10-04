import { describe, expect, it } from "vitest";

import { parseSource, sourceFromSearch, sourceFromUserAgent } from "@/lib/signup-source";

describe("가입 경로", () => {
  it("소문자·숫자·하이픈 20자까지만 경로 이름으로 받는다", () => {
    expect(parseSource("discord")).toBe("discord");
    expect(parseSource("  KakaoTalk ")).toBe("kakaotalk");
    expect(parseSource("play-store-1")).toBe("play-store-1");
    expect(parseSource("a".repeat(20))).toBe("a".repeat(20));
  });

  it("글·기호·너무 긴 값·비어 있는 값은 버린다", () => {
    expect(parseSource("a".repeat(21))).toBeNull();
    expect(parseSource("디스코드")).toBeNull();
    expect(parseSource("a b")).toBeNull();
    expect(parseSource("<script>")).toBeNull();
    expect(parseSource("a@b.c")).toBeNull();
    expect(parseSource("")).toBeNull();
    expect(parseSource(null)).toBeNull();
    expect(parseSource(["discord"])).toBeNull();
  });

  it("앱 안에서 연 화면은 user agent 꼬리표로 알아본다", () => {
    expect(sourceFromUserAgent("Mozilla/5.0 (Linux; Android 14) Chrome/130 ModoriMobile/1.0.0")).toBe("app-android");
    expect(sourceFromUserAgent("Mozilla/5.0 (Windows NT 10.0) Chrome/150 ModoriDesktop/1.0.0")).toBe("app-desktop");
    expect(sourceFromUserAgent("Mozilla/5.0 (iPhone) Safari/604")).toBeNull();
  });

  it("로그인으로 보내진 주소에서도 next 안의 from을 찾는다", () => {
    expect(sourceFromSearch("?from=discord")).toBe("discord");
    expect(sourceFromSearch("?next=%2F%3Ffrom%3DKakao")).toBe("kakao");
    expect(sourceFromSearch("?next=%2Ffeed%2Fu%2F1%3Ffrom%3Dsns&error=x")).toBe("sns");
    // 맨 앞의 from이 있으면 그것이 먼저다.
    expect(sourceFromSearch("?from=a&next=%2F%3Ffrom%3Db")).toBe("a");
    expect(sourceFromSearch("")).toBeNull();
    expect(sourceFromSearch("?next=https%3A%2F%2Fevil.example%2F%3Ffrom%3Dx")).toBeNull();
    expect(sourceFromSearch("?next=%2F%3Ffrom%3D%3Cb%3E")).toBeNull();
  });
});
