import { NextResponse, type NextRequest } from "next/server";

/**
 * 서버 컴포넌트는 지금 주소를 모른다. 로그인이 필요해 로그인 화면으로 보낼 때 "원래 가려던 곳"을
 * 붙이려고, 요청 주소를 헤더에 담아 넘긴다(lib/session.ts가 읽는다).
 * 브라우저가 같은 이름의 헤더를 보내도 여기서 덮어쓴다.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-modori-path", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // 화면 요청에만 돈다. API·정적 파일·이미지까지 돌 이유가 없다.
  matcher: ["/((?!api|_next/static|_next/image|icons|favicon.ico|icon.svg|og.png|manifest.webmanifest|robots.txt).*)"],
};
