import { describe, expect, it } from "vitest";

import { parseSource, SOURCE_KEY, SOURCE_SCRIPT, sourceFromSearch, sourceFromUserAgent } from "@/lib/signup-source";

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
    // 데스크톱 앱이 연 로그인(provider 없음)은 app-desktop. 모바일 앱처럼 provider가 있으면 아니다.
    expect(sourceFromSearch("?next=%2Fdesktop%2Flogin%3Fchallenge%3Dabc")).toBe("app-desktop");
    expect(sourceFromSearch("?next=%2Fdesktop%2Flogin%3Fchallenge%3Dabc%26provider%3Dgoogle")).toBeNull();
    expect(sourceFromSearch("")).toBeNull();
    expect(sourceFromSearch("?next=https%3A%2F%2Fevil.example%2F%3Ffrom%3Dx")).toBeNull();
    expect(sourceFromSearch("?next=%2F%3Ffrom%3D%3Cb%3E")).toBeNull();
  });
});

// head에서 바로 도는 스크립트(SOURCE_SCRIPT)는 위의 함수와 같은 규칙이어야 한다. 같은 입력을 넣어 저장되는 값을 견준다.
function runScript(search: string, userAgent: string, existing?: string): string | null {
  const store = new Map<string, string>(existing ? [[SOURCE_KEY, existing]] : []);
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  };
  new Function("localStorage", "location", "navigator", SOURCE_SCRIPT)(
    localStorage,
    { search, origin: "https://modori.site" },
    { userAgent },
  );
  return store.get(SOURCE_KEY) ?? null;
}

describe("head 스크립트", () => {
  const cases: [string, string][] = [
    ["?from=Discord", "Mozilla/5.0 Chrome"],
    ["?next=%2F%3Ffrom%3Dkakao", "Mozilla/5.0 Safari"],
    ["?next=%2Fdesktop%2Flogin%3Fchallenge%3Dabc", "Mozilla/5.0 Chrome"],
    ["?next=%2Fdesktop%2Flogin%3Fchallenge%3Dabc%26provider%3Dgoogle", "Mozilla/5.0 Chrome"],
    ["", "Mozilla/5.0 (Linux; Android 14) ModoriMobile/1.0.0"],
    ["", "Mozilla/5.0 (Windows NT 10.0) ModoriDesktop/1.0.0"],
    ["?from=%3Cscript%3E", "Mozilla/5.0 Chrome"],
    ["?next=https%3A%2F%2Fevil.example%2F%3Ffrom%3Dx", "Mozilla/5.0 Chrome"],
    ["", "Mozilla/5.0 Chrome"],
  ];

  it("링크·next·앱 꼬리표에서 TypeScript 함수와 같은 값을 저장한다", () => {
    for (const [search, userAgent] of cases) {
      const expected = sourceFromSearch(search) ?? sourceFromUserAgent(userAgent);
      expect(runScript(search, userAgent), `${search} / ${userAgent}`).toBe(expected);
    }
  });

  it("이미 저장된 경로는 덮어쓰지 않는다(처음 닿은 링크를 센다)", () => {
    expect(runScript("?from=sns", "Mozilla/5.0", "discord")).toBe("discord");
  });
});

