"use client";

import { useEffect } from "react";

import { appSource, capacitor } from "@/lib/native-login";
import { registerPushToken, safePushPath } from "@/lib/push-client";

/**
 * 모바일 앱 안에서만 하는 일: 알림 허용을 물어 허용하면 기기 알림 번호를 서버에 알린다. 알림을 누르면 그 화면으로 간다.
 * 일반 브라우저와 데스크톱 앱에서는 아무 일도 하지 않는다. 로그인한 사람의 탭 화면에만 붙는다.
 */
export function PushRegistrar() {
  useEffect(() => {
    const bridge = capacitor();
    const push = bridge?.Plugins?.PushNotifications;
    if (!bridge || !push) return;
    // iOS 플러그인은 FCM이 아니라 Apple(APNs) 기기 번호를 준다. 서버가 platform으로 갈라 APNs로 보낸다(lib/apns.ts).
    const platform = appSource(bridge) === "app-ios" ? "ios" : "android";
    const handles: Promise<unknown>[] = [];

    handles.push(
      push.addListener("registration", ((data: { value: string }) => {
        registerPushToken(data.value, platform).catch((error: unknown) =>
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
      if (status.receive === "prompt") status = await push.requestPermissions();
      if (status.receive === "granted") await push.register();
    })().catch((error: unknown) => console.warn("[push] 알림을 준비하지 못했다.", error));

    return () => {
      for (const handle of handles) void handle.then((h) => (h as { remove?: () => void } | undefined)?.remove?.());
    };
  }, []);

  return null;
}
