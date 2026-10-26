"use client";

import { type FormEvent, useOptimistic, useState, useTransition } from "react";

import { deleteAlarm, saveAlarm, setAlarmEnabled } from "@/app/(tabs)/settings/alarms/actions";
import { Modal } from "@/components/modal";
import { TimeSheet } from "@/components/time-sheet";
import { useSaveFailure } from "@/components/use-save-failure";
import { MAX_ALARMS, MAX_ALARM_MESSAGE, describeWeekdays } from "@/lib/alarm";
import { formatReminderMinute } from "@/lib/reminder";

export type AlarmItem = { id: string; minute: number; weekdays: number[]; message: string; enabled: boolean };

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
/** 새로 만들 때 처음 보이는 시각: 오전 9시. */
const DEFAULT_MINUTE = 9 * 60;

/**
 * 내가 정한 알림 목록(마이페이지 > 내가 정한 알림). 줄을 누르면 고치는 창이 뜨고, 스위치로 바로 켜고 끈다.
 * 받을 기기가 없으면(앱 푸시 번호·웹 푸시 구독 모두 없음) 만들어도 오지 않으니 그것부터 알린다.
 */
export function AlarmList({ alarms, hasDevice }: { alarms: AlarmItem[]; hasDevice: boolean }) {
  const [editing, setEditing] = useState<AlarmItem | "new" | null>(null);
  const full = alarms.length >= MAX_ALARMS;

  return (
    <div className="flex flex-col gap-4">
      {!hasDevice && (
        <p role="note" className="rounded-xl bg-surface p-4 text-sm leading-relaxed text-danger">
          알림을 받을 기기가 없어요. 폰 앱에서 알림을 허용하거나, 컴퓨터 브라우저에서 마이페이지의 &ldquo;이 기기에서 알림 띄우기&rdquo;를 켜 주세요. Windows
          앱으로는 받을 수 없어요.
        </p>
      )}

      {alarms.length === 0 ? (
        <p className="rounded-2xl bg-surface p-6 text-center text-sm text-muted">아직 만든 알림이 없어요</p>
      ) : (
        <ul aria-label="내가 정한 알림" className="flex flex-col gap-2">
          {alarms.map((alarm) => (
            <AlarmRow key={alarm.id} alarm={alarm} onOpen={() => setEditing(alarm)} />
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={full}
        onClick={() => setEditing("new")}
        className="h-12 rounded-xl border border-dashed border-border text-sm text-muted transition-colors hover:bg-surface disabled:opacity-60"
      >
        {full ? `알림은 ${MAX_ALARMS}개까지예요` : "+ 알림 추가"}
      </button>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "새 알림" : "알림 고치기"}>
        {editing && (
          <AlarmForm
            // 열 때마다 새로 그려 이전에 고르던 값이 남지 않게 한다.
            key={editing === "new" ? "new" : editing.id}
            alarm={editing === "new" ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function AlarmRow({ alarm, onOpen }: { alarm: AlarmItem; onOpen: () => void }) {
  const [enabled, setEnabled] = useOptimistic(alarm.enabled);
  const [, startTransition] = useTransition();
  const saveFailed = useSaveFailure();

  function toggle(next: boolean) {
    startTransition(async () => {
      setEnabled(next);
      try {
        await setAlarmEnabled(alarm.id, next);
      } catch (error) {
        saveFailed(error);
      }
    });
  }

  return (
    <li className="flex items-center gap-3 rounded-2xl bg-surface p-4">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${alarm.message} 고치기`}
        className={`flex min-w-0 flex-1 flex-col gap-1 text-left ${enabled ? "" : "opacity-50"}`}
      >
        <span className="text-xl font-bold tabular-nums">{formatReminderMinute(alarm.minute)}</span>
        <span className="truncate text-[15px]">{alarm.message}</span>
        <span className="text-xs text-muted">{describeWeekdays(alarm.weekdays)}</span>
      </button>
      <input
        type="checkbox"
        role="switch"
        aria-label={`${alarm.message} 켜기`}
        checked={enabled}
        onChange={(event) => toggle(event.target.checked)}
        className="relative h-6 w-10 shrink-0 cursor-pointer appearance-none rounded-full bg-border transition-colors before:absolute before:left-0.5 before:top-0.5 before:size-5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-brand checked:before:translate-x-4"
      />
    </li>
  );
}

function AlarmForm({ alarm, onDone }: { alarm: AlarmItem | null; onDone: () => void }) {
  const [minute, setMinute] = useState(alarm?.minute ?? DEFAULT_MINUTE);
  const [days, setDays] = useState<number[]>(alarm?.weekdays ?? []);
  const [message, setMessage] = useState(alarm?.message ?? "");
  const [problem, setProblem] = useState("");
  const [pending, startTransition] = useTransition();
  const saveFailed = useSaveFailure();

  function toggleDay(day: number) {
    setDays((current) => (current.includes(day) ? current.filter((value) => value !== day) : [...current, day]));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        const result = await saveAlarm(null, formData);
        if (result?.ok) onDone();
        else setProblem(result?.message ?? "저장하지 못했어요.");
      } catch (error) {
        saveFailed(error);
      }
    });
  }

  function remove() {
    if (!alarm || pending) return;
    startTransition(async () => {
      try {
        await deleteAlarm(alarm.id);
        onDone();
      } catch (error) {
        saveFailed(error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {alarm && <input type="hidden" name="id" value={alarm.id} />}
      <input type="hidden" name="minute" value={minute} />
      {days.map((day) => (
        <input key={day} type="hidden" name="weekday" value={day} />
      ))}

      <TimeSheet label="알림 시각" value={minute} onChange={(next) => next !== null && setMinute(next)} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs text-muted">요일 (안 고르면 매일)</legend>
        <div className="flex gap-1.5">
          {WEEKDAYS.map((name, day) => {
            const on = days.includes(day);
            return (
              <button
                key={name}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDay(day)}
                className={`flex h-10 flex-1 items-center justify-center rounded-xl text-sm transition-colors ${
                  on ? "bg-brand font-semibold text-brand-contrast" : "bg-surface-hover text-muted"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5 text-xs text-muted">
        알림 문구
        <input
          name="message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={MAX_ALARM_MESSAGE}
          required
          placeholder="예: 물 한 컵 마시기"
          className="h-12 rounded-xl bg-surface-hover px-4 text-[15px] text-foreground outline-none placeholder:text-muted focus:ring-2 focus:ring-brand"
        />
        <span className="self-end tabular-nums">
          {[...message].length}/{MAX_ALARM_MESSAGE}
        </span>
      </label>

      {problem && (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      )}

      <div className="flex items-center gap-2">
        {alarm && (
          <button type="button" onClick={remove} disabled={pending} className="-ml-2 h-11 rounded-xl px-2 text-sm font-medium text-danger">
            삭제
          </button>
        )}
        <button type="button" onClick={onDone} className="ml-auto h-11 rounded-xl bg-surface-hover px-5 text-sm font-semibold">
          취소
        </button>
        <button type="submit" disabled={pending} className="h-11 rounded-xl bg-brand px-7 text-sm font-semibold text-brand-contrast disabled:opacity-60">
          {pending ? "저장 중" : "저장"}
        </button>
      </div>
    </form>
  );
}
