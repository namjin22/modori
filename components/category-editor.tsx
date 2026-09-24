"use client";

import { useRef, useState, useTransition } from "react";

import {
  deleteCategory,
  undoDeleteCategory,
  updateCategory,
} from "@/app/(tabs)/categories/actions";
import { ColorSwatches } from "@/components/color-swatches";
import { Modal } from "@/components/modal";
import { UndoableDeleteButton } from "@/components/undoable-delete-button";
import { useSaveFailure } from "@/components/use-save-failure";

type Category = { id: string; name: string; color: string; isPublic: boolean };

/**
 * 카테고리 한 줄. 누르면 창이 떠서 고친다. 할 일·일정과 같은 방식이다.
 *
 * 저장 버튼을 두지 않는다. 색을 고르거나 공개를 켜고 끄면 그 자리에서 저장되고,
 * 이름은 Enter를 누르거나 칸을 벗어나면 저장된다. 고친 것을 저장까지 한 번 더
 * 눌러야 하면, 누르지 않고 닫았을 때 바꾼 게 사라진 줄 모른다.
 */
export function CategoryEditor({ category }: { category: Category }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
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
        const result = await updateCategory(formData);
        setStatus(result.ok ? "저장했어요" : result.message);
      } catch (error) {
        setStatus("저장하지 못했어요");
        saveFailed(error);
      }
    });
  }

  return (
    <li className="rounded-2xl bg-surface">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${category.name} 고치기`}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span
          aria-hidden
          className="color-edge size-4 shrink-0 rounded-full"
          style={{ backgroundColor: category.color }}
        />
        <span className="flex-1 truncate font-medium">{category.name}</span>
        {!category.isPublic && (
          <span className="rounded-full bg-surface-hover px-2 py-0.5 text-xs text-muted">
            비공개
          </span>
        )}
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

      <Modal open={open} onClose={() => setOpen(false)} title="카테고리">
        <form
          ref={formRef}
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
          // 색과 공개 여부는 고르는 순간 저장한다. 글자 입력은 칸을 벗어날 때 저장한다.
          onChange={(event) => {
            const target = event.target;
            if (
              target instanceof HTMLInputElement &&
              (target.type === "radio" || target.type === "checkbox")
            ) {
              save();
            }
          }}
          className="flex flex-col gap-5"
        >
          <input type="hidden" name="id" value={category.id} />
          <input
            name="name"
            defaultValue={category.name}
            maxLength={20}
            required
            aria-label="카테고리 이름"
            onBlur={(event) => {
              if (event.target.value !== lastName.current) save();
            }}
            className="h-12 w-full rounded-xl bg-surface-hover px-4 text-[15px] font-medium outline-none focus:ring-2 focus:ring-brand"
          />

          <ColorSwatches name="color" legend="색" defaultValue={category.color} />

          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="flex flex-col">
              <span className="text-sm font-medium">친구 피드에 보이기</span>
              <span className="text-xs text-muted">끄면 이 카테고리의 할 일은 나만 봐요</span>
            </span>
            {/* 스위치 모양. 체크박스 그대로 두어 키보드와 화면 읽기가 된다. */}
            <input
              type="checkbox"
              name="isPublic"
              defaultChecked={category.isPublic}
              className="relative h-6 w-10 shrink-0 cursor-pointer appearance-none rounded-full bg-border transition-colors before:absolute before:left-0.5 before:top-0.5 before:size-5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-brand checked:before:translate-x-4"
            />
          </label>
        </form>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <span
            aria-live="polite"
            className={`text-xs ${
              status && status !== "저장했어요" ? "text-danger" : "text-muted"
            }`}
          >
            {pending ? "저장 중" : status}
          </span>

          {/* 할 일은 "카테고리 없음"으로 남는다. 지운 직후 알림에서 되돌릴 수 있다. */}
          <UndoableDeleteButton
            id={category.id}
            remove={deleteCategory}
            restore={undoDeleteCategory}
            message="카테고리를 지웠어요. 할 일은 남아요"
            onDone={() => setOpen(false)}
            className="h-9 rounded-xl px-3 text-sm text-danger hover:bg-surface-hover"
          />
        </div>
      </Modal>
    </li>
  );
}
