"use client";

import { useRef, type FocusEvent } from "react";

// 칸 안을 누른 뒤 이 시간 안에 생기는 포커스 이탈은 안쪽 조작이 낳은 것으로 본다. 날짜 창이 닫히며 포커스가 사라지는 시간보다 넉넉하고,
// 사람이 칸 안을 누른 직후 바깥을 다시 누르는 시간보다는 짧다.
const INSIDE_PRESS_WINDOW_MS = 700;

/**
 * "칸 밖으로 포커스가 나갔는가"를 판단하는 도우미. 빈 입력 칸을 두고 다른 곳을 누르면 닫는 칸이 쓴다.
 *
 * `relatedTarget`(포커스가 옮겨 간 곳)만 보면 Safari·iPhone에서 틀린다. 그 브라우저는 버튼을 눌러도 버튼에 포커스를 주지 않고,
 * 안쪽 창(날짜 고르기)이 닫힐 때도 포커스를 칸으로 돌려주지 않아 `relatedTarget`이 비어, 칸 안의 버튼을 눌렀을 뿐인데
 * 밖을 눌렀다고 보고 칸이 닫혔다. 포인터는 포커스보다 먼저 눌리므로, 칸 안에서 눌린 때를 기록해 직후의 이탈은 안쪽 조작으로 본다.
 */
export function useBlurOutside(onOutside: (container: HTMLElement) => void) {
  const lastInsidePress = useRef(0);

  return {
    onPointerDownCapture: () => {
      lastInsidePress.current = performance.now();
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
      if (performance.now() - lastInsidePress.current < INSIDE_PRESS_WINDOW_MS) return;
      onOutside(event.currentTarget);
    },
  };
}
