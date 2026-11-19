"use client";

import { type ReactNode, useEffect } from "react";

import { createGoal, type GoalFormState, updateGoal } from "@/app/(tabs)/goals/actions";
import { DatePicker } from "@/components/date-picker";
import { useT } from "@/components/locale-provider";
import { PrivateSwitch } from "@/components/private-switch";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/components/use-form-action";
import { GOAL_TITLE_MAX } from "@/lib/goals";
import { common } from "@/lib/i18n/messages/common";
import { goals } from "@/lib/i18n/messages/goals";

type EditingGoal = { id: string; title: string; dueDate: string | null; isPublic: boolean };

/**
 * 목표 만들기와 고치기에 같이 쓴다(2026-11-19). 이름 하나가 먼저고, 기한은 선택, "비공개"를 켜면 나만 본다(기본은 공개).
 * 세부 목표는 이 폼이 아니라 목표 카드를 펼쳐 더한다(components/goal-section.tsx).
 */
export function GoalForm({
  goal,
  onSaved,
  onCancel,
  deleteButton,
}: {
  goal?: EditingGoal;
  onSaved: () => void;
  onCancel: () => void;
  // 고치는 창의 삭제 버튼. 주면 취소·저장과 한 줄 왼쪽에 둔다(일정 폼과 같다).
  deleteButton?: ReactNode;
}) {
  const t = useT(goals);
  const tc = useT(common);
  const [state, action, pending] = useFormAction<GoalFormState>(goal ? updateGoal : createGoal, null);
  // 만들기 칸과 고치기 창이 한 화면에 같이 떠 있을 수 있다. 이름표를 구분한다.
  const label = goal ? t("goalLabel") : t("newGoalLabel");

  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);

  return (
    <form onSubmit={action} className="flex flex-col gap-4">
      {goal && <input type="hidden" name="id" value={goal.id} />}

      <input
        name="title"
        required
        maxLength={GOAL_TITLE_MAX}
        defaultValue={goal?.title}
        autoFocus
        data-autofocus
        placeholder={t("namePlaceholder")}
        aria-label={t("nameLabel", { label })}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
        className="h-12 w-full rounded-xl bg-surface-hover px-4 text-[15px] outline-none placeholder:text-muted focus:ring-2 focus:ring-brand"
      />

      <div className="flex flex-col gap-1.5 text-xs text-muted">
        {t("dueTitle")}
        <DatePicker label={t("dueLabel", { label })} name="dueDate" defaultValue={goal?.dueDate ?? ""} clearable emptyText={t("dueEmpty")} />
      </div>

      <div className="rounded-xl border border-border px-3 py-3">
        <PrivateSwitch title={t("privateTitle")} description={t("privateHint")} defaultChecked={goal ? !goal.isPublic : false} />
      </div>

      {state?.message && !state.ok && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}

      <div className={deleteButton ? "flex items-center gap-2" : "grid grid-cols-2 gap-2"}>
        {deleteButton && <div className="mr-auto">{deleteButton}</div>}
        <button type="button" onClick={onCancel} className={`h-11 rounded-xl bg-surface-hover text-sm font-semibold ${deleteButton ? "px-5" : ""}`}>
          {tc("cancel")}
        </button>
        <SubmitButton
          pending={pending}
          pendingLabel={tc("saving")}
          className={`h-11 rounded-xl bg-brand text-sm font-semibold text-brand-contrast ${deleteButton ? "px-7" : ""}`}
        >
          {tc("save")}
        </SubmitButton>
      </div>
    </form>
  );
}
