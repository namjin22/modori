import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/lib/auth";
import { requireUser } from "@/lib/session";

import { Avatar } from "@/components/avatar";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">설정</h1>

      <Link
        href="/settings/profile"
        className="flex items-center gap-3 rounded-2xl bg-surface p-5"
      >
        <Avatar src={user.profileImage} size={48} />
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
        href="/settings/account"
        className="text-center text-xs text-muted underline underline-offset-4"
      >
        계정 지우기
      </Link>
    </div>
  );
}
