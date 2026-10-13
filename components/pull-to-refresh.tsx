"use client";

import { useEffect, useRef, useState } from "react";

// 이만큼(화면에 보이는 거리) 당기면 놓을 때 새로고침한다.
const THRESHOLD = 70;
const MAX_PULL = 110;
// 손가락 이동의 절반만큼 표시가 내려온다. 그대로 따라오면 너무 빨리 넘어간다.
const RESISTANCE = 0.5;
// 누르고 이만큼 지난 뒤에 움직이면 당기기가 아니다. 길게 눌러(0.4초) 할 일·일정을 집는 동작과 겹치지 않게 한다.
const START_WITHIN_MS = 300;

/**
 * 앱(안드로이드·아이폰)에서 화면 맨 위에서 아래로 당기면 새로고침한다. 앱에는 브라우저의 새로고침 버튼이 없어서
 * 모든 화면에서 새로 받을 방법이 없었다(아이폰 사용자 피드백). 브라우저는 저마다 당겨서 새로고침이 있어 앱 안에서만 켠다.
 * 새로고침은 화면을 통째로 새로 연다. 새 배포 뒤 오래 켜 둔 화면도 이걸로 새 버전이 된다.
 */
export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);

  useEffect(() => {
    if (!navigator.userAgent.includes("ModoriMobile")) return;

    let startX = 0;
    let startY = 0;
    let startAt = 0;
    let tracking = false;
    let decided = false;

    const show = (value: number) => {
      pullRef.current = value;
      setPull(value);
    };

    const onStart = (event: TouchEvent) => {
      tracking = false;
      decided = false;
      if (event.touches.length !== 1 || window.scrollY > 0) return;
      // 떠 있는 창(할 일·반응 창)이나 글 적는 칸 위에서는 당기지 않는다.
      if (document.querySelector("dialog[open]")) return;
      const target = event.target as Element | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      startAt = Date.now();
      tracking = true;
    };

    const onMove = (event: TouchEvent) => {
      if (!tracking) return;
      const dx = event.touches[0].clientX - startX;
      const dy = event.touches[0].clientY - startY;
      if (!decided) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        decided = true;
        // 위로 밀기(스크롤), 옆으로 밀기, 늦게 시작한 움직임(길게 눌러 집기)은 당기기가 아니다.
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || Date.now() - startAt > START_WITHIN_MS || window.scrollY > 0) {
          tracking = false;
          return;
        }
      }
      show(Math.min(MAX_PULL, Math.max(0, dy) * RESISTANCE));
      // 당기는 동안 화면 자체가 따라 움직이지 않게 한다(안드로이드의 끝 표시 등).
      if (event.cancelable) event.preventDefault();
    };

    const onEnd = () => {
      if (!tracking) return;
      tracking = false;
      if (pullRef.current >= THRESHOLD) {
        setRefreshing(true);
        window.location.reload();
        return;
      }
      show(0);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  if (pull === 0 && !refreshing) return null;
  const ready = pull >= THRESHOLD || refreshing;
  return (
    <div
      aria-live="polite"
      // iOS 앱은 상태 막대 아래부터 보인다.
      className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top,0px)] z-[70] flex justify-center"
      style={{ transform: `translateY(${refreshing ? THRESHOLD - 30 : pull - 30}px)`, transition: pull === 0 ? "transform 150ms" : undefined }}
    >
      <span
        className={`flex size-10 items-center justify-center rounded-full bg-surface text-lg shadow-md ${refreshing ? "animate-spin" : ""}`}
        style={{ transform: refreshing ? undefined : `rotate(${(pull / THRESHOLD) * 270}deg)`, opacity: Math.min(1, pull / THRESHOLD + 0.2) }}
      >
        <span aria-hidden className={ready ? "text-brand" : "text-muted"}>
          ↻
        </span>
        <span className="sr-only">{ready ? "놓으면 새로고침해요" : "당겨서 새로고침"}</span>
      </span>
    </div>
  );
}
