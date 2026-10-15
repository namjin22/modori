"use client";

import { useState, useTransition } from "react";

import { updateRoutine } from "@/app/(tabs)/routines/actions";
import { ChoicePicker } from "@/components/choice-picker";
import { Modal } from "@/components/modal";
import { SubmitButton } from "@/components/submit-button";
import { useSaveFailure } from "@/components/use-save-failure";

/** 루틴 한 줄의 "고치기". 내용과 카테고리를 바꾼다(반복 규칙은 지우고 새로 만드는 편이 헷갈리지 않는다). */
export function RoutineEditButton({
  routine,
  categories,
}: {
  routine: { id: string; content: string; categoryId: string | null };
  categories: { id: string; name: string; color?: string }[];
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
      <Modal open={open} onClose={() => setOpen(false)} title="루틴 고치기">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              try {
                const result = await updateRoutine(formData);
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
          <input
            name="content"
            defaultValue={routine.content}
            required
            maxLength={200}
            autoFocus
            data-autofocus
            aria-label="루틴 내용 수정"
            className="h-12 rounded-xl bg-surface-hover px-3 outline-none focus:ring-2 focus:ring-brand"
          />
          <ChoicePicker
            label="루틴 카테고리 수정"
            name="categoryId"
            // 카테고리를 지워 비어 있던 루틴은 첫 카테고리를 먼저 보여 준다.
            defaultValue={routine.categoryId ?? categories[0]?.id}
            options={categories.map((category) => ({ value: category.id, label: category.name, color: category.color }))}
          />
          <p className="text-xs text-muted">오늘부터 생기는 할 일에 바로 반영돼요. 지난 날의 기록은 그대로 남아요.</p>
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
