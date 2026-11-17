import { Auth, skipCSRFCheck, type AuthConfig } from "@auth/core";
import Apple from "@auth/core/providers/apple";
import Google from "@auth/core/providers/google";
import { describe, expect, it } from "vitest";

import { callbackUrlCookies } from "@/lib/auth-cookies";

// iOS 앱에서 Apple로 로그인하면 앱으로 돌아오지 못하고 웹에 남던 문제(2026-11-16).
// Apple은 로그인 결과를 POST로 돌려보내 SameSite=Lax인 "돌아갈 주소" 쿠키가 사라진다. 실제 Auth.js가 만드는 쿠키 머리글로 확인한다.
const RETURN_PATH = "/desktop/login?challenge=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP&from=app-ios";

async function startSignIn(provider: "apple" | "google", cookies: AuthConfig["cookies"]) {
  const config: AuthConfig = {
    providers: [
      Apple({ clientId: "client", clientSecret: "secret" }),
      // Google은 로그인 화면 주소를 알아내려고 인터넷을 부르지 않게 끝점을 직접 적어 준다.
      Google({
        clientId: "client",
        clientSecret: "secret",
        authorization: "https://accounts.google.com/o/oauth2/v2/auth",
        token: "https://oauth2.googleapis.com/token",
        userinfo: "https://openidconnect.googleapis.com/v1/userinfo",
      }),
    ],
    secret: "x".repeat(32),
    // next-auth가 쓰는 경로. @auth/core의 기본은 /auth라서 맞추지 않으면 요청을 읽지 못한다.
    basePath: "/api/auth",
    trustHost: true,
    skipCSRFCheck,
    cookies,
  };
  const response = await Auth(
    new Request(`https://modori.test/api/auth/signin/${provider}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ callbackUrl: RETURN_PATH }),
    }),
    config,
  );
  const cookie = (name: string) => response.headers.getSetCookie().find((header) => header.includes(name)) ?? "";
  return { response, callbackCookie: cookie("authjs.callback-url"), stateCookie: cookie("authjs.state") };
}

describe("돌아갈 주소 쿠키(callbackUrlCookies)", () => {
  it("운영이 아니면 기본값(Auth.js)을 그대로 쓴다", () => {
    expect(callbackUrlCookies(false)).toBeUndefined();
  });

  it("고치기 전: Apple 로그인의 돌아갈 주소 쿠키는 Lax라서, Apple이 POST로 돌아올 때 실리지 않는다", async () => {
    const { response, callbackCookie, stateCookie } = await startSignIn("apple", callbackUrlCookies(false));
    expect(response.status).toBe(302);
    expect(stateCookie).toMatch(/SameSite=none/i);
    expect(callbackCookie).toMatch(/SameSite=lax/i);
  });

  it("고친 뒤: 돌아갈 주소 쿠키도 SameSite=None·Secure이고 값은 앱으로 돌아가는 주소다", async () => {
    const { callbackCookie, stateCookie } = await startSignIn("apple", callbackUrlCookies(true));
    expect(callbackCookie).toMatch(/^__Secure-authjs\.callback-url=/);
    expect(callbackCookie).toMatch(/SameSite=none/i);
    expect(callbackCookie).toMatch(/Secure/i);
    expect(callbackCookie).toMatch(/HttpOnly/i);
    expect(decodeURIComponent(callbackCookie.split(";")[0].split("=").slice(1).join("="))).toBe(`https://modori.test${RETURN_PATH}`);
    // state 쿠키는 그대로 None이다(이미 되던 것).
    expect(stateCookie).toMatch(/SameSite=none/i);
  });

  it("Google은 GET으로 돌아오지만 같은 설정에서도 정상으로 시작된다(이름이 기본과 같아 이어진다)", async () => {
    const { response, callbackCookie } = await startSignIn("google", callbackUrlCookies(true));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("accounts.google.com");
    expect(callbackCookie).toMatch(/^__Secure-authjs\.callback-url=/);
  });
});
