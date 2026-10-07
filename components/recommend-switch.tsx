"use client";

import { useOptimistic, useTransition } from "react";

import { setHideFromRecommend } from "@/app/(tabs)/settings/actions";
import { LabeledSwitch } from "@/components/labeled-switch";
import { useSaveFailure } from "@/components/use-save-failure";

/**
 * 친구 찾기의 "추천 친구"에 내가 나올지 고르는 스위치. 누르면 바로 바뀌고 서버에는 뒤따라 저장한다.
 * 켜 둔 사람(기본)은 나오고, 끄면 안 나온다. 닉네임으로 검색하면 그대로 찾을 수 있다.
 */
export function RecommendSwitch({ hidden }: { hidden: boolean }) {
  const [optimisticHidden, setOptimisticHidden] = useOptimistic(hidden);
  const [, startTransition] = useTransition();
  const saveFailed = useSaveFailure();

  return (
    <LabeledSwitch
      name="recommend"
      title="친구 추천에 나오기"
      description="끄면 친구 찾기의 추천 목록에 내가 나오지 않아요. 이름을 검색하면 그대로 찾을 수 있어요."
      checked={!optimisticHidden}
      onChange={(next) =>
        startTransition(async () => {
          setOptimisticHidden(!next);
          try {
            await setHideFromRecommend(!next);
          } catch (error) {
            saveFailed(error);
          }
        })
      }
    />
  );
}
