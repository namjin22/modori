"use client";

import { useState, useTransition } from "react";

import { updateRoutine } from "@/app/(tabs)/routines/actions";
import { ChoicePicker } from "@/components/choice-picker";
import { useT } from "@/components/locale-provider";
import { Modal } from "@/components/modal";
import { RoutineRuleFields, type RuleInitial } from "@/components/routine-form";
import { SubmitButton } from "@/components/submit-button";
import { useSaveFailure } from "@/components/use-save-failure";
import { common } from "@/lib/i18n/messages/common";
import { events } from "@/lib/i18n/messages/events";

/**
 * 루틴 한 줄의 "고치기". 만들 때와 같은 칸(내용, 카테고리, 반복 주기·요일·날짜, 시작·종료일)을 지금 값으로 채워 보여 준다(2026-11-05 요청).
 * 예전에는 내용과 카테고리만 고쳤다(2026-10-12). 규칙을 바꿔도 이미 만들어진 할 일은 그대로 남는다(app/(tabs)/routines/actions.ts).
 */
export function RoutineEditButton({
  routine,
  rule,
  categories,
}: {
  routine: { id: string; content: string; categoryId: string | null };
  rule: RuleInitial;
  categories: { id: string; name: string; color?: string }[];
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
      <Modal open={open} onClose={() => setOpen(false)} title={t("editRoutineTitle")}>
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
            aria-label={t("routineContentLabel")}
            className="h-12 rounded-xl bg-surface-hover px-3 outline-none focus:ring-2 focus:ring-brand"
          />
          <ChoicePicker
            label={t("routineCategoryLabel")}
            name="categoryId"
            // 카테고리를 지워 비어 있던 루틴은 첫 카테고리를 먼저 보여 준다.
            defaultValue={routine.categoryId ?? categories[0]?.id}
            options={categories.map((category) => ({ value: category.id, label: category.name, color: category.color }))}
          />
          <RoutineRuleFields initial={rule} />
          <p className="text-xs text-muted">{t("routineEditHint")}</p>
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
