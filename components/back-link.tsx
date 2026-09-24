import Link from "next/link";

/**
 * 한 단계 위 화면으로 돌아가는 버튼.
 *
 * 예전에는 글자 "←" 하나라 손가락이 닿는 면적이 글자 크기(12px 안팎)뿐이었고,
 * 제목 옆에 흐린 색으로 붙어 있어 누를 수 있는 것처럼 보이지도 않았다.
 * 손가락 하나가 들어가는 40px 동그라미로 만들고, 왼쪽 여백만큼 당겨서
 * 아이콘이 본문 왼쪽 선에 맞게 한다.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link prefetch={false}
      href={href}
      aria-label={label}
      className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-hover active:scale-95"
    >
      <svg
        width={24}
        height={24}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M15 5 L8 12 L15 19" />
      </svg>
    </Link>
  );
}
