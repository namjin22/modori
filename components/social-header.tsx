import Link from "next/link";

/**
 * 소셜 화면 맨 위(모두·내 친구 같이). 제목, 알림(종 + 안 읽은 수), 친구 찾기.
 * 예전에는 알림·팔로우 중 칩 줄이 "내 친구"에만 있어서 탭을 바꿀 때마다 아래 탭 막대가 60px씩 오르내렸고,
 * "모두" 탭에서는 알림으로 갈 길이 없었다(2026-10-20). 두 탭이 같은 머리를 쓴다.
 */
export function SocialHeader({ unread }: { unread: number }) {
  return (
    <header className="flex items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">소셜</h1>
      <div className="flex items-center gap-2">
        <Link
          prefetch={false}
          href="/feed/reactions"
          aria-label={unread > 0 ? `알림 ${unread}` : "알림"}
          className="relative flex size-9 items-center justify-center rounded-full bg-surface text-muted hover:text-foreground"
        >
          <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9" />
            <path d="M10 19a2 2 0 0 0 4 0" />
          </svg>
          {unread > 0 && (
            <span aria-hidden className="absolute -right-1 -top-1 min-w-[1.125rem] rounded-full bg-brand px-1 text-center text-[11px] font-semibold leading-[1.125rem] text-brand-contrast">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>
        <Link
          prefetch={false}
          href="/feed/search"
          className="h-9 rounded-full bg-brand px-4 text-sm font-semibold leading-9 text-brand-contrast"
        >
          친구 찾기
        </Link>
      </div>
    </header>
  );
}
