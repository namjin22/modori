"use client";

import { type ReactNode, useState, useTransition } from "react";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
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

export type SortableItem = { id: string; node: ReactNode };

function Row({ id, node }: SortableItem) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-10 opacity-90" : undefined}
    >
      <div className="flex items-stretch gap-1">
        {/* 손잡이를 따로 둔다. 목록 어디나 잡히면 체크나 수정 버튼을 누를 수 없다. */}
        <button
          type="button"
          aria-label="순서 바꾸기 손잡이"
          className="shrink-0 cursor-grab touch-none rounded-lg px-1 text-muted active:cursor-grabbing"
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
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
