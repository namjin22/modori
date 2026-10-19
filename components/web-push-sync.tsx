"use client";

import { useEffect } from "react";

import { desktopNotifyMode, saveDesktopNotify } from "@/lib/desktop-notify";
import { subscribeWebPush, unsubscribeWebPush, webPushSupported } from "@/lib/web-push-client";

/**
 * 화면을 처음 열 때 한 번, 이 브라우저의 웹 푸시 구독을 이 계정의 설정에 맞춘다(그리는 것은 없다).
 * - 이 계정이 웹 푸시로 켰으면: 구독을 서버에 다시 맡긴다. 브라우저가 구독을 바꿨거나 서버에서 지워졌어도 이어진다.
 *   다시 맡기지 못하면 창이 열려 있을 때의 알림으로 내린다.
 * - 아니면: 남은 구독을 끊는다. 학교 PC에서 앞사람이 로그아웃하지 않고 떠나도, 다음 사람이 로그인하면 앞사람 알림이 멈춘다.
 */
export function WebPushSync({ userId }: { userId: string }) {
  useEffect(() => {
    if (!webPushSupported()) return;
    if (desktopNotifyMode(userId) === "push") {
      subscribeWebPush()
        .then((pushed) => {
          if (!pushed) saveDesktopNotify(userId, "poll");
        })
        .catch((error: unknown) => {
          console.warn("[web-push] 구독을 다시 맡기지 못했다.", error instanceof Error ? error.message : error);
          saveDesktopNotify(userId, "poll");
        });
      return;
    }
    unsubscribeWebPush().catch((error: unknown) => {
      console.warn("[web-push] 남은 구독을 끊지 못했다.", error instanceof Error ? error.message : error);
    });
  }, [userId]);
  return null;
}
