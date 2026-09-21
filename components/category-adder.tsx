"use client";

import { useRef, useState } from "react";

import { addTodo } from "@/app/(tabs)/actions";
import { Modal } from "@/components/modal";

/**
 * 카테고리 칩. 이름을 누르면 창이 떠서 그 카테고리에 할 일을 적는다.
 * 적고 Enter를 누르면 입력칸이 비워진 채 열려 있어서 여러 개를 연달아 적는다.
 */
export function CategoryAdder({
  categoryId,
  name,
  color,
  isPublic,
  date,
  count,
  archived = false,
}: {
  categoryId: string | null;
  name: string;
  color: string | null;
  isPublic: boolean;
  date: string;
  count: string | null;
  archived?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chip = (
    <>
      {!isPublic && (
        <span aria-label="비공개" title="친구 피드에 보이지 않아요" className="text-xs">
          🔒
        </span>
      )}
      <span className={color ? "" : "text-muted"}>{name}</span>
    </>
  );

  return (
    <div className="flex items-center gap-2">
      {/* 보관한 카테고리에는 새로 적을 수 없다. 지난 할 일만 이름을 달고 남는다. */}
      {archived ? (
        <span
          className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-semibold"
          style={color ? { color } : undefined}
        >
          {chip}
        </span>
      ) : (
        <button
          type="button"
          aria-label={`${name}에 할 일 쓰기`}
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-surface-hover"
          style={color ? { color } : undefined}
        >
          {chip}
        </button>
      )}

      {count && <span className="text-xs text-muted">{count}</span>}

      <Modal open={open} onClose={() => setOpen(false)} title={name}>
        <form
          ref={formRef}
          action={async (formData: FormData) => {
            await addTodo(formData);
            formRef.current?.reset();
            // 비우기만 하면 커서가 사라진다. 바로 다음 것을 적게 다시 잡아 준다.
            inputRef.current?.focus();
          }}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="categoryId" value={categoryId ?? ""} />
          <input
            ref={inputRef}
            name="content"
            required
            maxLength={200}
            autoFocus
            placeholder="할 일을 적고 Enter"
            aria-label={`${name} 할 일`}
            className="h-12 w-full rounded-xl bg-surface-hover px-4 text-[15px] outline-none placeholder:text-muted focus:ring-2 focus:ring-brand"
            style={{ boxShadow: color ? `inset 3px 0 0 ${color}` : undefined }}
          />
          <p className="text-xs text-muted">
            Enter로 넣고 이어서 적을 수 있어요.
          </p>
        </form>
      </Modal>
    </div>
  );
}
