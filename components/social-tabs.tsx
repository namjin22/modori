import Link from "next/link";

/**
 * 소셜 탭 위의 [모두 | 내 친구](2026-10-19). 하단 첫 탭(홈)의 이름이 이미 "피드"라, "피드"가 두 번 보이지 않게 "모두"라고 한다. 피드는 모르는 사람까지 보는 공개 글, 내 친구는 팔로우한 친구들의 끝낸 할 일이다.
 * 공개 피드가 열리기 전(lib/public-feed.ts)에는 그리지 않는다.
 */
export function SocialTabs({ active }: { active: "public" | "friends" }) {
  const tab = (selected: boolean) =>
    `flex h-10 flex-1 items-center justify-center rounded-lg text-sm transition-colors ${
      selected ? "bg-surface font-semibold text-foreground shadow-sm" : "text-muted hover:text-foreground"
    }`;
  return (
    <nav aria-label="소셜 보기" className="flex gap-1 rounded-xl bg-surface-hover p-1">
      <Link prefetch={false} href="/feed/public" aria-current={active === "public" ? "page" : undefined} className={tab(active === "public")}>
        모두
      </Link>
      <Link prefetch={false} href="/feed" aria-current={active === "friends" ? "page" : undefined} className={tab(active === "friends")}>
        내 친구
      </Link>
    </nav>
  );
}
