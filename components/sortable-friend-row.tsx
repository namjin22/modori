"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  DndContext,
  closestCenter,
  type Active,
  type DragEndEvent,
  type Over,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { reorderFriends } from "@/app/(tabs)/feed/actions";
import { Avatar } from "@/components/avatar";
import { useT } from "@/components/locale-provider";
import { buzzOnTouchDrag, useRowSensors } from "@/components/sortable-list";
import { useSaveFailure } from "@/components/use-save-failure";
import { social } from "@/lib/i18n/messages/social";

export type FriendItem = { id: string; nickname: string; avatar: string | null };

/** 끄는 동안 줄의 왼쪽·오른쪽 끝에 닿으면 저절로 넘어간다. 위아래는 쓰지 않는다(화면이 같이 내려가면 안 된다). */
const ROW_AUTO_SCROLL = { threshold: { x: 0.12, y: 0 }, acceleration: 3 };

/**
 * 소셜 위쪽 친구 줄. 얼굴을 누르면 그 친구 화면으로 가고, 줄 아무 데나 잡고 끌면(폰은 길게 눌러) 순서가 바뀐다(2026-10-26 요청).
 * 할 일 줄(components/sortable-list.tsx)과 같은 방식이다: 마우스는 8px 넘게 끌면, 손가락은 길게 누르면 집고, 그냥 누르면 링크다.
 * 키보드는 Tab으로 오면 보이는 "순서 바꾸기" 버튼에서 스페이스. 바꾼 순서는 바로 보여 주고, 저장이 실패하면 서버 순서로 되돌린다.
 */
export function SortableFriendRow({ friends, moreCount }: { friends: FriendItem[]; moreCount: number }) {
  const t = useT(social);
  const ids = friends.map((friend) => friend.id);
  const key = ids.join(",");
  const [order, setOrder] = useState(ids);
  const [serverKey, setServerKey] = useState(key);
  const [isSaving, startTransition] = useTransition();
  const saveFailed = useSaveFailure();
  const sensors = useRowSensors();
  const list = useRef<HTMLUListElement>(null);
  // 방금 끌어서 놓은 얼굴(id)과 그 클릭을 막을 시각. 다른 얼굴을 누르는 것은 막지 않는다.
  const suppressClick = useRef({ id: "", until: 0 });

  // 마우스로 끌어 놓으면 브라우저가 놓은 자리의 링크를 눌린 것으로 쳐서 친구 화면으로 넘어간다. dnd-kit은 클릭의 전파만 막고(document 캡처),
  // 링크의 기본 동작(이동)은 막지 않는다. 할 일 줄은 링크가 아니라 버튼이라 이 일이 없었다. window 캡처는 dnd-kit보다 먼저 받으므로 여기서 막는다.
  useEffect(() => {
    function stop(event: MouseEvent) {
      const { id, until } = suppressClick.current;
      if (performance.now() >= until || !(event.target instanceof Element) || !list.current?.contains(event.target)) return;
      if (event.target.closest("[data-friend-id]")?.getAttribute("data-friend-id") === id) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    window.addEventListener("click", stop, true);
    return () => window.removeEventListener("click", stop, true);
  }, []);

  // 서버에서 새 줄이 오면(팔로우·언팔로우) 그것을 따른다. 렌더 중에 맞춰 한 박자 늦게 그려지지 않는다.
  if (serverKey !== key) {
    setServerKey(key);
    setOrder(ids);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    suppressClick.current = { id: String(active.id), until: performance.now() + 300 };
    if (!over || active.id === over.id) return;
    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from < 0 || to < 0) return;

    const next = arrayMove(order, from, to);
    setOrder(next);
    startTransition(async () => {
      try {
        await reorderFriends(next);
      } catch (error) {
        // 저장되지 않은 순서를 그대로 두면 새로 고칠 때 순서가 튄다. 서버 순서로 되돌린다.
        setOrder(ids);
        saveFailed(error);
      }
    });
  }

  const byId = new Map(friends.map((friend) => [friend.id, friend]));
  const nameOf = (id: Active["id"]) => byId.get(String(id))?.nickname ?? t("friendFallback");
  const positionOf = (id: Active["id"] | Over["id"]) => order.indexOf(String(id)) + 1;

  const accessibility = {
    screenReaderInstructions: {
      draggable: t("friendRowInstructions"),
    },
    announcements: {
      onDragStart: ({ active }: { active: Active }) => t("friendDragStart", { name: nameOf(active.id), position: positionOf(active.id) }),
      onDragOver: ({ active, over }: { active: Active; over: Over | null }) =>
        over
          ? t("friendDragOver", { name: nameOf(active.id), position: positionOf(over.id) })
          : t("friendDragOutside", { name: nameOf(active.id) }),
      onDragEnd: ({ active, over }: { active: Active; over: Over | null }) =>
        over
          ? t("friendDragEnd", { name: nameOf(active.id), position: positionOf(over.id) })
          : t("friendDragEndSame", { name: nameOf(active.id) }),
      onDragCancel: ({ active }: { active: Active }) => t("friendDragCancel", { name: nameOf(active.id) }),
    },
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      autoScroll={ROW_AUTO_SCROLL}
      onDragStart={(event) => buzzOnTouchDrag(event.activatorEvent)}
      onDragEnd={handleDragEnd}
      accessibility={accessibility}
    >
      <SortableContext items={order} strategy={horizontalListSortingStrategy}>
        {/* 얼굴 위아래로 조금 여유를 둬서, 집어 올린 얼굴의 테두리가 줄 가장자리에 잘리지 않게 한다. */}
        <ul ref={list} className="flex gap-4 py-1" aria-busy={isSaving}>
          {order.map((id) => {
            const friend = byId.get(id);
            return friend ? <FriendTile key={id} friend={friend} /> : null;
          })}
          {moreCount > 0 && (
            <li className="shrink-0">
              <Link prefetch={false} href="/feed/following" className="flex w-16 flex-col items-center gap-1.5">
                <span className="flex size-14 items-center justify-center rounded-full bg-surface text-sm font-semibold text-muted">
                  +{moreCount}
                </span>
                <span className="w-full truncate text-center text-xs text-muted">{t("viewAll")}</span>
              </Link>
            </li>
          )}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function FriendTile({ friend }: { friend: FriendItem }) {
  const t = useT(social);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: friend.id });
  // 마우스·손가락은 얼굴 전체에서, 키보드는 Tab으로 오면 보이는 버튼에서 받는다.
  const { onTouchStart, onMouseDown, ...keyListeners } = listeners ?? {};

  return (
    <li
      ref={setNodeRef}
      data-friend-id={friend.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onMouseDown={onMouseDown as React.MouseEventHandler<HTMLLIElement> | undefined}
      onTouchStart={onTouchStart as React.TouchEventHandler<HTMLLIElement> | undefined}
      // 길게 눌렀을 때 폰이 글자 선택·메뉴를 띄워 집기를 가로챈다. 손가락 화면에서만 막는다.
      onContextMenu={(event) => {
        if (window.matchMedia("(pointer: coarse)").matches) event.preventDefault();
      }}
      className={`relative shrink-0 pointer-fine:cursor-grab pointer-coarse:select-none pointer-coarse:[-webkit-touch-callout:none] ${
        isDragging ? "z-10 scale-105 opacity-90" : ""
      }`}
    >
      <button
        type="button"
        aria-label={t("friendHandleLabel", { nickname: friend.nickname })}
        className="sr-only z-10 rounded-lg text-xs text-foreground focus-visible:not-sr-only focus-visible:absolute focus-visible:left-0 focus-visible:top-0 focus-visible:bg-surface focus-visible:px-2 focus-visible:py-1 focus-visible:shadow pointer-coarse:hidden"
        {...attributes}
        {...keyListeners}
      >
        {t("friendHandleText")}
      </button>
      {/* draggable=false: 링크와 그림은 브라우저가 따로 끌기를 시작해 우리 끌기를 끊는다. */}
      <Link
        prefetch={false}
        href={`/feed/u/${friend.id}`}
        draggable={false}
        className="flex w-16 flex-col items-center gap-1.5 [-webkit-user-drag:none] [&_img]:pointer-events-none [&_img]:[-webkit-user-drag:none]"
      >
        <Avatar src={friend.avatar} size={56} />
        <span className="w-full truncate text-center text-xs">{friend.nickname}</span>
      </Link>
    </li>
  );
}
