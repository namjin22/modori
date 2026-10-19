"use client";

import { useState, useSyncExternalStore } from "react";

import { LabeledSwitch } from "@/components/labeled-switch";
import {
  desktopNotifyState,
  saveDesktopNotify,
  serverDesktopNotifyState,
  subscribeDesktopNotify,
} from "@/lib/desktop-notify";
import { subscribeWebPush, unsubscribeWebPush } from "@/lib/web-push-client";

/**
 * 이 기기에서 컴퓨터 알림 켜기·끄기. 알림 화면 위에 있다. 브라우저가 알림을 띄울 수 없는 곳(폰 브라우저, 모바일 앱 웹뷰)에서는 숨긴다.
 * 켤 때 브라우저의 허락 창을 띄운다. 거절했으면 다시 띄울 수 없어서(브라우저가 막는다) 설정에서 바꾸라고 안내한다.
 * 웹 푸시를 쓸 수 있으면 웹 푸시로(창을 닫아도 온다), 못 쓰면 창이 열려 있을 때의 알림으로 켠다.
 */
export function DesktopNotifySwitch({ userId }: { userId: string }) {
  const state = useSyncExternalStore(subscribeDesktopNotify, () => desktopNotifyState(userId), serverDesktopNotifyState);
  // 웹 푸시 구독은 서비스 워커를 올리느라 1~2초 걸린다. 그동안 스위치가 그대로면 안 눌린 줄 안다. 누른 쪽으로 먼저 옮겨 둔다.
  const [pending, setPending] = useState<boolean | null>(null);
  if (state === "unsupported") return null;
  if (state === "outdated") {
    return (
      <p className="border-t border-border pt-3 text-xs text-muted">
        이 컴퓨터에서 알림을 받으려면 마이페이지의 &quot;Windows 앱 받기&quot;로 데스크톱 앱을 새로 설치해 주세요.
      </p>
    );
  }

  async function change(next: boolean) {
    setPending(next);
    try {
      await apply(next);
    } finally {
      setPending(null);
    }
  }

  async function apply(next: boolean) {
    if (!next) {
      saveDesktopNotify(userId, null);
      try {
        await unsubscribeWebPush();
      } catch (error) {
        console.warn("[notify] 웹 푸시 구독을 끊지 못했다.", error instanceof Error ? error.message : error);
      }
      return;
    }
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    // 거절해도 저장 이벤트로 다시 그려 안내 문구가 뜬다.
    if (permission !== "granted") return saveDesktopNotify(userId, null);
    let pushed = false;
    try {
      pushed = await subscribeWebPush();
    } catch (error) {
      console.warn("[notify] 웹 푸시를 켜지 못해 창이 열려 있을 때만 띄운다.", error instanceof Error ? error.message : error);
    }
    saveDesktopNotify(userId, pushed ? "push" : "poll");
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <LabeledSwitch
        name="desktopNotify"
        title="이 기기에서 알림 띄우기"
        description={
          state === "push"
            ? "모도리 창을 닫아도 새 알림을 컴퓨터 알림으로 보여 줘요."
            : "모도리 창을 열어 두면 새 알림을 컴퓨터 알림으로 보여 줘요. 1분마다 확인해요."
        }
        checked={pending ?? (state === "on" || state === "push")}
        onChange={(next) => void change(next)}
      />
      {state === "denied" && pending === null && (
        <p role="status" className="text-xs text-danger">
          브라우저가 알림을 막고 있어요. 주소창 왼쪽의 사이트 설정에서 알림을 허용한 뒤 다시 켜 주세요.
        </p>
      )}
    </div>
  );
}
