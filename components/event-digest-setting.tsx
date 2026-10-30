"use client";

import { useOptimistic, useTransition } from "react";

import { setEventDigest } from "@/app/(tabs)/settings/actions";
import { LabeledSwitch } from "@/components/labeled-switch";
import { useT } from "@/components/locale-provider";
import { TimeSheet } from "@/components/time-sheet";
import { useSaveFailure } from "@/components/use-save-failure";
import { DEFAULT_EVENT_DIGEST_MINUTE } from "@/lib/event-digest";
import { settings } from "@/lib/i18n/messages/settings";

/**
 * 마이페이지의 오늘 일정 알림 켜기·시각 고르기(앱에서만 보인다). 누르면 바로 바뀌고 서버에는 뒤따라 저장한다.
 * 알림을 받을 기기(허용한 알림)가 없으면 받을 수 없다는 것을 같이 알린다.
 */
export function EventDigestSetting({ minute, hasDevice }: { minute: number | null; hasDevice: boolean }) {
  const t = useT(settings);
  const [shown, setShown] = useOptimistic(minute);
  const [, startTransition] = useTransition();
  const saveFailed = useSaveFailure();

  function save(next: number | null) {
    startTransition(async () => {
      setShown(next);
      try {
        const result = await setEventDigest(next);
        if (!result.ok) throw new Error("오늘 일정 알림 시각이 올바르지 않다.");
      } catch (error) {
        saveFailed(error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <LabeledSwitch
        name="eventDigest"
        title={t("digestTitle")}
        description={t("digestHint")}
        checked={shown !== null}
        onChange={(on) => save(on ? DEFAULT_EVENT_DIGEST_MINUTE : null)}
      />
      {shown !== null && (
        <div className="flex animate-rise items-center gap-3">
          <span className="shrink-0 text-sm text-muted">{t("digestTime")}</span>
          <div className="min-w-0 flex-1">
            <TimeSheet label={t("digestTimeLabel")} value={shown} onChange={save} />
          </div>
        </div>
      )}
      {shown !== null && !hasDevice && (
        <p role="note" className="text-xs text-danger">
          {t("noDevice")}
        </p>
      )}
    </div>
  );
}
