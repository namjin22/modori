"use client";

import { useOptimistic, useTransition } from "react";

import { setHideFromRecommend } from "@/app/(tabs)/settings/actions";
import { LabeledSwitch } from "@/components/labeled-switch";
import { useT } from "@/components/locale-provider";
import { useSaveFailure } from "@/components/use-save-failure";
import { settings } from "@/lib/i18n/messages/settings";

/**
 * 친구 찾기의 "추천 친구"에 내가 나올지 고르는 스위치. 누르면 바로 바뀌고 서버에는 뒤따라 저장한다.
 * 켜 둔 사람(기본)은 나오고, 끄면 안 나온다. 닉네임으로 검색하면 그대로 찾을 수 있다.
 */
export function RecommendSwitch({ hidden }: { hidden: boolean }) {
  const t = useT(settings);
  const [optimisticHidden, setOptimisticHidden] = useOptimistic(hidden);
  const [, startTransition] = useTransition();
  const saveFailed = useSaveFailure();

  return (
    <LabeledSwitch
      name="recommend"
      title={t("recommendTitle")}
      description={t("recommendHint")}
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
