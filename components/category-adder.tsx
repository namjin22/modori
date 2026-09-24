"use client";

import { useRef, useState, useTransition } from "react";

import { addTodo } from "@/app/(tabs)/actions";
import { useSaveFailure } from "@/components/use-save-failure";
import { onColorText } from "@/lib/colors";

/**
 * 카테고리 칩. 이름을 누르면 칩 바로 아래에 입력칸이 열린다.
 * 적고 Enter를 누르면 입력칸이 비워진 채 열려 있어서 여러 개를 연달아 적는다.
 * Esc로 닫는다.
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
  const [, startTransition] = useTransition();
  const saveFailed = useSaveFailure();

  const chip = (
    <>
      {!isPublic && (
        <span aria-label="비공개" title="친구 피드에 보이지 않아요" className="text-xs">
          🔒
        </span>
      )}
      <span>{name}</span>
    </>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {/* 보관한 카테고리에는 새로 적을 수 없다. 지난 할 일만 이름을 달고 남는다. */}
        {archived ? (
          <span
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${
              color ? "color-edge" : "bg-surface text-muted"
            }`}
            style={color ? chipStyle(color) : undefined}
          >
            {chip}
          </span>
        ) : (
          <button
            type="button"
            aria-label={`${name}에 할 일 쓰기`}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-opacity ${
              color ? "color-edge hover:opacity-80" : "bg-surface text-muted hover:bg-surface-hover"
            } ${open ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""}`}
            style={color ? chipStyle(color) : undefined}
          >
            {chip}
          </button>
        )}

        {count && <span className="text-xs text-muted">{count}</span>}
      </div>

      {open && (
        <form
          ref={formRef}
          // form action을 쓰지 않는다. React는 action이 실패해도 입력칸을 비워서,
          // 연결이 끊기면 적던 글자가 사라진다. 성공했을 때만 직접 비운다.
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              try {
                await addTodo(formData);
                formRef.current?.reset();
              } catch (error) {
                saveFailed(error);
              }
              // 비우기만 하면 커서가 사라진다. 바로 다음 것을 적게 다시 잡아 준다.
              inputRef.current?.focus();
            });
          }}
          className="flex items-center gap-2 border-b-2 pb-1 pl-1"
          style={{ borderColor: color ?? "var(--color-border)" }}
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
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
            }}
            // 색 밑줄이 포커스를 보여주므로 전역 포커스 테두리는 겹치지 않게 뺀다.
            className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted focus-visible:outline-none"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="닫기"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm text-muted hover:bg-surface-hover"
          >
            ✕
          </button>
        </form>
      )}
    </div>
  );
}

/** 색을 배경으로 쓰고 글씨는 대비가 큰 쪽으로 고른다. 흰색·검정도 읽힌다. */
function chipStyle(color: string) {
  return { backgroundColor: color, color: onColorText(color) };
}
