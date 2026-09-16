import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export default async function SettingsPage() {
  const user = await requireUser();

  const [categoryCount, routineCount] = await Promise.all([
    prisma.category.count({ where: { userId: user.id, archivedAt: null } }),
    prisma.routine.count({ where: { userId: user.id } }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">설정</h1>

      <Link
        href="/settings/profile"
        className="flex items-center gap-3 rounded-2xl bg-surface p-5"
      >
        <span className="text-3xl">{user.profileEmoji}</span>
        <p className="flex-1 text-base font-semibold">{user.nickname}</p>
        <span className="text-sm text-muted">프로필 수정 →</span>
      </Link>

      <section className="flex flex-col gap-3 rounded-2xl bg-surface p-5">
        <h2 className="text-sm font-semibold text-muted">화면</h2>
        <ThemeToggle />
      </section>

      <section className="flex flex-col gap-4 rounded-2xl bg-surface p-5">
        <Link href="/settings/categories" className="flex items-center justify-between">
          <span className="font-medium">카테고리 관리</span>
          <span className="text-sm text-muted">{categoryCount}개 →</span>
        </Link>

        <Link href="/settings/routines" className="flex items-center justify-between">
          <span className="font-medium">루틴 관리</span>
          <span className="text-sm text-muted">{routineCount}개 →</span>
        </Link>
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
