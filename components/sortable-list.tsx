"use client";

import { type ReactNode, type TouchEventHandler, useState, useTransition } from "react";

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

import { useSaveFailure } from "@/components/use-save-failure";

export type SortableItem = {
  id: string;
  // 화면 읽기 프로그램이 "무엇을" 옮기는지 말할 때 쓴다.
  label: string;
  node: ReactNode;
  // 서버가 그린 시점에 끝낸 할 일인지. 할 일 판이 체크 직후 줄을 아래로 내릴 때 쓴다(할 일 줄이 아니면 비운다).
  done?: boolean;
};

/**
 * todo: 할 일 줄처럼 바탕 없이 평평하게. 손잡이는 늘 보이되 흐리고, 올리면 또렷해진다.
 * card: 카테고리처럼 줄마다 카드이고 손잡이가 늘 보인다.
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

/** 마우스는 손잡이를 8px 넘게 끌면, 손가락은 줄을 길게 누르면(LONG_PRESS_MS) 집는다. 키보드는 손잡이에서 스페이스. */
export function useRowSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: LONG_PRESS_MS, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const card = variant === "card";
  // 손가락으로 길게 누르는 것은 줄 전체에서, 마우스·키보드는 손잡이에서 받는다.
  const { onTouchStart, ...handleListeners } = listeners ?? {};

  return (
    // 할 일은 투두메이트처럼 줄마다 카드를 두지 않는다. 올리거나 펼쳤을 때만 바탕을 깐다.
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onTouchStart={onTouchStart as TouchEventHandler<HTMLLIElement> | undefined}
      // 길게 누르면 폰이 글자 선택·메뉴를 띄워 집기를 가로챈다. 손가락 화면에서만 막는다.
      onContextMenu={(event) => {
        if (window.matchMedia("(pointer: coarse)").matches) event.preventDefault();
      }}
      className={`group/row transition-colors pointer-coarse:select-none pointer-coarse:[-webkit-touch-callout:none] pointer-coarse:active:bg-surface ${
        card ? "rounded-2xl bg-surface" : "rounded-xl hover:bg-surface has-[details[open]]:bg-surface"
      } ${
        isDragging ? (dragPlaceholder ? "opacity-30" : "relative z-10 scale-[1.02] bg-surface opacity-95 shadow-xl ring-2 ring-brand") : ""
      }`}
    >
      <div className={`flex ${card ? "items-center pl-2" : "items-stretch"}`}>
        {/* 손잡이를 따로 둔다. 목록 어디나 잡히면 체크나 수정 버튼을 누를 수 없다. */}
        <button
          type="button"
          aria-label="순서 바꾸기 손잡이"
          // 마우스를 올려야만 보이면 PC 사용자는 끌 수 있다는 것을 모른다(커서만 바뀐다). 늘 보이되 흐리게 두고, 올리면 또렷해진다.
          title="끌어서 순서 바꾸기"
          // 손가락 화면(pointer-coarse)에서는 손잡이를 없앤다. 줄을 길게 눌러 집는다.
          className={`flex w-6 shrink-0 cursor-grab touch-none justify-center rounded-lg py-2.5 text-muted/60 pointer-coarse:hidden transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:text-foreground active:cursor-grabbing ${
            card ? "" : "self-start"
          }`}
          {...attributes}
          {...handleListeners}
        >
          ⠿
        </button>
        <div className="min-w-0 flex-1">{node}</div>
      </div>
    </li>
  );
}

/**
 * 손잡이로 끌어 순서를 바꾸는 목록. 할 일(components/sortable-todo-list.tsx)과 카테고리가 같이 쓴다.
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
      draggable:
        "스페이스를 눌러 집고, 위아래 방향키로 옮긴 뒤 스페이스로 내려놓으세요. 취소하려면 Esc를 누르세요.",
    },
    announcements: {
      onDragStart: ({ active }: { active: Active }) =>
        `${labelOf(active.id)}을(를) 집었어요. 지금 ${positionOf(active.id)}번째예요.`,
      onDragOver: ({ active, over }: { active: Active; over: Over | null }) =>
        over
          ? `${labelOf(active.id)}을(를) ${positionOf(over.id)}번째 자리로 옮기는 중이에요.`
          : `${labelOf(active.id)}이(가) 목록 밖에 있어요.`,
      onDragEnd: ({ active, over }: { active: Active; over: Over | null }) =>
        over
          ? `${labelOf(active.id)}을(를) ${positionOf(over.id)}번째에 내려놓았어요.`
          : `${labelOf(active.id)}을(를) 내려놓았어요. 순서는 그대로예요.`,
      onDragCancel: ({ active }: { active: Active }) =>
        `옮기기를 취소했어요. ${labelOf(active.id)}은(는) 제자리에 있어요.`,
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
