"use client";

import { type ReactNode, useState, useTransition } from "react";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
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

import { reorderTodos } from "@/app/(tabs)/actions";
import { useSaveFailure } from "@/components/use-save-failure";

export type SortableItem = {
  id: string;
  // 화면 읽기 프로그램이 "무엇을" 옮기는지 말할 때 쓴다.
  label: string;
  node: ReactNode;
};

function Row({ id, node }: Omit<SortableItem, "label">) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    // 투두메이트처럼 줄마다 카드를 두지 않는다. 올리거나 펼쳤을 때만 바탕을 깐다.
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group/row rounded-xl transition-colors hover:bg-surface has-[details[open]]:bg-surface ${
        isDragging ? "relative z-10 bg-surface opacity-90 shadow-lg" : ""
      }`}
    >
      <div className="flex items-stretch">
        {/* 손잡이를 따로 둔다. 목록 어디나 잡히면 체크나 수정 버튼을 누를 수 없다. */}
        <button
          type="button"
          aria-label="순서 바꾸기 손잡이"
          // 넓은 화면에서는 마우스를 올렸을 때만 드러낸다. 손가락에는 올림이 없으니 늘 보인다.
          className="flex w-6 shrink-0 cursor-grab touch-none justify-center self-start py-2.5 text-muted/60 active:cursor-grabbing lg:opacity-0 lg:group-hover/row:opacity-100 lg:focus-visible:opacity-100"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <div className="min-w-0 flex-1">{node}</div>
      </div>
    </li>
  );
}

export function SortableTodoList({
  date,
  items,
}: {
  date: string;
  items: SortableItem[];
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

  const sensors = useSensors(
    // 살짝 눌렀다 떼는 것은 클릭으로 둔다. 8px 넘게 끌어야 드래그로 본다.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
        await reorderTodos(date, next);
      } catch (error) {
        // 저장되지 않은 순서를 그대로 두면 새로 고칠 때 순서가 튄다. 서버 순서로 되돌린다.
        setOrder(ids);
        saveFailed(error);
      }
    });
  }

  const byId = new Map(items.map((item) => [item.id, item.node]));
  const labelOf = (id: UniqueIdentifier) =>
    items.find((item) => item.id === id)?.label ?? "할 일";
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
      onDragEnd={handleDragEnd}
      accessibility={accessibility}
    >
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        {/* 저장이 끝났는지 화면 밖에서도 알 수 있어야 한다.
            드래그 직후 새로고침하면 요청이 끊기기 때문이다. */}
        <ul className="flex flex-col" aria-busy={isSaving}>
          {order.map((id) => (
            <Row key={id} id={id} node={byId.get(id)} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
