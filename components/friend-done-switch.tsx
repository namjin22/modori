"use client";

import { useOptimistic, useTransition } from "react";

import { setNotifyFriendDone } from "@/app/(tabs)/settings/actions";
import { LabeledSwitch } from "@/components/labeled-switch";
import { useSaveFailure } from "@/components/use-save-failure";

/** 친구가 끝낸 일 알림 켜기·끄기. 알림 화면 위(모든 화면)와 마이페이지 "알림"(앱)에 있다. 누르면 바로 바뀌고 서버에는 뒤따라 저장한다. */
export function FriendDoneSwitch({ on }: { on: boolean }) {
  const [shown, setShown] = useOptimistic(on);
  const [, startTransition] = useTransition();
  const saveFailed = useSaveFailure();

  return (
    <LabeledSwitch
      name="notifyFriendDone"
      title="친구가 할 일을 끝내면 알림"
      description="끄면 알림 목록·소셜 탭 숫자·푸시에 뜨지 않아요. 푸시는 같은 친구마다 10분에 한 번이에요."
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
