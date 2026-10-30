"use client";

import { type MouseEventHandler, type ReactNode, type SyntheticEvent, type TouchEventHandler, useState, useTransition } from "react";

import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Active,
  type DragEndEvent,
  type Over,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { useT } from "@/components/locale-provider";
import { useSaveFailure } from "@/components/use-save-failure";
import { todos as todoMessages } from "@/lib/i18n/messages/todos";

export type SortableItem = {
  id: string;
  // 화면 읽기 프로그램이 "무엇을" 옮기는지 말할 때 쓴다.
  label: string;
  node: ReactNode;
  // 서버가 그린 시점에 끝낸 할 일인지. 할 일 판이 체크 직후 줄을 아래로 내릴 때 쓴다(할 일 줄이 아니면 비운다).
  done?: boolean;
};

/**
 * todo: 할 일 줄처럼 바탕 없이 평평하게. 올리거나 펼쳤을 때만 바탕을 깐다.
 * card: 카테고리처럼 줄마다 카드.
 */
export type Variant = "todo" | "card";

/**
 * 끄는 동안 화면 가장자리에 닿으면 저절로 스크롤하는 정도. 기본값(위아래 20%, 빠르게)은 폰에서 할 일 목록이 화면 아래쪽에 있어
 * 끌기 시작하자마자 화면이 내려가 버렸다. 가장자리 8%에서만, 천천히 움직인다.
 */
export const GENTLE_AUTO_SCROLL = { threshold: { x: 0, y: 0.08 }, acceleration: 3 };

/**
 * 손가락으로 이만큼 누르고 있으면 그 줄이 집힌다. 그 전에 움직이면 화면 스크롤이다.
 * 폰에서 작은 손잡이를 잡고 끌면 화면이 같이 스크롤돼 옮기기 어려웠다는 요청으로, 폰에서는 손잡이를 없애고 줄을 길게 눌러 집는다.
 */
export const LONG_PRESS_MS = 400;

/** 손가락으로 집으면 짧게 떨어 잡혔다는 것을 알린다(지원하는 폰에서만). */
export function buzzOnTouchDrag(activator: Event) {
  if (activator.type.startsWith("touch")) navigator.vibrate?.(15);
}

/**
 * 마우스는 줄 아무 데나 누른 채 8px 넘게 움직이면, 손가락은 줄을 길게 누르면(LONG_PRESS_MS) 집는다. 그냥 누르면 원래 누르기(체크·고치기 창)다.
 * 키보드는 Tab으로 오면 나타나는 "순서 바꾸기"에서 스페이스.
 */
export function useRowSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: LONG_PRESS_MS, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

/**
 * 글 적는 칸·고르는 칸에서 누른 것은 글자 선택·입력이라 집지 않는다(카테고리 이름 고치기 칸 등).
 * 줄 안에 든 떠 있는 창(할 일 고치기 창)에서 누른 것도 집지 않는다. 창은 DOM으로는 줄의 자식이라 눌림이 줄까지 올라와,
 * 창 안에서 마우스를 끌면 뒤의 줄이 같이 집혔다(2026-10-22). 줄 자신이 다른 창 안에 있는 경우(줄이 창의 자식)는 해당하지 않는다.
 */
function unlessTyping<E extends SyntheticEvent>(handler: ((event: E) => void) | undefined) {
  if (!handler) return undefined;
  return (event: E) => {
    const target = event.target;
    if (target instanceof Element) {
      if (target.closest("input, textarea, select, [contenteditable='true'], [data-no-drag]")) return;
      const dialog = target.closest("dialog");
      if (dialog && event.currentTarget instanceof Element && event.currentTarget.contains(dialog)) return;
    }
    handler(event);
  };
}

/**
 * 목록 한 줄. 할 일 판(components/todo-board.tsx)도 같이 쓴다.
 * dragPlaceholder를 켜면 끌고 있는 동안 제자리에는 흐린 자리표시만 남긴다(끌고 다니는 모습은 DragOverlay가 그린다).
 */
export function SortableRow({
  id,
  node,
  variant,
  dragPlaceholder = false,
}: Omit<SortableItem, "label"> & { variant: Variant; dragPlaceholder?: boolean }) {
  const t = useT(todoMessages);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const card = variant === "card";
  // 마우스·손가락은 줄 전체에서, 키보드는 Tab으로 오면 보이는 버튼에서 받는다.
  const { onTouchStart, onMouseDown, ...keyListeners } = listeners ?? {};

  return (
    // 할 일은 투두메이트처럼 줄마다 카드를 두지 않는다. 올리거나 펼쳤을 때만 바탕을 깐다.
    <li
      ref={setNodeRef}
      data-row-id={id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onMouseDown={unlessTyping(onMouseDown as MouseEventHandler<HTMLLIElement> | undefined)}
      onTouchStart={unlessTyping(onTouchStart as TouchEventHandler<HTMLLIElement> | undefined)}
      // 길게 누르면 폰이 글자 선택·메뉴를 띄워 집기를 가로챈다. 손가락 화면에서만 막는다.
      onContextMenu={(event) => {
        if (window.matchMedia("(pointer: coarse)").matches) event.preventDefault();
      }}
      // 마우스 화면에서는 손 모양 커서로 잡을 수 있다는 것을 알린다(손잡이를 없앴다, 2026-10-14 요청).
      className={`group/row transition-colors pointer-fine:cursor-grab pointer-coarse:select-none pointer-coarse:[-webkit-touch-callout:none] pointer-coarse:active:bg-surface ${
        // 할 일 줄은 좌우로 12px 넓혀 바탕·테두리가 양쪽에 같은 여백으로 둘린다. 손잡이를 없앤 뒤 왼쪽만 붙어 보였다(2026-10-15 요청).
        // 넓힌 만큼 안쪽 여백을 줘서 체크 네모는 카테고리 이름표와 같은 세로줄에 남는다.
        card ? "rounded-2xl bg-surface" : "-mx-3 rounded-xl px-3 hover:bg-surface has-[details[open]]:bg-surface"
      } ${
        isDragging ? (dragPlaceholder ? "opacity-30" : "relative z-10 scale-[1.02] bg-surface opacity-95 shadow-xl ring-2 ring-brand") : ""
      }`}
    >
      <div className={`relative flex ${card ? "items-center" : "items-stretch"}`}>
        {/* 손잡이는 없앴다. 줄 아무 데나 잡고 끈다(2026-10-14 요청). 키보드 사용자는 끌 수 없으니 Tab으로 왔을 때만 이 버튼이
            나타나고, 스페이스·방향키로 옮긴다(화면 읽기 안내도 이 버튼에 붙는다). 손가락 화면에는 키보드가 없어 두지 않는다. */}
        <button
          type="button"
          aria-label={t("handleLabel")}
          // 여백·바탕은 보일 때만 준다. 평소에 여백이 있으면 화면 읽기 전용 크기(1px)보다 커져 화면에 조각이 남는다.
          className="sr-only z-10 rounded-lg text-xs text-foreground focus-visible:not-sr-only focus-visible:absolute focus-visible:left-0 focus-visible:top-1/2 focus-visible:-translate-y-1/2 focus-visible:bg-surface focus-visible:px-2 focus-visible:py-1 focus-visible:shadow pointer-coarse:hidden"
          {...attributes}
          {...keyListeners}
        >
          {t("handleText")}
        </button>
        <div className="min-w-0 flex-1">{node}</div>
      </div>
    </li>
  );
}

/**
 * 줄을 잡고 끌어 순서를 바꾸는 목록. 할 일(components/sortable-todo-list.tsx)과 카테고리가 같이 쓴다.
 * 순서를 바꾸면 바로 보여 주고, save가 실패하면 서버 순서로 되돌린다.
 */
export function SortableList({
  items,
  save,
  noun,
  variant = "todo",
  gap = "",
}: {
  // 줄 사이 간격 클래스(예: "gap-2"). card 모양은 기본 간격이 있고, todo 모양은 줄을 붙여 둔다.
  gap?: string;
  items: SortableItem[];
  save: (ids: string[]) => Promise<void>;
  // 화면 읽기 안내에서 이름을 모를 때 부르는 말.
  noun: string;
  variant?: Variant;
}) {
  const t = useT(todoMessages);
  const ids = items.map((item) => item.id);
  const key = ids.join(",");

  const [order, setOrder] = useState(ids);
  const [serverKey, setServerKey] = useState(key);
  const [isSaving, startTransition] = useTransition();
  const saveFailed = useSaveFailure();

  // 서버에서 새 목록이 오면(추가·삭제·날짜 이동) 그것을 따른다.
  // effect가 아니라 렌더 중에 맞춘다. 한 박자 늦게 그려지지 않는다.
  if (serverKey !== key) {
    setServerKey(key);
    setOrder(ids);
  }

  const sensors = useRowSensors();

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from < 0 || to < 0) return;

    const next = arrayMove(order, from, to);
    setOrder(next);
    startTransition(async () => {
      try {
        await save(next);
      } catch (error) {
        // 저장되지 않은 순서를 그대로 두면 새로 고칠 때 순서가 튄다. 서버 순서로 되돌린다.
        setOrder(ids);
        saveFailed(error);
      }
    });
  }

  const byId = new Map(items.map((item) => [item.id, item.node]));
  const labelOf = (id: UniqueIdentifier) =>
    items.find((item) => item.id === id)?.label ?? noun;
  const positionOf = (id: UniqueIdentifier) => order.indexOf(String(id)) + 1;

  // dnd-kit의 기본 안내는 영어다. 화살표 버튼을 없앤 뒤로는 키보드 사용자가
  // 이 안내에 기대어 순서를 바꾸므로, 무엇을 몇 번째로 옮겼는지 우리말로 알려준다.
  const accessibility = {
    screenReaderInstructions: {
      draggable: t("listInstructions"),
    },
    announcements: {
      onDragStart: ({ active }: { active: Active }) =>
        t("dragStartInList", { item: labelOf(active.id), position: positionOf(active.id) }),
      onDragOver: ({ active, over }: { active: Active; over: Over | null }) =>
        over
          ? t("dragOverPosition", { item: labelOf(active.id), position: positionOf(over.id) })
          : t("dragOutside", { item: labelOf(active.id) }),
      onDragEnd: ({ active, over }: { active: Active; over: Over | null }) =>
        over
          ? t("dragEndAt", { item: labelOf(active.id), position: positionOf(over.id) })
          : t("dragEndSame", { item: labelOf(active.id) }),
      onDragCancel: ({ active }: { active: Active }) =>
        t("dragCancel", { item: labelOf(active.id) }),
    },
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      autoScroll={GENTLE_AUTO_SCROLL}
      onDragStart={(event) => buzzOnTouchDrag(event.activatorEvent)}
      onDragEnd={handleDragEnd}
      accessibility={accessibility}
    >
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        {/* 저장이 끝났는지 화면 밖에서도 알 수 있어야 한다.
            드래그 직후 새로고침하면 요청이 끊기기 때문이다. */}
        <ul className={`flex flex-col ${gap || (variant === "card" ? "gap-3" : "")}`} aria-busy={isSaving}>
          {order.map((id) => (
            <SortableRow key={id} id={id} node={byId.get(id)} variant={variant} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
