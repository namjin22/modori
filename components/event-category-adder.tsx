"use client";

import { createEventCategory, type EventCategoryState } from "@/app/(tabs)/event-categories/actions";
import { ColorSwatches } from "@/components/color-swatches";
import { useT } from "@/components/locale-provider";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/components/use-form-action";
import { PALETTE } from "@/lib/colors";
import { events } from "@/lib/i18n/messages/events";

// 주황: 시험처럼 눈에 띄어야 하는 일정에 흔히 쓰는 색이라 첫 색으로 둔다.
const DEFAULT_NEW_COLOR = PALETTE[1].value;

/** 일정 카테고리 만들기. 이름과 색을 정해 "추가"를 누른다. 서버가 거절하면(이름이 겹침 등) 이유를 보여주고 적은 것은 지우지 않는다. */
export function EventCategoryAdder() {
  const t = useT(events);
  const [state, action, pending] = useFormAction<EventCategoryState>(createEventCategory, null);

  return (
    <form onSubmit={action} className="flex flex-col gap-4 rounded-2xl bg-surface p-4">
      <div className="flex gap-2">
        <input
          name="name"
          required
          maxLength={20}
          placeholder={t("ecNewPlaceholder")}
          aria-label={t("ecNewLabel")}
          className="h-11 min-w-0 flex-1 rounded-xl bg-surface-hover px-3"
        />
        <SubmitButton
          pending={pending}
          pendingLabel={t("ecAdding")}
          className="h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-contrast"
        >
          {t("ecAdd")}
        </SubmitButton>
      </div>
      <ColorSwatches name="color" legend={t("color")} defaultValue={DEFAULT_NEW_COLOR} />
      {state?.message && !state.ok && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}
