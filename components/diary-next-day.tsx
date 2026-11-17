"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * 다음 날 일기로 가는 단추. 아직 오지 않은 날의 일기는 쓸 수 없어서, 오늘에서는 누르면 아무 데도 가지 않고 단추만 움찔한다
 * (2026-11-17 요청: 오늘이어도 단추는 두고, 누르면 애니메이션만 나오고 아무것도 안 되게).
 * 움직임은 key를 바꿔 같은 애니메이션을 처음부터 다시 돌린다. 연달아 눌러도 그때마다 움찔한다.
 */
export function DiaryNextDay({ href, label }: { href: string | null; label: string }) {
  const [bumps, setBumps] = useState(0);
  const className = "flex size-10 items-center justify-center rounded-full text-lg text-foreground hover:bg-surface-hover";

  if (href) {
    return (
      <Link prefetch={false} href={href} aria-label={label} className={className}>
        ›
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} onClick={() => setBumps((count) => count + 1)} className={className}>
      <span key={bumps} className={bumps > 0 ? "animate-nudge" : undefined}>
        ›
      </span>
    </button>
  );
}
