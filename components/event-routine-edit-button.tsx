"use client";

import { useState, useTransition } from "react";

import { updateEventRoutine } from "@/app/(tabs)/routines/event-routine-actions";
import { Modal } from "@/components/modal";
import { EventRoutineFields } from "@/components/routine-form";
import { SubmitButton } from "@/components/submit-button";
import { useSaveFailure } from "@/components/use-save-failure";
import { formatTime } from "@/lib/event-time";

/** 반복 일정 한 줄의 "고치기". 이름·시간·색을 바꾼다. 반복 규칙은 할 일 루틴과 같이 지우고 새로 만든다. */
export function EventRoutineEditButton({
  routine,
}: {
  routine: { id: string; title: string; color: string; startTime: number | null; endTime: number | null };
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const saveFailed = useSaveFailure();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMessage(null);
          setOpen(true);
        }}
        className="h-8 rounded-lg px-2 text-xs text-muted hover:bg-surface-hover"
      >
        고치기
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="반복 일정 고치기">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              try {
                const result = await updateEventRoutine(formData);
                if (result.ok) setOpen(false);
                else setMessage(result.message);
              } catch (error) {
                saveFailed(error);
              }
            });
          }}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="id" value={routine.id} />
          <EventRoutineFields
            initial={{
              title: routine.title,
              color: routine.color,
              startTime: routine.startTime === null ? "" : formatTime(routine.startTime),
              endTime: routine.endTime === null ? "" : formatTime(routine.endTime),
            }}
          />
          <p className="text-xs text-muted">지난 날과 앞날 모두 바뀐 이름·시간으로 보여요.</p>
          {message && (
            <p role="alert" className="text-sm text-danger">
              {message}
            </p>
          )}
          <SubmitButton
            pending={pending}
            pendingLabel="저장 중"
            className="h-11 rounded-xl bg-brand text-sm font-semibold text-brand-contrast"
          >
            저장
          </SubmitButton>
        </form>
      </Modal>
    </>
  );
}
