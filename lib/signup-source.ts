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
    const target = new URL(next, "https://modori.site");
    const nested = parseSource(target.searchParams.get("from"));
    if (nested) return nested;
    // 데스크톱 앱은 평소 브라우저로 /desktop/login?challenge=…를 연다(provider 없이). 로그인 전이라 /login?next=…로 보내지므로
    // 거기서 알아본다. 모바일 앱은 provider와 from을 직접 달고 온다.
    if (target.pathname === "/desktop/login" && target.searchParams.has("challenge") && !target.searchParams.has("provider")) {
      return "app-desktop";
    }
    return null;
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

/**
 * 페이지 맨 앞(`<head>`)에서 바로 도는 스크립트. 화면이 준비(하이드레이션)되기를 기다리면, 느린 폰에서 사람이 그 전에 로그인 버튼을 눌러
 * 페이지를 떠나 경로가 저장되지 않는다. 위의 `sourceFromSearch`·`sourceFromUserAgent`와 같은 규칙이고, 둘이 어긋나지 않게
 * tests/unit/signup-source.test.ts가 같은 입력으로 비교한다.
 */
export const SOURCE_SCRIPT = `
(function () {
  try {
    var KEY = ${JSON.stringify(SOURCE_KEY)};
    if (localStorage.getItem(KEY)) return;
    var PATTERN = /^[a-z0-9-]{1,20}$/;
    var ok = function (v) {
      v = String(v || "").trim().toLowerCase();
      return PATTERN.test(v) ? v : null;
    };
    var query = new URLSearchParams(location.search);
    var found = ok(query.get("from"));
    var next = query.get("next");
    if (!found && next && next.charAt(0) === "/") {
      var target = new URL(next, location.origin);
      found = ok(target.searchParams.get("from"));
      if (!found && target.pathname === "/desktop/login" && target.searchParams.has("challenge") && !target.searchParams.has("provider")) {
        found = "app-desktop";
      }
    }
    if (!found) {
      var ua = navigator.userAgent;
      if (ua.indexOf("ModoriMobile") > -1) found = "app-android";
      else if (ua.indexOf("ModoriDesktop") > -1) found = "app-desktop";
    }
    if (found) localStorage.setItem(KEY, found);
  } catch (e) {
    // 저장소가 막힌 브라우저에서는 경로를 모르는 채로 가입한다. 화면에는 영향이 없다.
  }
})();
`;

