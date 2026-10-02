import { encode } from "next-auth/jwt";

import { isMockAuth } from "@/lib/auth";
import { redeemDesktopCode } from "@/lib/desktop-login";
import { prisma } from "@/lib/prisma";
import { generateSignedSessionToken } from "@/lib/signed-session-token";

// Auth.js 기본값(@auth/core lib/init.js)과 같다. 세션은 30일 동안 쓰지 않으면 끝난다.
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * 데스크톱 앱이 코드와 verifier를 들고 오면 로그인 세션을 만들어 쿠키로 심는다(lib/desktop-login.ts).
 *
 * 쿠키 이름·설정은 Auth.js 기본값을 그대로 따른다(@auth/core lib/utils/cookie.js의 defaultCookies):
 * HTTPS면 "__Secure-authjs.session-token", httpOnly·lax·path "/"·secure.
 * 평소에는 DB 세션이라 Session 행을 만들고, 테스트용 우회 모드는 JWT 세션이라 Auth.js의 encode로 만든다.
 */
export async function GET(request: Request) {
  // 다른 사이트의 링크·이미지가 남의 코드로 이 주소를 열어 피해자를 공격자 계정으로 로그인시키지 못하게 한다(로그인 CSRF).
  // 앱은 직접 연 주소(none)나 같은 사이트(same-origin)로 온다.
  if (request.headers.get("sec-fetch-site") === "cross-site") return new Response(null, { status: 403 });
  const url = new URL(request.url);
  const userId = await redeemDesktopCode(
    url.searchParams.get("code") ?? "",
    url.searchParams.get("verifier") ?? "",
  );
  // 주소는 상대 경로로 보낸다. 앱은 Cloudflare 뒤 127.0.0.1에서 돌아 request.url의 호스트가 바깥 주소와 다르다.
  if (!userId) return redirect("/login?error=DesktopLogin");

  // Auth.js는 공개 주소(AUTH_URL)가 https면 보안 쿠키를 쓴다.
  const secure = (process.env.AUTH_URL ?? url.origin).startsWith("https://");
  const name = `${secure ? "__Secure-" : ""}authjs.session-token`;
  const expires = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  let value: string;
  if (isMockAuth) {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error("AUTH_SECRET이 없어 데스크톱 로그인 세션을 만들 수 없다.");
    value = await encode({ token: { sub: userId }, secret, salt: name, maxAge: SESSION_MAX_AGE });
  } else {
    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
    if (!secret) throw new Error("AUTH_SECRET이 없어 데스크톱 로그인 세션을 만들 수 없다.");
    value = generateSignedSessionToken(secret);
    await prisma.session.create({ data: { sessionToken: value, userId, expires } });
  }

  const response = redirect("/");
  response.headers.append(
    "Set-Cookie",
    `${name}=${value}; Path=/; Expires=${expires.toUTCString()}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
  );
  return response;
}

function redirect(location: string) {
  return new Response(null, { status: 303, headers: { Location: location, "Cache-Control": "no-store" } });
}
