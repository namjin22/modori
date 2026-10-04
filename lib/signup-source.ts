/**
 * 가입 경로. 초대 링크에 `?from=discord`처럼 붙은 표시를 브라우저(localStorage)에 두었다가 가입할 때 한 번 적는다.
 * 쿠키를 쓰지 않고, 사람을 알아볼 수 있는 값이 아니라 정해진 모양의 경로 이름만 받는다(합계로만 본다, docs/metrics.md).
 */
export const SOURCE_KEY = "modori-from";

/** 경로를 모르는 가입(주소를 직접 쳐서 들어온 경우 등). 하루 합계에서 이 이름으로 센다. */
export const DIRECT_SOURCE = "direct";

// 소문자·숫자·하이픈 20자까지. 임의의 글을 받아 저장하지 않는다.
const SOURCE_PATTERN = /^[a-z0-9-]{1,20}$/;

/** 값이 경로 이름으로 쓸 수 있는 모양이면 그대로, 아니면 null. */
export function parseSource(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return SOURCE_PATTERN.test(trimmed) ? trimmed : null;
}

/**
 * 주소의 쿼리(`location.search`)에서 경로 이름을 찾는다. 공지 링크(`/?from=discord`)를 로그인 전에 열면 서버가
 * `/login?next=%2F%3Ffrom%3Ddiscord`로 보내므로 `from`이 맨 앞에 없다. 그때는 `next` 안의 쿼리에서 찾는다.
 */
export function sourceFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const direct = parseSource(params.get("from"));
  if (direct) return direct;
  const next = params.get("next");
  if (!next || !next.startsWith("/")) return null;
  try {
    return parseSource(new URL(next, "https://modori.site").searchParams.get("from"));
  } catch (error) {
    console.warn("[source] next 주소를 읽지 못했다.", error instanceof Error ? error.name : error);
    return null;
  }
}

/** 모바일 앱·데스크톱 앱 안에서 연 화면인지(user agent 꼬리표, mobile/capacitor.config.json·desktop/main.js). */
export function sourceFromUserAgent(userAgent: string): string | null {
  if (userAgent.includes("ModoriMobile")) return "app-android";
  if (userAgent.includes("ModoriDesktop")) return "app-desktop";
  return null;
}
