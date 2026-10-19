/**
 * 웹·데스크톱 창에서 띄우는 컴퓨터 알림(2026-10-19 요청). 켜고 끄는 것은 기기마다 다르다(회사 PC에서는 끄고 집 PC에서는 켜듯).
 * 그래서 서버가 아니라 이 브라우저의 localStorage에 적는다. 브라우저 안에서만 부른다.
 * 켠 계정의 id를 같이 적는다. 학교 PC처럼 여럿이 쓰는 브라우저에서 다음 사람이 로그인해도(로그아웃이든 계정 지우기든)
 * 앞사람이 켠 알림을 물려받지 않는다.
 */
export const DESKTOP_NOTIFY_KEY = "modori-desktop-notify";
/** 같은 창의 다른 컴포넌트(하단 탭)에 켜고 끈 것을 알린다. storage 이벤트는 다른 창에만 간다. */
export const DESKTOP_NOTIFY_EVENT = "modori:desktop-notify";
/** 이 버전부터 Windows 알림 센터에 앱 이름(AppUserModelId)을 알린다. 그 전 설치본은 알림이 조용히 사라진다. */
const DESKTOP_NOTIFY_SINCE = [1, 0, 4];

export type DesktopNotifyState = "unsupported" | "outdated" | "on" | "off" | "denied";

/** 데스크톱 앱(desktop/main.js가 붙이는 `ModoriDesktop/x.y.z`)인데 알림이 안 되는 옛 버전인지. */
function outdatedDesktopApp(ua: string): boolean {
  const match = /ModoriDesktop\/(\d+)\.(\d+)\.(\d+)/.exec(ua);
  if (!match) return false;
  const version = match.slice(1).map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (version[i] !== DESKTOP_NOTIFY_SINCE[i]) return version[i] < DESKTOP_NOTIFY_SINCE[i];
  }
  return false;
}

/**
 * 이 브라우저가 창에서 바로 알림을 띄울 수 있는지. 컴퓨터 브라우저와 데스크톱 앱만 된다.
 * 폰 브라우저는 Notification이 있어도 `new Notification()`을 막는다(안드로이드 Chrome은 TypeError, iOS는 서비스 워커 푸시만).
 * 모바일 앱(웹뷰)은 앱 푸시를 쓴다. 아이패드는 컴퓨터처럼 "Macintosh"라고 밝혀서 터치 수로 가린다.
 */
export function canNotifyHere(): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  const ua = navigator.userAgent;
  const iPad = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return !iPad && !/Android|iPhone|iPad|iPod|Mobile|ModoriMobile/i.test(ua);
}

/** 이 계정이 켜 두었고, 브라우저도 허락했는지. */
export function desktopNotifyOn(userId: string): boolean {
  if (!canNotifyHere() || outdatedDesktopApp(navigator.userAgent) || Notification.permission !== "granted") return false;
  try {
    return localStorage.getItem(DESKTOP_NOTIFY_KEY) === `on:${userId}`;
  } catch (error) {
    console.warn("[notify] 설정을 읽지 못했다.", error instanceof Error ? error.name : error);
    return false;
  }
}

export function saveDesktopNotify(userId: string, on: boolean): void {
  try {
    if (on) localStorage.setItem(DESKTOP_NOTIFY_KEY, `on:${userId}`);
    else localStorage.removeItem(DESKTOP_NOTIFY_KEY);
  } catch (error) {
    console.warn("[notify] 설정을 저장하지 못했다.", error instanceof Error ? error.name : error);
  }
  window.dispatchEvent(new Event(DESKTOP_NOTIFY_EVENT));
}

/** useSyncExternalStore용. 같은 창(DESKTOP_NOTIFY_EVENT)과 다른 창(storage)에서 바꾼 것을 따라간다. */
export function subscribeDesktopNotify(onChange: () => void): () => void {
  window.addEventListener(DESKTOP_NOTIFY_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(DESKTOP_NOTIFY_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function desktopNotifyState(userId: string): DesktopNotifyState {
  if (!canNotifyHere()) return "unsupported";
  if (outdatedDesktopApp(navigator.userAgent)) return "outdated";
  if (desktopNotifyOn(userId)) return "on";
  return Notification.permission === "denied" ? "denied" : "off";
}

// 서버에는 window가 없다. 처음엔 숨겼다가 브라우저에서 실제 값으로 맞춘다.
export function serverDesktopNotifyState(): DesktopNotifyState {
  return "unsupported";
}
