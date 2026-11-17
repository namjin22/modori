"use client";

import { useOptimistic, useState, useSyncExternalStore, useTransition } from "react";

import { setNotifyFriendDone } from "@/app/(tabs)/settings/actions";
import { LabeledSwitch } from "@/components/labeled-switch";
import { useT } from "@/components/locale-provider";
import { useSaveFailure } from "@/components/use-save-failure";
import { desktopNotifyState, serverDesktopNotifyState, subscribeDesktopNotify } from "@/lib/desktop-notify";
import { disableDeviceNotify, enableDeviceNotify } from "@/lib/desktop-notify-device";
import { settings } from "@/lib/i18n/messages/settings";

/**
 * 알림 켜기·끄기. 알림 화면 위(모든 화면)와 설정의 "알림"에 있다. 누르면 바로 바뀌고 서버에는 뒤따라 저장한다.
 *
 * 컴퓨터(브라우저·데스크톱 앱)에서는 이 스위치 하나가 이 컴퓨터의 알림도 같이 켜고 끈다(2026-11-17 요청: 예전의 "이 기기에서 알림 띄우기"를 합쳤다).
 * 켜면 브라우저의 허락 창이 뜨고 알림이 컴퓨터 알림으로도 온다. 끄면 컴퓨터 알림도 끈다.
 * 서버에 켜져 있어도 이 컴퓨터의 알림이 꺼져 있으면 꺼진 것으로 보여, 한 번 누르면 켜진다(폰·앱은 서버 값 그대로).
 */
export function FriendDoneSwitch({ on, userId }: { on: boolean; userId: string }) {
  const t = useT(settings);
  const state = useSyncExternalStore(subscribeDesktopNotify, () => desktopNotifyState(userId), serverDesktopNotifyState);
  const [flag, setFlag] = useOptimistic(on);
  // 컴퓨터 알림을 켜는 데는 서비스 워커를 올리느라 1~2초 걸린다. 그동안 스위치가 그대로면 안 눌린 줄 안다. 누른 쪽으로 먼저 옮겨 둔다.
  const [pending, setPending] = useState<boolean | null>(null);
  const [, startTransition] = useTransition();
  const saveFailed = useSaveFailure();

  const shown = pending ?? (flag && state !== "off");
  const computer = state === "off" || state === "on" || state === "push";
  const description =
    shown && state === "push" ? t("desktopNotifyPush") : shown && state === "on" ? t("desktopNotifyOpen") : computer ? t("friendDoneHintDevice") : t("friendDoneHint");

  function change(next: boolean) {
    setPending(next);
    startTransition(async () => {
      setFlag(next);
      try {
        // 브라우저의 허락 창은 누른 직후에 띄워야 해서 서버 저장보다 먼저 한다. 거절해도 서버의 알림 설정은 켠다(목록·앱 푸시).
        if (next && state === "off") await enableDeviceNotify(userId);
        if (!next && (state === "on" || state === "push")) await disableDeviceNotify(userId);
        await setNotifyFriendDone(next);
      } catch (error) {
        saveFailed(error);
      } finally {
        setPending(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <LabeledSwitch name="notifyFriendDone" title={t("friendDoneTitle")} description={description} checked={shown} onChange={change} />
      {state === "denied" && shown && (
        <p role="status" className="text-xs text-danger">
          {t("desktopNotifyBlocked")}
        </p>
      )}
      {state === "outdated" && <p className="text-xs text-muted">{t("desktopNotifyReinstall")}</p>}
    </div>
  );
}
