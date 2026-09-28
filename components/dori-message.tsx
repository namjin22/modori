import type { ReactNode } from "react";

import { Dori, type DoriMood } from "@/components/dori";

/**
 * 빈 목록이나 결과 없음 자리에 도리와 안내 문구를 함께 둔다. 글자만 있으면 고장 난 화면처럼
 * 보이기 쉬운데, 표정이 먼저 상황(처음이라 비었음, 찾지 못함)을 알려준다.
 */
export function DoriMessage({
  mood,
  children,
}: {
  mood: DoriMood;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface px-6 py-8 text-center text-sm text-muted">
      <Dori mood={mood} size={72} />
      {children}
    </div>
  );
}
