"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * 화면 위에 떠서 열리는 창. 펼침(details)으로 열면 아래 내용이 밀려 화면 비율이
 * 흔들리는데, 이건 원래 화면을 그대로 두고 그 위에만 얹는다.
 *
 * 브라우저가 가진 <dialog>를 쓴다. 포커스 가두기, Esc로 닫기, 뒤쪽 클릭 막기가
 * 이미 들어 있어서 직접 만들면 빠뜨리기 쉬운 것들을 그대로 얻는다.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      // showModal은 첫 버튼(닫기)으로 포커스를 옮긴다. 안쪽 입력칸의 autoFocus는 그보다 먼저
      // 걸려서 빼앗긴다. 창이 열린 뒤에 "처음 잡을 칸"으로 다시 옮기고 커서를 글 끝에 둔다.
      const first = dialog.querySelector<HTMLElement>("[data-autofocus]");
      if (first) {
        first.focus();
        if (first instanceof HTMLInputElement) {
          first.setSelectionRange(first.value.length, first.value.length);
        }
      }
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // 열린 동안 뒤쪽이 따라 움직이면 창이 떠 있는 느낌이 깨진다.
  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      // 뒤쪽을 누르면 닫는다. <dialog> 자신이 곧 배경이라 target으로 가려낸다.
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      // m-auto가 있어야 가운데에 뜬다. Tailwind 기본 설정이 모든 요소의 margin을
      // 0으로 만들어서, <dialog>가 원래 갖고 있는 가운데 정렬이 지워진다.
      className="m-auto max-h-[85vh] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl bg-surface p-5 text-foreground shadow-xl open:animate-[modal-in_160ms_ease-out]"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="truncate text-base font-bold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-hover text-muted"
        >
          ✕
        </button>
      </div>

      {/* 닫혀 있을 때는 안을 그리지 않는다. 그려두면 화면마다 같은 이름표가
          여러 개 남고, 다시 열어도 autoFocus가 다시 걸리지 않는다. */}
      {open && <div className="mt-5 flex flex-col gap-4">{children}</div>}
    </dialog>
  );
}
