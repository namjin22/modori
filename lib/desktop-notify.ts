/**
 * 웹·데스크톱 창에서 띄우는 컴퓨터 알림(2026-10-19 요청). 켜고 끄는 것은 기기마다 다르다(회사 PC에서는 끄고 집 PC에서는 켜듯).
 * 그래서 서버가 아니라 이 브라우저의 localStorage에 적는다. 브라우저 안에서만 부른다.
 * 켠 계정의 id를 같이 적는다. 학교 PC처럼 여럿이 쓰는 브라우저에서 다음 사람이 로그인해도(로그아웃이든 계정 지우기든)
 * 앞사람이 켠 알림을 물려받지 않는다.
 *
 * 켜는 방법은 둘이다. `push:<id>`는 웹 푸시(창을 닫아도 온다, lib/web-push-client.ts), `on:<id>`는 창이 열려 있는 동안
 * 1분마다 물어 띄우는 것(웹 푸시를 못 쓰는 데스크톱 앱이나 서버에 열쇠가 없을 때). 둘이 겹치면 같은 알림이 두 번 뜬다.
 */
export const DESKTOP_NOTIFY_KEY = "modori-desktop-notify";
/** 같은 창의 다른 컴포넌트(하단 탭)에 켜고 끈 것을 알린다. storage 이벤트는 다른 창에만 간다. */
export const DESKTOP_NOTIFY_EVENT = "modori:desktop-notify";
/** 이 버전부터 Windows 알림 센터에 앱 이름(AppUserModelId)을 알린다. 그 전 설치본은 알림이 조용히 사라진다. */
const DESKTOP_NOTIFY_SINCE = [1, 0, 4];

export type DesktopNotifyMode = "push" | "poll";
// "on"은 창이 열려 있을 때 띄우는 것, "push"는 웹 푸시.
export type DesktopNotifyState = "unsupported" | "outdated" | "push" | "on" | "off" | "denied";

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

/** 이 계정이 켜 두었고 브라우저도 허락했으면 켠 방법, 아니면 null. */
export function desktopNotifyMode(userId: string): DesktopNotifyMode | null {
  if (!canNotifyHere() || outdatedDesktopApp(navigator.userAgent) || Notification.permission !== "granted") return null;
  let stored: string | null;
  try {
    stored = localStorage.getItem(DESKTOP_NOTIFY_KEY);
  } catch (error) {
    console.warn("[notify] 설정을 읽지 못했다.", error instanceof Error ? error.name : error);
    return null;
  }
  if (stored === `push:${userId}`) return "push";
  if (stored === `on:${userId}`) return "poll";
  return null;
}

export function saveDesktopNotify(userId: string, mode: DesktopNotifyMode | null): void {
  try {
    if (mode) localStorage.setItem(DESKTOP_NOTIFY_KEY, `${mode === "push" ? "push" : "on"}:${userId}`);
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
  const mode = desktopNotifyMode(userId);
  if (mode) return mode === "push" ? "push" : "on";
  return Notification.permission === "denied" ? "denied" : "off";
}

/**
 * 작업표시줄·Dock 아이콘에 안 읽은 알림 수를 띄울지(lib/app-badge.ts). 이 기기에서 알림을 껐거나 브라우저가 막았으면 숫자도 지운다
 * (2026-10-28 제보: 알림을 껐는데 아이콘 숫자가 그대로였다). 끄는 스위치가 없는 기기(unsupported)와 옛 앱(outdated)은 예전대로 둔다.
 */
export function showsIconBadge(state: DesktopNotifyState): boolean {
  return state !== "off" && state !== "denied";
}

// 서버에는 window가 없다. 처음엔 숨겼다가 브라우저에서 실제 값으로 맞춘다.
export function serverDesktopNotifyState(): DesktopNotifyState {
  return "unsupported";
}
