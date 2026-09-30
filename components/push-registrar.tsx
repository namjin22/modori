"use client";

import { useEffect } from "react";

import { capacitor } from "@/lib/native-login";
import { registerPushToken, safePushPath } from "@/lib/push-client";

/**
 * 모바일 앱 안에서만 하는 일: 알림 허용을 물어 허용하면 기기 알림 번호를 서버에 알린다. 알림을 누르면 그 화면으로 간다.
 * 일반 브라우저와 데스크톱 앱에서는 아무 일도 하지 않는다. 로그인한 사람의 탭 화면에만 붙는다.
 */
export function PushRegistrar() {
  useEffect(() => {
    const push = capacitor()?.Plugins?.PushNotifications;
    if (!push) return;
    const handles: Promise<unknown>[] = [];

    handles.push(
      push.addListener("registration", ((data: { value: string }) => {
        registerPushToken(data.value).catch((error: unknown) =>
          console.warn("[push] 알림 번호를 서버에 알리지 못했다.", error instanceof Error ? error.message : error),
        );
      }) as never),
      push.addListener("registrationError", ((error: unknown) => {
        console.warn("[push] 알림 등록 오류", error);
      }) as never),
      push.addListener("pushNotificationActionPerformed", ((action: { notification?: { data?: { url?: unknown } } }) => {
        const path = safePushPath(action.notification?.data?.url);
        if (path) window.location.href = path;
      }) as never),
    );

    (async () => {
      let status = await push.checkPermissions();
      // 처음이면 한 번 묻는다. 거절하면 다시 조르지 않는다.
      if (status.receive.startsWith("prompt")) status = await push.requestPermissions();
      if (status.receive === "granted") await push.register();
    })().catch((error: unknown) => console.warn("[push] 알림을 준비하지 못했다.", error));

    return () => {
      for (const handle of handles) void handle.then((h) => (h as { remove?: () => void } | undefined)?.remove?.());
    };
  }, []);

  return null;
}
