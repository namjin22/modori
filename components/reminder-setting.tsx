"use client";

import { useOptimistic, useTransition } from "react";

import { setReminder } from "@/app/(tabs)/settings/actions";
import { LabeledSwitch } from "@/components/labeled-switch";
import { TimeSheet } from "@/components/time-sheet";
import { useSaveFailure } from "@/components/use-save-failure";
import { DEFAULT_REMINDER_MINUTE } from "@/lib/reminder";


/**
 * 마이페이지의 할 일 리마인드 켜기·시각 고르기(앱에서만 보인다). 누르면 바로 바뀌고 서버에는 뒤따라 저장한다.
 * 알림을 받을 기기(허용한 알림)가 없으면 받을 수 없다는 것을 같이 알린다.
 */
export function ReminderSetting({ minute, hasDevice }: { minute: number | null; hasDevice: boolean }) {
  const [shown, setShown] = useOptimistic(minute);
  const [, startTransition] = useTransition();
  const saveFailed = useSaveFailure();

  function save(next: number | null) {
    startTransition(async () => {
      setShown(next);
      try {
        const result = await setReminder(next);
        if (!result.ok) throw new Error("리마인드 시각이 올바르지 않다.");
      } catch (error) {
        saveFailed(error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <LabeledSwitch
        name="reminder"
        title="할 일 리마인드"
        description="하루 한 번, 정한 시각에 오늘 남은 할 일 수를 알려 줘요. 다 끝낸 날은 울리지 않아요."
        checked={shown !== null}
        onChange={(on) => save(on ? (minute ?? DEFAULT_REMINDER_MINUTE) : null)}
      />
      {shown !== null && (
        <div className="flex animate-rise items-center gap-3">
          <span className="shrink-0 text-sm text-muted">알림 시각</span>
          <div className="min-w-0 flex-1">
            <TimeSheet label="알림 시각" value={shown} onChange={save} />
          </div>
        </div>
      )}
      {shown !== null && !hasDevice && (
        <p role="note" className="text-xs text-danger">
          이 폰에서 모도리 알림이 꺼져 있어 받을 수 없어요. 휴대폰 설정에서 모도리 알림을 켜 주세요.
        </p>
      )}
    </div>
  );
}
