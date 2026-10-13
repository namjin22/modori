import { signOut } from "@/lib/auth";

/**
 * 로그아웃. 화면 안의 서버 함수(서버 액션)가 아니라 일반 폼 POST로 받고 로그인 화면을 통째로 새로 연다.
 * 아이폰 앱에서 서버 액션으로 로그아웃한 뒤 화면을 옮기는 요청이 끊겨 "This page couldn't load"가 떴다(아이폰 사용자 피드백).
 * 오래 켜 둔 앱이 새 배포 뒤 옛 서버 함수를 부르는 일도 없어진다.
 */
export async function POST(request: Request) {
  // 다른 사이트가 이 주소로 폼을 보내 로그아웃시키지 못하게 한다.
  if (request.headers.get("sec-fetch-site") === "cross-site") return new Response(null, { status: 403 });
  await signOut({ redirect: false });
  // 주소는 상대 경로로 보낸다. 앱은 Cloudflare 뒤 127.0.0.1에서 돌아 request.url의 호스트가 바깥 주소와 다르다.
  return new Response(null, { status: 303, headers: { Location: "/login", "Cache-Control": "no-store" } });
}
