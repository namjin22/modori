import { describe, expect, it, vi } from "vitest";

// 발급·교환은 DB를 쓴다(E2E에서 본다). 여기서는 PKCE 계산과 모양 검사만 본다.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { challengeOf, isChallenge, isVerifier } from "@/lib/desktop-login";

describe("challengeOf", () => {
  it("RFC 7636 부록 B의 예와 같은 값을 만든다", () => {
    expect(challengeOf("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });
});

describe("모양 검사", () => {
  it("verifier는 43~128자의 허용된 글자만", () => {
    expect(isVerifier("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(true);
    expect(isVerifier("짧다")).toBe(false);
    expect(isVerifier("a".repeat(129))).toBe(false);
    expect(isVerifier(`${"a".repeat(43)}/`)).toBe(false);
  });

  it("challenge는 43자 base64url", () => {
    expect(isChallenge("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")).toBe(true);
    expect(isChallenge("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-c")).toBe(false);
    expect(isChallenge(null)).toBe(false);
  });
});
