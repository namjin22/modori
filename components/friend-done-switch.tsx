"use client";

import { useOptimistic, useTransition } from "react";

import { setNotifyFriendDone } from "@/app/(tabs)/settings/actions";
import { LabeledSwitch } from "@/components/labeled-switch";
import { useT } from "@/components/locale-provider";
import { useSaveFailure } from "@/components/use-save-failure";
import { settings } from "@/lib/i18n/messages/settings";

/** 친구가 끝낸 일 알림 켜기·끄기. 알림 화면 위(모든 화면)와 마이페이지 "알림"(앱)에 있다. 누르면 바로 바뀌고 서버에는 뒤따라 저장한다. */
export function FriendDoneSwitch({ on }: { on: boolean }) {
  const t = useT(settings);
  const [shown, setShown] = useOptimistic(on);
  const [, startTransition] = useTransition();
  const saveFailed = useSaveFailure();

  return (
    <LabeledSwitch
      name="notifyFriendDone"
      title={t("friendDoneTitle")}
      description={t("friendDoneHint")}
      checked={shown}
      onChange={(next) =>
        startTransition(async () => {
          setShown(next);
          try {
            await setNotifyFriendDone(next);
          } catch (error) {
            saveFailed(error);
          }
        })
      }
    />
  );
}
