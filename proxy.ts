import { NextResponse, type NextRequest } from "next/server";

import { take, type RateRule } from "@/lib/rate-limit";

// 로그인한 사람은 세션마다 센다. 화면 하나에 요청이 6개쯤 가므로 사람 손으로는 닿지 않는다.
const SESSION_RULE: RateRule = { capacity: 60, refillPerSecond: 6 };
// 로그인 전 요청은 IP마다 센다. 학교 와이파이는 학생 전원이 공인 IP 하나로 나가서 넉넉히 잡는다.
const ANONYMOUS_RULE: RateRule = { capacity: 300, refillPerSecond: 30 };

// 브라우저 오류 보고는 따로 더 좁게 센다. 화면이 오류를 되풀이하거나 누가 일부러 보내도
// 오류 기록 표가 몇 줄 이상 늘지 않는다. 10개를 넘으면 1분에 하나씩만 받는다.
const ERROR_REPORT_RULE: RateRule = { capacity: 10, refillPerSecond: 1 / 60 };

// 프로필 사진은 목록 화면 하나에 수십 장이 한꺼번에 온다(팔로워·팔로우 목록은 전부 보여준다).
// 화면 요청과 같은 버킷에 넣으면 사진이 많은 목록을 처음 열 때 일부가 429로 깨진다. 따로 넉넉히 센다.
const AVATAR_RULE: RateRule = { capacity: 300, refillPerSecond: 30 };

const SESSION_COOKIES = ["__Secure-authjs.session-token", "authjs.session-token"];

/** 누구의 요청인지. 세션이 있으면 세션, 없으면 접속 IP. */
function clientKey(request: NextRequest): { key: string; rule: RateRule } {
  for (const name of SESSION_COOKIES) {
    const value = request.cookies.get(name)?.value;
    if (value) return { key: `s:${value}`, rule: SESSION_RULE };
  }
  // 앱은 VM 안(127.0.0.1)에서만 열려 있고 Cloudflare Tunnel로만 들어온다.
  // cf-connecting-ip는 Cloudflare가 덮어써서 사용자가 꾸밀 수 없다.
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local";
  return { key: `ip:${ip}`, rule: ANONYMOUS_RULE };
}

/** 어느 버킷에서 뺄지. 오류 보고와 프로필 사진은 화면 요청과 따로 센다. */
function bucketFor(request: NextRequest): { bucket: string; rule: RateRule } {
  const { key, rule } = clientKey(request);
  const { pathname } = request.nextUrl;
  if (pathname === "/api/errors" && request.method === "POST") {
    return { bucket: `errors:${key}`, rule: ERROR_REPORT_RULE };
  }
  if (pathname.startsWith("/api/avatar/")) return { bucket: `avatar:${key}`, rule: AVATAR_RULE };
  return { bucket: key, rule };
}

/**
 * 1) 요청 속도 제한: 한 사람이 서버를 붙잡지 못하게 한다.
 * 2) 서버 컴포넌트는 지금 주소를 모른다. 로그인이 필요해 로그인 화면으로 보낼 때 "원래 가려던 곳"을
 *    붙이려고, 요청 주소를 헤더에 담아 넘긴다(lib/session.ts가 읽는다). 같은 이름의 헤더가 와도 덮어쓴다.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // 상태 확인은 밖의 감시가 15분마다 부른다. 막으면 멀쩡한 서버를 죽었다고 알린다.
  if (pathname !== "/api/health") {
    const { bucket, rule } = bucketFor(request);
    const result = take(bucket, rule);
    if (!result.ok) {
      return new NextResponse("요청이 너무 많아요. 잠시 뒤에 다시 해주세요.", {
        status: 429,
        headers: {
          "Retry-After": String(result.retryAfter),
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }
  }

  const headers = new Headers(request.headers);
  headers.set("x-modori-path", pathname + search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // 정적 파일·이미지 최적화는 세지 않는다. 화면과 API 요청만 센다.
  matcher: ["/((?!_next/static|_next/image|icons|favicon.ico|icon.svg|og.png|manifest.webmanifest|robots.txt).*)"],
};
