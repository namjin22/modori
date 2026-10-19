"use client";

import { useSyncExternalStore } from "react";

import { LabeledSwitch } from "@/components/labeled-switch";
import {
  desktopNotifyState,
  saveDesktopNotify,
  serverDesktopNotifyState,
  subscribeDesktopNotify,
} from "@/lib/desktop-notify";

/**
 * 이 기기에서 컴퓨터 알림 켜기·끄기. 알림 화면 위에 있다. 브라우저가 알림을 띄울 수 없는 곳(폰 브라우저, 모바일 앱 웹뷰)에서는 숨긴다.
 * 켤 때 브라우저의 허락 창을 띄운다. 거절했으면 다시 띄울 수 없어서(브라우저가 막는다) 설정에서 바꾸라고 안내한다.
 */
export function DesktopNotifySwitch({ userId }: { userId: string }) {
  const state = useSyncExternalStore(subscribeDesktopNotify, () => desktopNotifyState(userId), serverDesktopNotifyState);
  if (state === "unsupported") return null;
  if (state === "outdated") {
    return (
      <p className="border-t border-border pt-3 text-xs text-muted">
        이 컴퓨터에서 알림을 받으려면 마이페이지의 &quot;Windows 앱 받기&quot;로 데스크톱 앱을 새로 설치해 주세요.
      </p>
    );
  }

  async function change(next: boolean) {
    if (!next) return saveDesktopNotify(userId, false);
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    // 거절해도 저장 이벤트로 다시 그려 안내 문구가 뜬다.
    saveDesktopNotify(userId, permission === "granted");
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <LabeledSwitch
        name="desktopNotify"
        title="이 기기에서 알림 띄우기"
        description="모도리 창을 열어 두면 새 알림을 컴퓨터 알림으로 보여 줘요. 1분마다 확인해요."
        checked={state === "on"}
        onChange={(next) => void change(next)}
      />
      {state === "denied" && (
        <p role="status" className="text-xs text-danger">
          브라우저가 알림을 막고 있어요. 주소창 왼쪽의 사이트 설정에서 알림을 허용한 뒤 다시 켜 주세요.
        </p>
      )}
    </div>
  );
}
