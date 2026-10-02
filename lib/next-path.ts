/**
 * 로그인 뒤에 돌아갈 주소(?next=)를 믿을 수 있는 모양으로 거른다.
 *
 * 주소창에서 누구나 고칠 수 있는 값이라, 그대로 쓰면 `?next=https://나쁜곳`으로 로그인 뒤
 * 다른 사이트로 보내는 데 쓰인다(open redirect). 우리 사이트 안의 경로만 받는다.
 * `//나쁜곳`과 `/\나쁜곳`은 브라우저가 다른 사이트로 읽으므로 막는다.
 * 탭·줄바꿈 같은 제어문자도 막는다. 브라우저는 주소에서 이것들을 지워 읽어서 `/(탭)/나쁜곳`이 `//나쁜곳`이 된다.
 */
export function safeNext(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 512) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /\p{Cc}/u.test(value)) return null;
  // 로그인·닉네임 화면으로 돌아가면 다시 튕겨 나오기만 한다.
  if (value.startsWith("/login") || value.startsWith("/onboarding")) return null;
  return value === "/" ? null : value;
}

/** 로그인 화면 주소. 돌아갈 곳이 있으면 붙인다. */
export function loginHref(next: string | null): string {
  return next ? `/login?next=${encodeURIComponent(next)}` : "/login";
}
