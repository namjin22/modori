import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";

/**
 * 값이 바뀌는 순간에만 움직이는 애니메이션(Web Animations API). CSS 애니메이션은 요소가 새로 생길 때 돌아서,
 * 날짜를 넘기거나 체크할 때마다 돌리려면 요소를 다시 만들어야 하고 그러면 포커스·입력이 날아간다. 이건 요소를 그대로 두고 움직인다.
 * 처음 그릴 때는 움직이지 않는다. 기기에서 "동작 줄이기"를 켰으면 움직이지 않는다(globals.css의 규칙은 이 API에 닿지 않는다).
 */
function useOnChange<T>(value: T, run: (previous: T) => void) {
  const previous = useRef(value);
  const latest = useRef(run);
  useEffect(() => {
    latest.current = run;
  });
  useEffect(() => {
    if (Object.is(previous.current, value)) return;
    const before = previous.current;
    previous.current = value;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    latest.current(before);
  }, [value]);
}

/**
 * 보는 날·달이 바뀌면 넘긴 쪽에서 미끄러져 들어온다. key는 "YYYY-MM-DD"·"YYYY-MM"처럼 글자 순서가 곧 시간 순서인 값이다.
 * 다음 날이면 오른쪽에서, 이전 날이면 왼쪽에서 들어와 어느 쪽으로 넘겼는지 몸으로 안다.
 */
export function useSwapIn(ref: RefObject<HTMLElement | null>, key: string) {
  useOnChange(key, (previous) => {
    const direction = key > previous ? 1 : -1;
    ref.current?.animate(
      [
        { opacity: 0, transform: `translateX(${direction * 18}px)` },
        { opacity: 1, transform: "none" },
      ],
      { duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    );
  });
}

/**
 * 목록의 줄이 자리를 바꾸면(체크해서 아래로 내려감, 지우거나 옮겨 빠진 자리를 메움) 뚝 끊기지 않고 미끄러져 간다(FLIP).
 * 줄(바로 아래 자식)에는 data-row-id를 붙인다. 그릴 때마다 줄의 위치를 목록 위끝 기준으로 적어 두고(스크롤과 상관없게),
 * 다음에 그렸을 때 자리가 달라진 줄만 원래 자리에서 새 자리로 옮겨 보인다.
 * 끄는 중이거나 막 놓은 직후(paused)는 dnd-kit이 이미 움직여 보였으므로 건드리지 않는다.
 */
export function useFlipList(ref: RefObject<HTMLElement | null>, paused: boolean) {
  const positions = useRef(new Map<string, number>());
  const pausedBefore = useRef(paused);
  useLayoutEffect(() => {
    const list = ref.current;
    if (!list) return;
    const origin = list.getBoundingClientRect().top;
    const rows = Array.from(list.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && Boolean(child.dataset.rowId),
    );
    const next = new Map(rows.map((row) => [row.dataset.rowId as string, row.getBoundingClientRect().top - origin]));
    const skip = paused || pausedBefore.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!skip) {
      for (const row of rows) {
        const before = positions.current.get(row.dataset.rowId as string);
        const after = next.get(row.dataset.rowId as string);
        if (before === undefined || after === undefined || Math.abs(before - after) < 1) continue;
        row.animate([{ transform: `translateY(${before - after}px)` }, { transform: "none" }], {
          duration: 260,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        });
      }
    }
    positions.current = next;
    pausedBefore.current = paused;
  });
}

/** 값이 바뀌면 한 번 통 튄다(체크 표시, 반응 개수). 처음 그릴 때와 같은 값으로 다시 그릴 때는 가만히 있다. */
export function useBump<T>(ref: RefObject<HTMLElement | null>, value: T, scale = 1.25) {
  useOnChange(value, () => {
    ref.current?.animate([{ transform: "scale(1)" }, { transform: `scale(${scale})` }, { transform: "scale(1)" }], {
      duration: 260,
      easing: "ease-out",
    });
  });
}
