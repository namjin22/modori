"use client";

import { useOptimistic, useSyncExternalStore, useTransition } from "react";

import { setTimezone } from "@/app/(tabs)/settings/actions";
import { ChoicePicker } from "@/components/choice-picker";
import { useT } from "@/components/locale-provider";
import { useSaveFailure } from "@/components/use-save-failure";
import { deviceTimezone, subscribeNothing } from "@/lib/device-timezone";
import { timezoneNames } from "@/lib/i18n/messages/timezones";
import { settings } from "@/lib/i18n/messages/settings";
import { isAllowedTimezone, TIMEZONES } from "@/lib/timezones";

/**
 * 나라·도시로 시간대를 고른다. 고르면 바로 저장되고 모든 화면의 "오늘"이 그 기준으로 바뀐다.
 * 기기의 시간대가 다르면(여행 중이거나 해외에 사는 사람) 한 번에 맞추는 버튼을 보여 준다.
 */
export function TimezoneSelect({ current, todayLabel }: { current: string; todayLabel: string }) {
  const t = useT(settings);
  const tz = useT(timezoneNames);
  const [optimistic, setOptimistic] = useOptimistic(current);
  const [pending, startTransition] = useTransition();
  const saveFailed = useSaveFailure();
  const device = useSyncExternalStore(subscribeNothing, deviceTimezone, () => "");

  function choose(next: string) {
    startTransition(async () => {
      setOptimistic(next);
      try {
        await setTimezone(next);
      } catch (error) {
        saveFailed(error);
      }
    });
  }

  const deviceDiffers = device !== "" && device !== optimistic && isAllowedTimezone(device);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t("myZone")}</span>
        <ChoicePicker
          label={t("zonePicker")}
          value={optimistic}
          disabled={pending}
          onChange={choose}
          options={TIMEZONES.map((zone) => ({ value: zone.value, label: tz(zone.value as Parameters<typeof tz>[0]) }))}
        />
        <span className="text-xs text-muted">
          {t("zoneHint")} <b className="font-semibold text-foreground">{todayLabel}</b>{t("zoneHintEnd")}
        </span>
      </div>

      {deviceDiffers && (
        <button
          type="button"
          onClick={() => choose(device)}
          className="h-10 self-start rounded-xl bg-brand-subtle px-3 text-sm font-semibold text-brand"
        >
          {t("useDeviceZone", { zone: tz(device as Parameters<typeof tz>[0]) })}
        </button>
      )}
    </div>
  );
}
