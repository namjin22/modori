import { describe, expect, it } from "vitest";

import {
  API_TOKEN_PREFIX,
  API_TOKEN_EXPIRY_DAYS,
  MAX_API_TOKENS,
  isTokenUsable,
  readBearerToken,
  tokenExpiry,
} from "@/lib/api-token";
import { generateApiToken, hashApiToken } from "@/lib/api-token-secret";

describe("generateApiToken", () => {
  it("mdr_로 시작하는 47자이고, 해시는 64자 16진수다", () => {
    const { token, hash, hint } = generateApiToken();
    expect(token).toMatch(/^mdr_[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hint).toBe(token.slice(0, 8));
    expect(hint.startsWith(API_TOKEN_PREFIX)).toBe(true);
  });

  it("해시는 토큰에서 늘 같게 나오고, 해시에 토큰이 들어 있지 않다", () => {
    const { token, hash } = generateApiToken();
    expect(hashApiToken(token)).toBe(hash);
    expect(hash).not.toContain(token.slice(4));
  });

  it("매번 다른 값이다", () => {
    const values = new Set(Array.from({ length: 50 }, () => generateApiToken().token));
    expect(values.size).toBe(50);
  });
});

describe("readBearerToken", () => {
  const { token } = generateApiToken();

  it("Bearer 머리글에서 토큰을 꺼낸다(Bearer 대소문자·공백 여러 칸·앞뒤 공백 허용)", () => {
    expect(readBearerToken(`Bearer ${token}`)).toBe(token);
    expect(readBearerToken(`bearer ${token}`)).toBe(token);
    expect(readBearerToken(`Bearer   ${token}`)).toBe(token);
    expect(readBearerToken(`  Bearer ${token}  `)).toBe(token);
  });

  it("머리글이 없거나 모양이 틀리면 null", () => {
    expect(readBearerToken(null)).toBeNull();
    expect(readBearerToken("")).toBeNull();
    expect(readBearerToken(token)).toBeNull();
    expect(readBearerToken(`Basic ${token}`)).toBeNull();
    expect(readBearerToken("Bearer mdr_짧다")).toBeNull();
    expect(readBearerToken(`Bearer ${token}x`)).toBeNull();
    expect(readBearerToken(`Bearer ${token.slice(0, -1)}`)).toBeNull();
    expect(readBearerToken(`Bearer xyz_${token.slice(4)}`)).toBeNull();
  });

  it("토큰 뒤에 다른 글이 붙으면 받지 않는다", () => {
    expect(readBearerToken(`Bearer ${token} extra`)).toBeNull();
    expect(readBearerToken(`Bearer ${token}\nBearer ${token}`)).toBeNull();
  });
});

describe("isTokenUsable / tokenExpiry", () => {
  const now = new Date("2026-11-15T00:00:00Z");

  it("만료 시각 전이면 쓸 수 있고, 같거나 지나면 못 쓴다", () => {
    expect(isTokenUsable({ expiresAt: new Date("2026-11-15T00:00:01Z") }, now)).toBe(true);
    expect(isTokenUsable({ expiresAt: now }, now)).toBe(false);
    expect(isTokenUsable({ expiresAt: new Date("2026-11-14T23:59:59Z") }, now)).toBe(false);
  });

  it("만료는 만든 때부터 정확히 days일 뒤", () => {
    expect(tokenExpiry(30, now).toISOString()).toBe("2026-12-15T00:00:00.000Z");
    expect(tokenExpiry(365, now).toISOString()).toBe("2027-11-15T00:00:00.000Z");
  });
});

describe("상한", () => {
  it("유효 기간은 영원이 없고, 토큰은 다섯 개까지", () => {
    expect(API_TOKEN_EXPIRY_DAYS.every((days) => days > 0 && days <= 365)).toBe(true);
    expect(MAX_API_TOKENS).toBe(5);
  });
});
