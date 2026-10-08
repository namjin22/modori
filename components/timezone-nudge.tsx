"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";

import { setTimezone } from "@/app/(tabs)/settings/actions";
import { useTimezone } from "@/components/timezone-context";
import { useSaveFailure } from "@/components/use-save-failure";
import { deviceTimezone, subscribeNothing } from "@/lib/device-timezone";
import { isAllowedTimezone, TIMEZONES } from "@/lib/timezones";

const DISMISS_PREFIX = "modori-tz-dismissed:";

function dismissed(zone: string): boolean {
  try {
    return localStorage.getItem(DISMISS_PREFIX + zone) === "1";
  } catch (error) {
    // 저장소를 못 읽으면(사생활 보호 창) 이미 거절했는지 모른다. 안내는 한 번 더 보여도 해가 없다.
    console.warn("[timezone] 거절 기록을 읽지 못했다.", error instanceof Error ? error.name : error);
    return false;
  }
}

/**
 * 기기의 시간대가 내가 정한 시간대와 다르면 맞출지 묻는 카드. 해외에 사는 사람은 마이페이지 안쪽의 설정을 찾지 못해
 * "오늘" 날짜가 하루 어긋난 채로 쓴다(공개 직후 캐나다 친구가 그랬다). 자동으로 바꾸지는 않는다: VPN·여행·기기 설정 때문에
 * 사용자가 모르는 사이 날이 바뀌는 것이 더 나쁘다. "그대로"를 누르면 그 기기 시간대에 대해서는 다시 묻지 않는다.
 */
export function TimezoneNudge() {
  const saved = useTimezone();
  const device = useSyncExternalStore(subscribeNothing, deviceTimezone, () => "");
  const [hidden, setHidden] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const saveFailed = useSaveFailure();
  const wasDismissed = useSyncExternalStore(subscribeNothing, () => (device ? dismissed(device) : true), () => true);

  if (hidden || wasDismissed || device === "" || device === saved || !isAllowedTimezone(device)) return null;
  const label = TIMEZONES.find((zone) => zone.value === device)?.label ?? device;

  function apply() {
    startTransition(async () => {
      try {
        await setTimezone(device);
        setHidden(true);
        router.refresh();
      } catch (error) {
        saveFailed(error);
      }
    });
  }

  function keep() {
    try {
      localStorage.setItem(DISMISS_PREFIX + device, "1");
    } catch (error) {
      console.warn("[timezone] 거절 기록을 저장하지 못했다.", error instanceof Error ? error.name : error);
    }
    setHidden(true);
  }

  return (
    <div role="region" aria-label="시간대 안내" className="mb-4 flex flex-col gap-3 rounded-2xl bg-brand-subtle p-4">
      <p className="text-sm">
        이 기기는 <b className="font-semibold">{label}</b> 시간이에요. 오늘 날짜를 이 시간대로 맞출까요?
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={apply}
          className="h-10 flex-1 rounded-xl bg-brand text-sm font-semibold text-brand-contrast disabled:opacity-60"
        >
          {pending ? "맞추는 중" : "맞추기"}
        </button>
        <button type="button" onClick={keep} className="h-10 flex-1 rounded-xl bg-surface text-sm font-medium text-muted">
          지금 그대로
        </button>
      </div>
    </div>
  );
}
