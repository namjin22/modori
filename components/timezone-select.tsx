"use client";

import { useOptimistic, useSyncExternalStore, useTransition } from "react";

import { setTimezone } from "@/app/(tabs)/settings/actions";
import { useSaveFailure } from "@/components/use-save-failure";
import { isAllowedTimezone, TIMEZONES } from "@/lib/timezones";

const subscribeNothing = () => () => undefined;

/** 이 기기가 쓰는 시간대. 서버에는 없어서 처음 그릴 때는 빈 값이다(그 뒤 한 번 맞춘다). */
function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.warn("[timezone] 기기 시간대를 읽지 못했다.", error instanceof Error ? error.name : error);
    return "";
  }
}

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
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">내 시간대</span>
        <select
          value={optimistic}
          disabled={pending}
          onChange={(event) => choose(event.target.value)}
          aria-label="시간대"
          className="h-12 w-full rounded-xl bg-surface-hover px-3 text-[15px] outline-none focus:ring-2 focus:ring-brand"
        >
          {TIMEZONES.map((zone) => (
            <option key={zone.value} value={zone.value}>
              {zone.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted">
          오늘, 루틴, 달력이 이 시간대 기준으로 움직여요. 지금 이 시간대의 오늘은 <b className="font-semibold text-foreground">{todayLabel}</b>이에요.
        </span>
      </label>

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
