"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";

import { resizeEvent } from "@/app/(tabs)/events/actions";
import { useToast } from "@/components/toast";
import { useSaveFailure } from "@/components/use-save-failure";
import { dragRange } from "@/lib/event-drag";

type Drag = {
  id: string;
  start: string;
  end: string;
  // 누른 칸. 이 칸을 벗어나야 끌기로 본다. 벗어나지 않으면 그냥 누른 것(그날로 이동)이다.
  origin: string;
  moved: boolean;
  // 손을 뗄 때 쓸 마지막 기간. 화면 상태(preview)는 다시 그려진 뒤에야 바뀌어서 따로 든다.
  range: { start: string; end: string } | null;
};

type Range = { id: string; start: string; end: string };

/**
 * 한 달 달력의 날짜 칸들을 감싸, 일정 이름을 끌어 다른 날에 놓으면 기간을 바꾼다.
 * 28일에 하루짜리로 잘못 만든 일정을 30일로 끌면 28~30일이 된다(lib/event-drag.ts).
 *
 * 칸과 이름표는 서버가 그린다. 여기서는 data-date(칸)와 data-event-*(이름표)만 보고,
 * 끄는 동안 바뀔 기간의 칸에 data-drag-range를 붙여 칠한다.
 * 마우스와 손가락 둘 다 포인터 이벤트로 받는다. 키보드로는 일정 창에서 날짜를 고친다.
 */
export function EventDragGrid({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const [preview, setPreview] = useState<Range | null>(null);
  const [, startTransition] = useTransition();
  const toast = useToast();
  const saveFailed = useSaveFailure();

  useEffect(() => {
    const grid = ref.current;
    if (!grid) return;
    for (const cell of grid.querySelectorAll<HTMLElement>("[data-date]")) {
      const day = cell.dataset.date ?? "";
      const inside = preview !== null && day >= preview.start && day <= preview.end;
      cell.toggleAttribute("data-drag-range", inside);
    }
  }, [preview]);

  function dayAt(x: number, y: number): string | null {
    const cell = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-date]");
    return cell && ref.current?.contains(cell) ? (cell.dataset.date ?? null) : null;
  }

  function finish() {
    drag.current = null;
    setPreview(null);
  }

  return (
    <div
      ref={ref}
      className={className}
      // 링크는 원래 끌면 주소가 끌려 나간다. 일정 끌기와 겹치지 않게 막는다.
      onDragStart={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const chip = (event.target as Element).closest<HTMLElement>("[data-event-id]");
        const origin = chip?.closest<HTMLElement>("[data-date]")?.dataset.date;
        if (!chip || !origin) return;
        drag.current = {
          id: chip.dataset.eventId ?? "",
          start: chip.dataset.eventStart ?? origin,
          end: chip.dataset.eventEnd ?? origin,
          origin,
          moved: false,
          range: null,
        };
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current) return;
        const day = dayAt(event.clientX, event.clientY);
        if (!day) return;
        if (!current.moved && day !== current.origin) {
          current.moved = true;
          // 다른 칸으로 옮긴 뒤부터 붙잡는다. 누르자마자 붙잡으면 그냥 누른 것도 날짜 링크에 닿지 않는다.
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        if (!current.moved) return;
        current.range = dragRange(current.start, current.end, day);
        setPreview({ id: current.id, ...current.range });
      }}
      onPointerUp={() => {
        const current = drag.current;
        finish();
        if (!current?.moved || !current.range) return;
        const next = { id: current.id, ...current.range };
        // 끌고 놓은 칸의 링크가 눌리지 않게 바로 다음 클릭 한 번을 막는다.
        suppressClick.current = true;
        if (next.start === current.start && next.end === current.end) return;

        startTransition(async () => {
          try {
            const message = await resizeEvent(next.id, next.start, next.end);
            if (message) toast({ message });
          } catch (error) {
            saveFailed(error);
          }
        });
      }}
      onPointerCancel={finish}
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {children}
    </div>
  );
}
