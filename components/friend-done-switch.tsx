"use client";

import { useOptimistic, useTransition } from "react";

import { setNotifyFriendDone } from "@/app/(tabs)/settings/actions";
import { LabeledSwitch } from "@/components/labeled-switch";
import { useSaveFailure } from "@/components/use-save-failure";

/** 마이페이지 "알림"의 친구 끝냄 푸시 켜기·끄기(앱에서만). 누르면 바로 바뀌고 서버에는 뒤따라 저장한다. */
export function FriendDoneSwitch({ on }: { on: boolean }) {
  const [shown, setShown] = useOptimistic(on);
  const [, startTransition] = useTransition();
  const saveFailed = useSaveFailure();

  return (
    <LabeledSwitch
      name="notifyFriendDone"
      title="친구가 할 일을 끝내면 알림"
      description="같은 친구의 알림은 10분에 한 번만 와요. 꺼도 소셜의 알림 목록에는 보여요."
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
