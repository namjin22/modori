"use client";

import { useRef, useState } from "react";

import { addTodo } from "@/app/(tabs)/actions";

/**
 * 카테고리 칩과 그 옆의 +. 누르면 칩 바로 아래에 입력칸이 열리고,
 * 적고 Enter를 누르면 그 카테고리로 들어간 뒤 입력칸이 비워진 채 열려 있다.
 * 투두메이트처럼 여러 개를 연달아 적기 좋게 한다. Esc로 닫는다.
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          className={`flex items-center gap-1.5 rounded-full bg-surface py-1 pl-3 text-sm font-semibold ${archived ? "pr-3" : "pr-1"}`}
          style={color ? { color } : undefined}
        >
          {!isPublic && (
            <span aria-label="비공개" title="친구 피드에 보이지 않아요" className="text-xs">
              🔒
            </span>
          )}
          <span className={color ? "" : "text-muted"}>{name}</span>
          {/* 보관한 카테고리에는 새로 적을 수 없다. 지난 할 일만 이름을 달고 남는다. */}
          {!archived && (
            <button
              type="button"
              // 이름에 "추가"를 넣지 않는다. 카테고리 만들기의 "추가" 버튼과 섞인다.
              aria-label={`${name}에 할 일 쓰기`}
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
              className={`flex size-6 items-center justify-center rounded-full text-base leading-none transition-transform ${
                open ? "rotate-45 bg-foreground text-background" : "bg-surface-hover text-foreground"
              }`}
            >
              +
            </button>
          )}
        </span>
        {count && <span className="text-xs text-muted">{count}</span>}
      </div>

      {open && (
        <form
          ref={formRef}
          action={async (formData: FormData) => {
            await addTodo(formData);
            formRef.current?.reset();
          }}
          className="flex items-center gap-2 border-b-2 pb-1 pl-1"
          style={{ borderColor: color ?? "var(--color-border)" }}
        >
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="categoryId" value={categoryId ?? ""} />
          <input
            name="content"
            required
            maxLength={200}
            autoFocus
            placeholder="할 일 입력 후 Enter"
            aria-label={`${name} 할 일`}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
            }}
            // 열려 있는 동안 색 밑줄이 포커스를 보여주므로 전역 포커스 테두리는 겹치지 않게 뺀다.
            className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted focus-visible:outline-none"
          />
          <button
            type="submit"
            aria-label="넣기"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-contrast"
          >
            ↵
          </button>
        </form>
      )}
    </div>
  );
}
