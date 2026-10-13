"use client";

import { useEffect } from "react";

// 글자를 적는 칸은 길게 누르면 붙여넣기·선택 메뉴가 필요하다. 이 안에서는 막지 않는다.
const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

/** 손가락이 주 입력인 화면(폰·태블릿)인가. */
export function isTouchDevice(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse), (hover: none)").matches;
}

/**
 * 폰에서 어디를 길게 눌러도 브라우저의 메뉴(링크: 새 탭에서 열기·링크 복사·공유, 글자: 복사·공유·웹 검색, 사진: 저장)가 뜨지 않게 한다.
 * 모도리는 길게 누르기로 할 일·일정을 집어 옮기는데(components/sortable-list.tsx, event-drag-grid.tsx), 메뉴가 뜨면 집기가 취소된다.
 * 날짜 칸·이름표·화살표 등 링크가 곳곳에 있어 한 곳씩 막으면 빠진 곳이 생겼다. 글 적는 칸만 빼고 문서 전체에서 막는다.
 * 마우스를 쓰는 화면에는 걸지 않는다(오른쪽 단추 메뉴가 남는다).
 */
export function TouchMenuGuard() {
  useEffect(() => {
    if (!isTouchDevice()) return;

    const inEditable = (target: EventTarget | null) => target instanceof Element && target.closest(EDITABLE) !== null;
    // 캡처 단계에서 받는다. 아래쪽 부품이 먼저 처리하기 전에 막는다.
    const onContextMenu = (event: Event) => {
      if (!inEditable(event.target)) event.preventDefault();
    };
    // 링크·사진을 길게 누르고 끌면 주소·사진이 끌려 나간다.
    const onDragStart = (event: Event) => {
      if (!inEditable(event.target)) event.preventDefault();
    };

    document.addEventListener("contextmenu", onContextMenu, true);
    document.addEventListener("dragstart", onDragStart, true);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("dragstart", onDragStart, true);
    };
  }, []);

  return null;
}
