import Link from "next/link";

import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { isAdmin } from "@/lib/admin";
import { isDesktopApp } from "@/lib/desktop";
import { DESKTOP_DOWNLOAD_URL } from "@/lib/desktop-download";
import { prisma } from "@/lib/prisma";
import { PRIVACY_MANAGER } from "@/lib/privacy";
import { requireUser } from "@/lib/session";

import { Avatar } from "@/components/avatar";
import { avatarUrl } from "@/lib/avatar";

export default async function SettingsPage() {
  const user = await requireUser();
  const desktop = await isDesktopApp();
  const [following, followers, admin] = await Promise.all([
    prisma.follow.count({ where: { followerId: user.id } }),
    prisma.follow.count({ where: { followingId: user.id } }),
    isAdmin(user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">마이페이지</h1>

      <section className="flex flex-col rounded-2xl bg-surface">
        <Link
          prefetch={false}
          href="/settings/profile"
          className="flex items-center gap-3 p-5"
        >
          <Avatar src={avatarUrl(user)} size={48} />
          <p className="flex-1 text-base font-semibold">{user.nickname}</p>
          <span className="flex items-center gap-0.5 text-sm text-muted">
            프로필 수정
            <svg
              aria-hidden
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 5 L16 12 L9 19" />
            </svg>
          </span>
        </Link>

        {/* 누르면 누가 있는지 목록으로 간다. */}
        <div className="grid grid-cols-2 border-t border-border">
          <Link
            prefetch={false}
            href="/feed/following"
            className="flex flex-col items-center gap-0.5 py-3.5 hover:bg-surface-hover"
          >
            <span className="text-lg font-bold">{following}</span>
            <span className="text-xs text-muted">팔로우</span>
          </Link>
          <Link
            prefetch={false}
            href="/feed/followers"
            className="flex flex-col items-center gap-0.5 border-l border-border py-3.5 hover:bg-surface-hover"
          >
            <span className="text-lg font-bold">{followers}</span>
            <span className="text-xs text-muted">팔로워</span>
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl bg-surface p-5">
        <h2 className="text-sm font-semibold text-muted">화면</h2>
        <ThemeToggle />
      </section>

      {/* 앱 안에서는 받을 필요가 없어 숨긴다. */}
      {!desktop && (
        <a
          href={DESKTOP_DOWNLOAD_URL}
          className="flex items-center gap-3 rounded-2xl bg-surface p-5"
        >
          <span className="flex flex-1 flex-col">
            <span className="text-sm font-semibold">Windows 앱 받기</span>
            <span className="text-xs text-muted">브라우저를 열지 않고 바탕화면에서 바로 써요</span>
          </span>
          <span className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-brand-contrast">
            다운로드
          </span>
        </a>
      )}

      <LogoutButton />

      {/* 눈에 잘 띄지 않게 맨 아래에 작게 둔다. 실수로 누를 자리가 아니다. */}
      <Link
        prefetch={false}
        href="/settings/account"
        className="mx-auto py-2 text-center text-xs text-muted underline underline-offset-4"
      >
        계정 지우기
      </Link>
      <Link
        prefetch={false}
        href="/privacy"
        className="mx-auto -mt-4 py-2 text-center text-xs text-muted underline underline-offset-4"
      >
        개인정보처리방침
      </Link>
      {/* 운영자에게만 보인다. */}
      {admin && (
        <Link
          prefetch={false}
          href="/admin/errors"
          className="mx-auto -mt-4 py-2 text-center text-xs text-muted underline underline-offset-4"
        >
          오류 기록
        </Link>
      )}

      {/* 출시 초기에 불편한 점과 버그를 모은다. 버튼으로 두면 자리를 크게 차지해서 맨 아래에 작게 적는다. */}
      <p className="-mt-2 text-center text-xs text-muted">
        의견·버그 제보{" "}
        <a
          href={`mailto:${PRIVACY_MANAGER.email}?subject=${encodeURIComponent("[모도리] 의견")}`}
          className="inline-block py-1 underline underline-offset-4"
        >
          {PRIVACY_MANAGER.email}
        </a>
      </p>
    </div>
  );
}
