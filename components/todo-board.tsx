"use client";

import { type ReactNode, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type Active,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Over,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { moveTodoToCategory, reorderTodos } from "@/app/(tabs)/actions";
import { SortableRow, type SortableItem } from "@/components/sortable-list";
import { useSaveFailure } from "@/components/use-save-failure";

export type BoardGroup = {
  key: string;
  // 카테고리 없음 묶음은 null.
  categoryId: string | null;
  // 묶음 이름. 화면 읽기 안내에서 "어느 카테고리로 옮겼는지" 말할 때 쓴다.
  label: string;
  // 보관한 카테고리 묶음에는 새로 옮겨 넣을 수 없다.
  droppable: boolean;
  // 카테고리 이름 줄(서버에서 그린 CategoryAdder).
  header: ReactNode;
  items: SortableItem[];
};

// 할 일 id와 겹치지 않게 묶음 id에는 접두사를 붙인다.
const containerId = (key: string) => `group:${key}`;

/**
 * 그날의 할 일 판. 손잡이를 끌어 같은 묶음 안에서 순서를 바꾸고, 다른 카테고리 묶음으로 옮길 수도 있다.
 * 옮기면 바로 그 묶음에 들어가 보이고, 저장이 실패하면 끌기 전 모양으로 되돌린다.
 */
export function TodoBoard({ date, groups }: { date: string; groups: BoardGroup[] }) {
  const initial = Object.fromEntries(
    groups.map((group) => [containerId(group.key), group.items.map((item) => item.id)]),
  );
  const serverKey = groups
    .map((group) => `${group.key}:${group.items.map((item) => item.id).join(",")}`)
    .join("|");

  const [layout, setLayout] = useState<Record<string, string[]>>(initial);
  const [syncedKey, setSyncedKey] = useState(serverKey);
  const [activeId, setActiveId] = useState<string | null>(null);
  // 저장이 끝났는지 화면 밖에서도 알 수 있어야 한다. 드래그 직후 새로고침하면 요청이 끊기기 때문이다.
  const [saving, setSaving] = useState(false);
  // 끌기를 시작할 때의 모양. 저장이 실패하거나 취소하면 이 모양으로 돌린다.
  const startLayout = useRef<Record<string, string[]>>(initial);
  const startContainer = useRef<string | null>(null);
  const saveFailed = useSaveFailure();

  // 서버에서 새 목록이 오면(추가·삭제·날짜 이동·저장 끝) 그것을 따른다. 렌더 중에 맞춰 한 박자 늦지 않게 한다.
  if (syncedKey !== serverKey) {
    setSyncedKey(serverKey);
    setLayout(initial);
  }

  const items = new Map(groups.flatMap((group) => group.items.map((item) => [item.id, item] as const)));
  const groupById = new Map(groups.map((group) => [containerId(group.key), group]));

  // 할 일 줄 위에서는 가장 가까운 줄로 자리를 잡는다(같은 카테고리 안 순서 바꾸기와 같다). 할 일이 하나도 없는 카테고리 칸은
  // 줄이 없어 잡을 곳이 없으니, 끌고 있는 것이 그 칸과 겹치면 그 칸을 고른다.
  const collisionDetection: CollisionDetection = (args) => {
    const emptyKeys = new Set(Object.keys(layout).filter((key) => layout[key].length === 0));
    const emptyHits = rectIntersection({
      ...args,
      droppableContainers: args.droppableContainers.filter((container) => emptyKeys.has(String(container.id))),
    });
    if (emptyHits.length > 0) return emptyHits;
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((container) => !(String(container.id) in layout)),
    });
  };

  const sensors = useSensors(
    // 살짝 눌렀다 떼는 것은 클릭으로 둔다. 8px 넘게 끌어야 드래그로 본다.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function containerOf(id: string | number, from: Record<string, string[]> = layout): string | undefined {
    const text = String(id);
    if (text in from) return text;
    return Object.keys(from).find((key) => from[key].includes(text));
  }

  function handleDragStart(event: DragStartEvent) {
    startLayout.current = layout;
    startContainer.current = containerOf(event.active.id) ?? null;
    setActiveId(String(event.active.id));
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const from = containerOf(active.id);
    const to = containerOf(over.id);
    if (!from || !to || from === to) return;
    if (!groupById.get(to)?.droppable) return;

    setLayout((current) => {
      const target = current[to];
      const overIsContainer = String(over.id) in current;
      let index = target.length;
      if (!overIsContainer) {
        const translated = active.rect.current.translated;
        const below = translated ? translated.top > over.rect.top + over.rect.height / 2 : false;
        index = target.indexOf(String(over.id)) + (below ? 1 : 0);
      }
      return {
        ...current,
        [from]: current[from].filter((id) => id !== String(active.id)),
        [to]: [...target.slice(0, index), String(active.id), ...target.slice(index)],
      };
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const id = String(active.id);
    const current = containerOf(id);
    if (!current) return;

    // 같은 묶음 안에서 끝났으면 놓은 자리로 순서를 맞춘다.
    let next = layout;
    if (over && over.id !== active.id && containerOf(over.id) === current && !(String(over.id) in layout)) {
      const from = layout[current].indexOf(id);
      const to = layout[current].indexOf(String(over.id));
      if (from >= 0 && to >= 0 && from !== to) next = { ...layout, [current]: arrayMove(layout[current], from, to) };
    }
    setLayout(next);

    const origin = startContainer.current;
    const before = startLayout.current;
    const group = groupById.get(current);
    if (!group || !origin) return;

    const changedGroup = origin !== current;
    const changedOrder = next[current].join(",") !== (before[current] ?? []).join(",");
    if (!changedGroup && !changedOrder) return;

    setSaving(true);
    (async () => {
      try {
        if (changedGroup) await moveTodoToCategory(date, id, group.categoryId, next[current]);
        else await reorderTodos(date, next[current]);
      } catch (error) {
        // 저장되지 않은 모양을 그대로 두면 새로 고칠 때 튄다. 끌기 전 모양으로 되돌린다.
        setLayout(before);
        saveFailed(error);
      } finally {
        setSaving(false);
      }
    })();
  }

  function handleDragCancel() {
    setActiveId(null);
    setLayout(startLayout.current);
  }

  const labelOf = (id: string | number) => items.get(String(id))?.label ?? "할 일";
  const groupLabelOf = (id: string | number) => {
    const container = containerOf(id);
    return container ? (groupById.get(container)?.label ?? "카테고리") : "카테고리";
  };
  const positionOf = (id: string | number) => {
    const container = containerOf(id);
    return container ? layout[container].indexOf(String(id)) + 1 : 0;
  };

  // dnd-kit의 기본 안내는 영어다. 키보드 사용자가 기대어 옮기므로 무엇을 어느 카테고리 몇 번째로 옮겼는지 우리말로 알린다.
  const accessibility = {
    screenReaderInstructions: {
      draggable:
        "스페이스를 눌러 집고, 방향키로 옮긴 뒤 스페이스로 내려놓으세요. 다른 카테고리 칸으로도 옮길 수 있어요. 취소하려면 Esc를 누르세요.",
    },
    announcements: {
      onDragStart: ({ active }: { active: Active }) =>
        `${labelOf(active.id)}을(를) 집었어요. ${groupLabelOf(active.id)}의 ${positionOf(active.id)}번째예요.`,
      onDragOver: ({ active, over }: { active: Active; over: Over | null }) => {
        if (!over) return `${labelOf(active.id)}이(가) 목록 밖에 있어요.`;
        // 같은 카테고리 안에서는 몇 번째 자리인지, 다른 카테고리 칸으로 넘어가면 어느 카테고리인지 알린다.
        const sameGroup = containerOf(over.id) === containerOf(active.id) && !(String(over.id) in layout);
        return sameGroup
          ? `${labelOf(active.id)}을(를) ${positionOf(over.id)}번째 자리로 옮기는 중이에요.`
          : `${labelOf(active.id)}을(를) ${groupLabelOf(over.id)}로 옮기는 중이에요.`;
      },
      onDragEnd: ({ active, over }: { active: Active; over: Over | null }) => {
        // 같은 카테고리 안에서는 놓은 줄의 자리가 곧 새 자리다(순서는 이 안내 뒤에 반영된다).
        const sameGroup = over && containerOf(over.id) === containerOf(active.id) && !(String(over.id) in layout);
        const position = sameGroup ? positionOf(over.id) : positionOf(active.id);
        return `${labelOf(active.id)}을(를) ${groupLabelOf(active.id)}의 ${position}번째에 내려놓았어요.`;
      },
      onDragCancel: ({ active }: { active: Active }) =>
        `옮기기를 취소했어요. ${labelOf(active.id)}은(는) 제자리에 있어요.`,
    },
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={accessibility}
    >
      {groups.map((group) => (
        <BoardSection
          key={group.key}
          group={group}
          ids={layout[containerId(group.key)] ?? []}
          items={items}
          dragging={activeId !== null}
          saving={saving}
        />
      ))}
      {/* 위쪽 화면 틀이 위치 기준을 바꿔서, 안에 그리면 끌고 다니는 그림이 원래 자리보다 어긋나 보인다. body에 그린다. */}
      {typeof document !== "undefined" &&
        createPortal(
          <DragOverlay>
            {activeId ? <div className="rounded-xl bg-surface shadow-lg">{items.get(activeId)?.node}</div> : null}
          </DragOverlay>,
          document.body,
        )}
    </DndContext>
  );
}

function BoardSection({
  group,
  ids,
  items,
  dragging,
  saving,
}: {
  group: BoardGroup;
  ids: string[];
  items: Map<string, SortableItem>;
  dragging: boolean;
  saving: boolean;
}) {
  const id = containerId(group.key);
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !group.droppable });
  const empty = ids.length === 0;
  const hidden = empty && !(dragging && group.droppable);
  const emptyLook = `min-h-10 rounded-xl border border-dashed ${isOver ? "border-brand bg-brand-subtle" : "border-border"}`;

  return (
    <section className="flex flex-col gap-1">
      {group.header}
      <SortableContext id={id} items={ids} strategy={verticalListSortingStrategy}>
        {/* 끌고 있는 동안에는 빈 카테고리도 놓을 자리를 보인다. 평소에는 빈 묶음이 자리를 차지하지 않는다. */}
        <ul
          ref={setNodeRef}
          aria-busy={empty ? undefined : saving}
          className={`flex flex-col ${hidden ? "hidden" : ""} ${empty ? emptyLook : ""}`}
        >
          {ids.map((todoId) => {
            const item = items.get(todoId);
            return item ? (
              <SortableRow key={todoId} id={todoId} node={item.node} variant="todo" dragPlaceholder />
            ) : null;
          })}
        </ul>
      </SortableContext>
    </section>
  );
}
