import { saveDesktopNotify } from "@/lib/desktop-notify";
import { subscribeWebPush, unsubscribeWebPush } from "@/lib/web-push-client";

/**
 * 이 기기(컴퓨터 브라우저·데스크톱 앱)에서 알림을 띄우게 켜고 끈다. "친구가 할 일을 끝내면 알림" 스위치가 부른다
 * (2026-11-17 요청: 알림 스위치를 하나로 합쳤다. 예전에는 "이 기기에서 알림 띄우기"가 따로 있었다). 브라우저 안에서만 부른다.
 *
 * 켤 때 브라우저의 허락 창을 띄운다. 거절하면 켜지지 않고(브라우저가 다시 묻지 못하게 막는다), 부른 쪽이 상태를 보고 안내한다.
 * 웹 푸시를 쓸 수 있으면 웹 푸시로(창을 닫아도 온다), 못 쓰면 창이 열려 있을 때의 알림으로 켠다.
 */
export async function enableDeviceNotify(userId: string): Promise<void> {
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  // 거절해도 저장 이벤트로 화면을 다시 그려 안내 문구가 뜬다.
  if (permission !== "granted") return saveDesktopNotify(userId, null);
  let pushed = false;
  try {
    pushed = await subscribeWebPush();
  } catch (error) {
    console.warn("[notify] 웹 푸시를 켜지 못해 창이 열려 있을 때만 띄운다.", error instanceof Error ? error.message : error);
  }
  saveDesktopNotify(userId, pushed ? "push" : "poll");
}

export async function disableDeviceNotify(userId: string): Promise<void> {
  saveDesktopNotify(userId, null);
  try {
    await unsubscribeWebPush();
  } catch (error) {
    console.warn("[notify] 웹 푸시 구독을 끊지 못했다.", error instanceof Error ? error.message : error);
  }
}
