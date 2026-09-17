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
    // 카드는 여기서 그린다. 손잡이를 카드 밖에 두면 여백에 떠 있는 것처럼 보인다.
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-2xl bg-surface transition-colors ${
        isDragging ? "relative z-10 opacity-90 shadow-lg" : ""
      }`}
    >
      <div className="flex items-stretch">
        {/* 손잡이를 따로 둔다. 목록 어디나 잡히면 체크나 수정 버튼을 누를 수 없다. */}
        <button
          type="button"
          aria-label="순서 바꾸기 손잡이"
          className="shrink-0 cursor-grab touch-none self-start px-2 py-3 text-muted active:cursor-grabbing"
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
    startTransition(() => reorderTodos(date, next));
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
        <ul className="flex flex-col gap-2" aria-busy={isSaving}>
          {order.map((id) => (
            <Row key={id} id={id} node={byId.get(id)} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
