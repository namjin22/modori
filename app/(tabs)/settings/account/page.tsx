import Link from "next/link";

import { settings } from "@/lib/i18n/messages/settings";
import { getT } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

import { DeleteAccountForm } from "@/components/delete-account-form";
import { Dori } from "@/components/dori";
import { BackLink } from "@/components/back-link";

export default async function AccountPage() {
  const user = await requireUser();
  const t = await getT(settings);

  // 무엇이 사라지는지 숫자로 보여준다. "모든 데이터"라고만 쓰면 와닿지 않는다.
  const [todos, categories, routines, events, following, reactions] = await Promise.all([
    prisma.todo.count({ where: { userId: user.id } }),
    prisma.category.count({ where: { userId: user.id } }),
    prisma.routine.count({ where: { userId: user.id } }),
    prisma.event.count({ where: { userId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    prisma.reaction.count({ where: { todoUserId: user.id } }),
  ]);

  const rows = [
    [t("accountTodos"), todos],
    [t("accountCategories"), categories],
    [t("accountRoutines"), routines],
    [t("accountEvents"), events],
    [t("accountFollowing"), following],
    [t("accountReactions"), reactions],
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-1">
        <BackLink href="/settings" label={t("toMyPage")} />
        <h1 className="text-2xl font-bold">{t("accountTitle")}</h1>
      </header>

      <div className="flex flex-col gap-4 rounded-2xl bg-surface p-4">
        <Dori mood="sad" size={72} className="mx-auto" />
        <p className="text-sm text-muted">
          {t("accountIntro")}
        </p>

        <ul className="flex flex-col gap-1 text-sm">
          {rows.map(([label, count]) => (
            <li key={label} className="flex justify-between">
              <span className="text-muted">{label}</span>
              <span className="font-medium">{t("accountCount", { count })}</span>
            </li>
          ))}
        </ul>

        <p className="text-sm text-muted">
          {t("accountReactionNote")}
        </p>
      </div>

      <DeleteAccountForm nickname={user.nickname ?? ""} />

      <Link prefetch={false} href="/settings" className="py-2 text-center text-sm text-brand">
        {t("keepIt")}
      </Link>
    </div>
  );
}
