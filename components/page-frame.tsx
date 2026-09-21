"use client";

import type { ReactNode } from "react";

import { usePathname } from "next/navigation";

/**
 * 피드 화면만 넓은 화면에서 두 칸(달력 | 목록)으로 펼친다.
 * 나머지 화면은 한 칸이라 너무 넓으면 줄이 길어져 읽기 힘들다.
 */
export function PageFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const width = pathname === "/" ? "max-w-lg lg:max-w-5xl" : "max-w-lg";

  return (
    <main className={`mx-auto w-full flex-1 px-5 pb-12 pt-8 ${width}`}>
      {children}
    </main>
  );
}
