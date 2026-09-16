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

      <section className="flex items-center gap-3 rounded-2xl bg-surface p-5">
        <span className="text-3xl">{user.profileEmoji}</span>
        <p className="text-base font-semibold">{user.nickname}</p>
      </section>

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
    </div>
  );
}
