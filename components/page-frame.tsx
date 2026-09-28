"use client";

import type { ReactNode } from "react";

import { usePathname } from "next/navigation";

/**
 * 피드 화면만 넓은 화면에서 두 칸(달력 | 목록)으로 펼친다.
 * 나머지 화면은 한 칸이라 너무 넓으면 줄이 길어져 읽기 힘들다.
 */
export function PageFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // 왼쪽 달력, 오른쪽 목록으로 펼치는 화면만 넓게 쓴다.
  const twoColumn = pathname === "/" || pathname.startsWith("/feed/u/");
  // 태블릿 세로(768px~)에서 512px로 묶으면 양옆이 휑하다. 한 줄이 너무 길지 않은 672px까지 넓힌다.
  const width = twoColumn ? "max-w-lg md:max-w-2xl lg:max-w-5xl" : "max-w-lg md:max-w-2xl";

  return (
    // 두 칸 화면은 넓을 때 아래 여백을 목록 칸이 가진다(달력 칸 고정, app/(tabs)/page.tsx).
    <main className={`mx-auto w-full flex-1 px-5 pb-12 pt-8 ${twoColumn ? "lg:pb-0" : ""} ${width}`}>
      {children}
    </main>
  );
}
