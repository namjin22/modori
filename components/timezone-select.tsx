"use client";

import { useOptimistic, useSyncExternalStore, useTransition } from "react";

import { setTimezone } from "@/app/(tabs)/settings/actions";
import { ChoicePicker } from "@/components/choice-picker";
import { useSaveFailure } from "@/components/use-save-failure";
import { deviceTimezone, subscribeNothing } from "@/lib/device-timezone";
import { isAllowedTimezone, TIMEZONES } from "@/lib/timezones";

/**
 * 나라·도시로 시간대를 고른다. 고르면 바로 저장되고 모든 화면의 "오늘"이 그 기준으로 바뀐다.
 * 기기의 시간대가 다르면(여행 중이거나 해외에 사는 사람) 한 번에 맞추는 버튼을 보여 준다.
 */
export function TimezoneSelect({ current, todayLabel }: { current: string; todayLabel: string }) {
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
        <span className="text-sm font-medium">내 시간대</span>
        <ChoicePicker
          label="시간대"
          value={optimistic}
          disabled={pending}
          onChange={choose}
          options={TIMEZONES.map((zone) => ({ value: zone.value, label: zone.label }))}
        />
        <span className="text-xs text-muted">
          오늘, 루틴, 달력이 이 시간대 기준으로 움직여요. 지금 이 시간대의 오늘은 <b className="font-semibold text-foreground">{todayLabel}</b>이에요.
        </span>
      </div>

      {deviceDiffers && (
        <button
          type="button"
          onClick={() => choose(device)}
          className="h-10 self-start rounded-xl bg-brand-subtle px-3 text-sm font-semibold text-brand"
        >
          이 기기 시간대({TIMEZONES.find((zone) => zone.value === device)?.label})로 맞추기
        </button>
      )}
    </div>
  );
}
