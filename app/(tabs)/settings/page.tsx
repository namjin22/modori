import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

import { Avatar } from "@/components/avatar";
import { avatarUrl } from "@/lib/avatar";

export default async function SettingsPage() {
  const user = await requireUser();
  const [following, followers] = await Promise.all([
    prisma.follow.count({ where: { followerId: user.id } }),
    prisma.follow.count({ where: { followingId: user.id } }),
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

        {/* 팔로우는 목록 화면이 있어 누르면 간다. 팔로워는 숫자만 보여준다. */}
        <div className="grid grid-cols-2 border-t border-border">
          <Link
            prefetch={false}
            href="/feed/following"
            className="flex flex-col items-center gap-0.5 py-3.5 hover:bg-surface-hover"
          >
            <span className="text-lg font-bold">{following}</span>
            <span className="text-xs text-muted">팔로우</span>
          </Link>
          <div className="flex flex-col items-center gap-0.5 border-l border-border py-3.5">
            <span className="text-lg font-bold">{followers}</span>
            <span className="text-xs text-muted">팔로워</span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl bg-surface p-5">
        <h2 className="text-sm font-semibold text-muted">화면</h2>
        <ThemeToggle />
      </section>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button
          type="submit"
          className="h-12 w-full rounded-2xl bg-surface text-sm text-muted transition-colors hover:text-foreground"
        >
          로그아웃
        </button>
      </form>

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
    </div>
  );
}
