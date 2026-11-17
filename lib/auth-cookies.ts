import type { NextAuthConfig } from "next-auth";

/**
 * 로그인 뒤 돌아갈 주소를 담는 쿠키(authjs.callback-url)를 Apple 로그인에서도 살린다(2026-11-16, iOS 앱 Apple 로그인 신고).
 *
 * Apple은 로그인 결과를 GET이 아니라 **POST(response_mode=form_post)**로 모도리에 돌려보낸다. 다른 사이트에서 오는 POST에는
 * SameSite=Lax 쿠키가 실리지 않는다. Auth.js는 이 때문에 state·nonce 쿠키만 SameSite=None으로 바꾸고 돌아갈 주소 쿠키는 Lax로 둔다.
 * 그래서 Apple로 로그인하면 앱 넘겨주기 화면(/desktop/login?challenge=…&from=app-ios)으로 돌아가지 못하고 사이트 첫 화면(/)으로 떨어졌다.
 * 앱에서 누른 로그인이 웹에 남아 새 가입자는 브라우저에서 닉네임 가입 화면을 보았다. 친구가 보낸 링크로 들어와(?next=…) Apple로 로그인한
 * 웹 사용자도 원래 링크를 잃었다. Google·DataGSM은 GET으로 돌아와서 이 문제가 없다.
 *
 * SameSite=None은 Secure가 있어야 한다. 운영(https)에서만 켠다. 시험 서버(우회 로그인, http)와 개발 서버는 기본값(Lax)을 그대로 쓴다.
 */
export function callbackUrlCookies(secureDeployment: boolean): NextAuthConfig["cookies"] {
  if (!secureDeployment) return undefined;
  return {
    callbackUrl: {
      // Auth.js가 https에서 쓰는 기본 이름과 같다. 이름이 같아야 이미 발급된 쿠키와 이어진다.
      name: "__Secure-authjs.callback-url",
      options: { httpOnly: true, sameSite: "none", path: "/", secure: true },
    },
  };
}
