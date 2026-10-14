"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

/**
 * 옆으로 넘기는 한 줄(프로필 사진 칸, 소셜의 친구 얼굴). 손가락은 쓸어 넘기면 되지만, 마우스는 Shift를 누른 채 휠을 굴려야만
 * 넘어가서 넘길 수 있다는 것조차 몰랐다(2026-10-14 요청). 마우스 화면(pointer-fine)에서만 양 끝에 작은 ‹ › 버튼을 띄운다.
 * 넘길 것이 남은 쪽에만 보인다.
 *
 * 버튼은 Tab 순서에 넣지 않는다. 키보드는 칸 하나하나로 옮겨 가면 브라우저가 알아서 그 칸까지 넘겨 준다.
 */
export function ScrollRow({
  children,
  className = "",
  role,
  "aria-label": label,
}: {
  children: ReactNode;
  // 넘어가는 칸의 클래스(간격·여백). overflow와 스크롤바 숨기기는 여기서 붙인다.
  className?: string;
  role?: string;
  "aria-label"?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const row = ref.current;
    if (!row) return;
    // 소수점 픽셀 때문에 끝까지 넘겨도 1px쯤 남는다.
    const left = row.scrollLeft > 1;
    const right = row.scrollLeft + row.clientWidth < row.scrollWidth - 1;
    setEdges((current) => (current.left === left && current.right === right ? current : { left, right }));
  }, []);

  useEffect(() => {
    const row = ref.current;
    if (!row) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    for (const child of Array.from(row.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [measure]);

  function page(direction: 1 | -1) {
    const row = ref.current;
    if (!row) return;
    // 한 번에 보이는 폭의 70%쯤. 다 넘기면 어디까지 봤는지 놓친다.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollBy({ left: direction * row.clientWidth * 0.7, behavior: reduce ? "auto" : "smooth" });
  }

  const arrow =
    "absolute top-1/2 z-10 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-base leading-none text-foreground shadow-md hover:bg-surface-hover pointer-fine:flex animate-fade-in";

  return (
    <div className="relative">
      <div
        ref={ref}
        role={role}
        aria-label={label}
        onScroll={measure}
        className={`overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      >
        {children}
      </div>
      {edges.left && (
        <button type="button" tabIndex={-1} aria-label="왼쪽으로 넘기기" onClick={() => page(-1)} className={`${arrow} -left-1`}>
          ‹
        </button>
      )}
      {edges.right && (
        <button type="button" tabIndex={-1} aria-label="오른쪽으로 넘기기" onClick={() => page(1)} className={`${arrow} -right-1`}>
          ›
        </button>
      )}
    </div>
  );
}
