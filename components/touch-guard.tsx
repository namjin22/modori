"use client";

import type { ReactNode } from "react";

/** 손가락이 주 입력인 화면(폰·태블릿). 마우스는 해당하지 않는다. components/touch-menu-guard.tsx와 같은 기준이다. */
export function isTouchPrimary(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse), (hover: none)").matches;
}

/**
 * 링크가 많은 칸(달력 날짜 칸)을 감싸, 폰에서 길게 눌렀을 때 브라우저가 띄우는 링크 메뉴(새 탭에서 열기·링크 복사·공유 등)를 막는다.
 * 모도리에서 길게 누르기는 할 일·일정을 집어 옮기는 동작이라(components/sortable-list.tsx, event-drag-grid.tsx) 메뉴가 뜨면
 * 집을 수 없다. 마우스 오른쪽 단추는 그대로 둔다. 서버 컴포넌트는 이벤트 함수를 넘길 수 없어 이 작은 부품으로 감싼다.
 */
export function TouchGuard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={className}
      onContextMenu={(event) => {
        if (isTouchPrimary()) event.preventDefault();
      }}
      // 링크는 길게 누르고 끌면 주소가 끌려 나간다.
      onDragStart={(event) => event.preventDefault()}
    >
      {children}
    </div>
  );
}
