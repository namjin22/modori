"use client";

import { useRef, useState, useTransition } from "react";

import { addTodo } from "@/app/(tabs)/actions";
import { useToast } from "@/components/toast";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();
  const saveFailed = useSaveFailure();
  const toast = useToast();

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
          // 보내는 순간 입력칸을 비운다. 저장이 끝난 뒤에 비우면 두 가지가 깨졌다.
          // Enter를 빠르게 두 번 누르면 같은 할 일이 두 개 생기고, 저장되는 동안 다음 것을
          // 적어 두면 그 글자까지 지워졌다. 비운 칸은 required라 두 번째 Enter는 보내지지 않는다.
          // form action을 쓰지 않는 것은 React가 실패해도 칸을 비우기 때문이다.
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const text = String(formData.get("content") ?? "");
            const input = inputRef.current;
            if (input) input.value = "";

            // 실패하면 적었던 글자를 되돌린다. 그사이 다음 것을 적고 있었으면 덮지 않는다.
            const restore = () => {
              if (input && input.value === "") input.value = text;
            };

            startTransition(async () => {
              try {
                const result = await addTodo(formData);
                // 거절되면(하루 상한 등) 이유만 알린다.
                if (!result.ok) {
                  restore();
                  toast({ message: result.message });
                }
              } catch (error) {
                restore();
                saveFailed(error);
              }
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
