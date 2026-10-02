import { describe, expect, it } from "vitest";

import { loginHref, safeNext } from "@/lib/next-path";

describe("safeNext", () => {
  it("우리 사이트 안의 경로만 받는다", () => {
    expect(safeNext("/feed/u/abc")).toBe("/feed/u/abc");
    expect(safeNext("/?date=2026-09-28")).toBe("/?date=2026-09-28");
  });

  it("다른 사이트로 가는 값은 거른다", () => {
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("/\\evil.example")).toBeNull();
    expect(safeNext("javascript:alert(1)")).toBeNull();
    expect(safeNext(undefined)).toBeNull();
    expect(safeNext(["/feed"])).toBeNull();
  });

  it("브라우저가 지워 읽는 제어문자(탭·줄바꿈)로 //나쁜곳을 만드는 우회를 막는다", () => {
    expect(safeNext("/\t/evil.example")).toBeNull();
    expect(safeNext("/\n/evil.example")).toBeNull();
    expect(safeNext("/\r/evil.example")).toBeNull();
    expect(safeNext("/feed\u0000/x")).toBeNull();
    expect(safeNext("/feed\\evil")).toBeNull();
  });

  it("로그인·닉네임 화면과 홈은 돌아갈 곳으로 두지 않는다", () => {
    expect(safeNext("/login")).toBeNull();
    expect(safeNext("/onboarding?next=/feed")).toBeNull();
    expect(safeNext("/")).toBeNull();
  });
});

describe("loginHref", () => {
  it("돌아갈 곳을 주소에 담는다", () => {
    expect(loginHref("/feed/u/abc")).toBe("/login?next=%2Ffeed%2Fu%2Fabc");
    expect(loginHref(null)).toBe("/login");
  });
});
