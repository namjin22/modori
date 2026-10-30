"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { useT } from "@/components/locale-provider";
import { settings } from "@/lib/i18n/messages/settings";

/**
 * 옆으로 넘기는 한 줄(프로필 사진 칸, 소셜의 친구 얼굴). 손가락은 쓸어 넘기면 되지만, 마우스는 Shift를 누른 채 휠을 굴려야만
 * 넘어가서 넘길 수 있다는 것조차 몰랐다(2026-10-14 요청). 마우스 화면(pointer-fine)에서만 양 끝에 작은 ‹ › 버튼을 띄운다.
 * 넘길 것이 남은 쪽에만 보인다.
 *
 * 버튼은 Tab 순서에 넣지 않는다. 키보드는 칸 하나하나로 옮겨 가면 브라우저가 알아서 그 칸까지 넘겨 준다.
 *
 * 버튼은 넘길 쪽 가장자리를 바탕색으로 흐리게 덮은 위에 둔다. 예전에는 줄 높이의 가운데(얼굴과 이름 사이)에 떠서 끝의 얼굴 위에
 * 그냥 얹힌 것처럼 어색했다(2026-10-21 요청). arrowTop으로 버튼 높이를 얼굴 가운데에 맞춘다.
 */
export function ScrollRow({
  children,
  className = "",
  role,
  "aria-label": label,
  fade = "background",
  arrowTop,
  bleed = false,
}: {
  children: ReactNode;
  // 넘어가는 칸의 클래스(간격·여백). overflow와 스크롤바 숨기기는 여기서 붙인다.
  className?: string;
  role?: string;
  "aria-label"?: string;
  // 가장자리를 덮는 색. 줄이 놓인 바탕과 같아야 한다(화면 바탕 또는 카드).
  fade?: "background" | "surface";
  // 버튼 가운데의 높이(px). 없으면 줄의 가운데.
  arrowTop?: number;
  // 화면 가장자리까지 넘어가게 바깥 여백(px-5)만큼 넓힌다. 흐림과 버튼도 화면 끝에 붙는다.
  bleed?: boolean;
}) {
  const t = useT(settings);
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

  const from = fade === "surface" ? "from-surface" : "from-background";
  // 흐림 띠는 누르면 지나가게(pointer-events-none) 하고, 버튼만 누를 수 있다.
  const band = `pointer-events-none absolute inset-y-0 z-10 hidden w-14 animate-fade-in pointer-fine:block ${from} via-50% to-transparent`;
  const arrow =
    "pointer-events-auto absolute flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-base leading-none text-foreground shadow-md hover:bg-surface-hover";
  const top = arrowTop === undefined ? "50%" : `${arrowTop}px`;

  return (
    <div className={`relative ${bleed ? "-mx-5" : ""}`}>
      <div
        ref={ref}
        role={role}
        aria-label={label}
        onScroll={measure}
        className={`overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${bleed ? "px-5" : ""} ${className}`}
      >
        {children}
      </div>
      {edges.left && (
        <div className={`${band} left-0 bg-linear-to-r`}>
          <button type="button" tabIndex={-1} aria-label={t("scrollLeft")} onClick={() => page(-1)} className={`${arrow} left-1.5`} style={{ top }}>
            ‹
          </button>
        </div>
      )}
      {edges.right && (
        <div className={`${band} right-0 bg-linear-to-l`}>
          <button type="button" tabIndex={-1} aria-label={t("scrollRight")} onClick={() => page(1)} className={`${arrow} right-1.5`} style={{ top }}>
            ›
          </button>
        </div>
      )}
    </div>
  );
}
