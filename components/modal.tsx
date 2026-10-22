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
      // 창 안에 또 창(날짜 고르기 등)이 있으면 안쪽 창의 close가 React 트리를 타고 올라와 바깥 창까지 닫는다.
      // 이 창이 직접 닫힌 경우만 받는다.
      onClose={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      // 뒤쪽을 누르면 닫는다. <dialog> 자신이 곧 배경이라 target으로 가려낸다.
      onClick={(event) => {
        const dialog = ref.current;
        if (event.target !== dialog || !dialog) return;
        // 창 안쪽 여백(p-5)을 눌러도 target이 dialog 자신이다. 좌표가 창 밖일 때만 배경으로 본다(안 그러면 쓰던 글이 사라진다).
        const box = dialog.getBoundingClientRect();
        const inside =
          event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
        if (!inside) onClose();
      }}
      // cursor-auto: 창이 할 일 줄 안쪽에 있어서(components/todo-row.tsx) 줄의 손 모양 커서(grab)를 창 전체와 창 뒤 어두운 곳까지 물려받았다
      // (2026-10-22 제보). 창은 늘 기본 커서로 시작한다.
      // 위아래 가운데에 뜬다(2026-10-21: 위쪽에 붙였더니 화면 한가운데가 아니라 어색하다는 제보로 되돌렸다).
      // 창 자체는 스크롤하지 않고(둥근 모서리를 스크롤바가 덮지 않게) 안쪽 칸이 스크롤한다. 그 칸은 스크롤바 자리를 늘 비워 두어
      // 내용이 길어져 스크롤바가 생겨도 안쪽 폭이 그대로다(scroll-stable). m-auto가 있어야 가운데에 뜬다:
      // Tailwind 기본 설정이 모든 요소의 margin을 0으로 만들어 <dialog>의 원래 가운데 정렬이 지워진다.
      // 안쪽 칸은 창과 같은 최대 높이를 직접 갖는다. 예전에는 flex(flex-1, min-h-0)로 창 높이에 맞췄는데, Mac Safari 26에서 높이가
      // 0으로 계산돼 창이 제목 줄만 남고 접혔다(2026-10-21 제보: 반응 보내기). 엔진마다 다른 계산에 기대지 않는다.
      className="m-auto max-h-[85dvh] w-[min(26rem,calc(100vw-2rem))] overflow-hidden cursor-auto rounded-3xl bg-surface p-0 text-foreground shadow-xl open:animate-[modal-in_160ms_ease-out]"
    >
      <div className="scroll-stable max-h-[85dvh] overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
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
      </div>
    </dialog>
  );
}
