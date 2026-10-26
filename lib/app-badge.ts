/**
 * 앱 아이콘에 안 읽은 알림 수를 띄운다(2026-10-26 요청: 작업표시줄·Dock 아이콘). 브라우저 안에서만 부른다.
 * - 데스크톱 앱(Windows): 작업표시줄 아이콘 위에 숫자 표시를 겹쳐 그린다. 숫자 그림은 여기서 그려 앱에 넘기고(desktop/preload.js),
 *   앱이 받은 것을 확인해 쓴다(desktop/main.js). 앱 쪽에는 그림을 그릴 곳이 없다.
 * - 그 밖에 설치한 웹 앱(맥 Safari의 Dock 추가, Chrome·Edge 설치): 브라우저의 아이콘 숫자 기능(Badging API).
 * - 그냥 브라우저 탭에서는 아무것도 하지 않는다(탭 제목 아래에 아이콘이 없다).
 */
export const BADGE_MAX = 99;

/** 아이콘에 적을 글. 0이면 비운다. 99를 넘으면 "99+". */
export function badgeLabel(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "";
  return count > BADGE_MAX ? `${BADGE_MAX}+` : String(Math.floor(count));
}

/** 아이콘 위 숫자 표시로 쓸 그림(PNG data URL). 빨간 동그라미에 흰 숫자. 작업표시줄 위에서는 16px 안쪽이라 굵게 크게 쓴다. */
export function badgeImage(count: number): string | null {
  const label = badgeLabel(count);
  if (!label) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#dc2626";
  context.beginPath();
  context.arc(32, 32, 31, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  // 글자가 길수록 줄여서 원 안에 들어오게 한다("99+"는 세 글자).
  const size = label.length === 1 ? 44 : label.length === 2 ? 36 : 28;
  context.font = `700 ${size}px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
  context.fillText(label, 32, 35);
  return canvas.toDataURL("image/png");
}

/** 설치한 앱(독립 창)에서 도는지. 탭에서 도는 웹은 숫자를 띄울 아이콘이 없다. */
export function isInstalledApp(): boolean {
  if (typeof window === "undefined") return false;
  if (window.modoriDesktop) return true;
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: window-controls-overlay)").matches;
}

/** 지금 안 읽은 알림 수를 앱 아이콘에 띄운다(0이면 지운다). 실패해도 화면은 그대로 두고 기록만 남긴다. */
export function setAppIconBadge(count: number): void {
  try {
    if (window.modoriDesktop?.setBadge) {
      window.modoriDesktop.setBadge(Math.max(0, Math.min(count, 999)), badgeImage(count));
      return;
    }
    if (!isInstalledApp() || !("setAppBadge" in navigator)) return;
    const result = count > 0 ? navigator.setAppBadge(Math.min(count, 999)) : navigator.clearAppBadge();
    void result.catch((error: unknown) => console.warn("[badge] 아이콘 숫자를 바꾸지 못했다.", error instanceof Error ? error.name : error));
  } catch (error) {
    console.warn("[badge] 아이콘 숫자를 바꾸지 못했다.", error instanceof Error ? error.name : error);
  }
}
