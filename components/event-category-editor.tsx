"use client";

import { useRef, useState, useTransition } from "react";

import {
  deleteEventCategory,
  undoDeleteEventCategory,
  updateEventCategory,
} from "@/app/(tabs)/event-categories/actions";
import { ColorSwatches } from "@/components/color-swatches";
import { useT } from "@/components/locale-provider";
import { Modal } from "@/components/modal";
import { UndoableDeleteButton } from "@/components/undoable-delete-button";
import { useSaveFailure } from "@/components/use-save-failure";
import { common } from "@/lib/i18n/messages/common";
import { events } from "@/lib/i18n/messages/events";

type EventCategory = { id: string; name: string; color: string };

/**
 * 내 색(이름 붙은 색) 한 줄. 누르면 창이 떠서 고친다(할 일 카테고리와 같은 방식, components/category-editor.tsx).
 * 저장 버튼이 없다. 색을 고르면 그 자리에서, 이름은 Enter나 칸을 벗어날 때 저장한다.
 */
export function EventCategoryEditor({ category }: { category: EventCategory }) {
  const t = useT(events);
  const tc = useT(common);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const saveFailed = useSaveFailure();
  const formRef = useRef<HTMLFormElement>(null);
  const lastName = useRef(category.name);

  function save() {
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    lastName.current = String(formData.get("name") ?? "");
    setStatus(null);
    startTransition(async () => {
      try {
        const result = await updateEventCategory(formData);
        setStatus(result.ok ? { text: t("ecSaved"), ok: true } : { text: result.message, ok: false });
      } catch (error) {
        setStatus({ text: t("ecSaveFailed"), ok: false });
        saveFailed(error);
      }
    });
  }

  return (
    // 줄(li)과 카드 바탕은 순서 바꾸기 목록(SortableList)이 깐다.
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("ecEditLabel", { name: category.name })}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span aria-hidden className="color-edge size-4 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
        <span className="flex-1 truncate font-medium">{category.name}</span>
        <svg
          aria-hidden
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-muted"
        >
          <path d="M9 5 L16 12 L9 19" />
        </svg>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={t("ecModalTitle")}>
        <form
          ref={formRef}
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
          // 색은 고르는 순간 저장한다. 글자 입력은 칸을 벗어날 때 저장한다.
          onChange={(event) => {
            const target = event.target;
            if (target instanceof HTMLInputElement && target.type === "radio") save();
          }}
          className="flex flex-col gap-5"
        >
          <input type="hidden" name="id" value={category.id} />
          <input
            name="name"
            defaultValue={category.name}
            maxLength={20}
            required
            aria-label={t("ecNameLabel")}
            onBlur={(event) => {
              if (event.target.value !== lastName.current) save();
            }}
            className="h-12 w-full rounded-xl bg-surface-hover px-4 text-[15px] font-medium outline-none focus:ring-2 focus:ring-brand"
          />

          <ColorSwatches name="color" legend={t("color")} defaultValue={category.color} plain onChosen={save} />
        </form>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <span aria-live="polite" className={`text-xs ${status && !status.ok ? "text-danger" : "text-muted"}`}>
            {pending ? tc("saving") : status?.text}
          </span>

          {/* 일정과 색은 그대로 남는다. 지운 직후 알림에서 되돌릴 수 있다. */}
          <UndoableDeleteButton
            id={category.id}
            remove={deleteEventCategory}
            restore={undoDeleteEventCategory}
            message={t("ecDeleted")}
            onDone={() => setOpen(false)}
            className="h-9 rounded-xl px-3 text-sm text-danger hover:bg-surface-hover"
          />
        </div>
      </Modal>
    </div>
  );
}
