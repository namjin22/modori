"use client";

import { useState, useTransition } from "react";

import { updateEventRoutine } from "@/app/(tabs)/routines/event-routine-actions";
import { useT } from "@/components/locale-provider";
import { Modal } from "@/components/modal";
import { EventRoutineFields } from "@/components/routine-form";
import { SubmitButton } from "@/components/submit-button";
import { useSaveFailure } from "@/components/use-save-failure";
import { formatTime } from "@/lib/event-time";
import { common } from "@/lib/i18n/messages/common";
import { events } from "@/lib/i18n/messages/events";

/** 반복 일정 한 줄의 "고치기". 이름·시간·색을 바꾼다. 반복 규칙은 할 일 루틴과 같이 지우고 새로 만든다. */
export function EventRoutineEditButton({
  routine,
}: {
  routine: { id: string; title: string; color: string; startTime: number | null; endTime: number | null; isPublic: boolean };
}) {
  const t = useT(events);
  const tc = useT(common);
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
        {t("fix")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("editRepeatTitle")}>
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
              isPublic: routine.isPublic,
            }}
          />
          <p className="text-xs text-muted">{t("editRepeatHint")}</p>
          {message && (
            <p role="alert" className="text-sm text-danger">
              {message}
            </p>
          )}
          <SubmitButton
            pending={pending}
            pendingLabel={tc("saving")}
            className="h-11 rounded-xl bg-brand text-sm font-semibold text-brand-contrast"
          >
            {tc("save")}
          </SubmitButton>
        </form>
      </Modal>
    </>
  );
}
