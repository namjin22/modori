import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

import { DeleteAccountForm } from "@/components/delete-account-form";
import { Dori } from "@/components/dori";

export default async function AccountPage() {
  const user = await requireUser();

  // 무엇이 사라지는지 숫자로 보여준다. "모든 데이터"라고만 쓰면 와닿지 않는다.
  const [todos, categories, routines, following, reactions] = await Promise.all([
    prisma.todo.count({ where: { userId: user.id } }),
    prisma.category.count({ where: { userId: user.id } }),
    prisma.routine.count({ where: { userId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    prisma.reaction.count({ where: { todo: { userId: user.id } } }),
  ]);

  const rows = [
    ["할 일", todos],
    ["카테고리", categories],
    ["루틴", routines],
    ["팔로우", following],
    ["받은 반응", reactions],
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <Link href="/settings" aria-label="설정으로" className="text-muted">
          ←
        </Link>
        <h1 className="text-2xl font-bold">계정 지우기</h1>
      </header>

      <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
        <Dori mood="sad" size={72} className="mx-auto" />
        <p className="text-sm text-muted">
          계정을 지우면 아래 기록이 모두 사라집니다. 되돌릴 수 없고, 같은 구글
          계정으로 다시 로그인해도 예전 기록은 돌아오지 않습니다.
        </p>

        <ul className="flex flex-col gap-1 text-sm">
          {rows.map(([label, count]) => (
            <li key={label} className="flex justify-between">
              <span className="text-muted">{label}</span>
              <span className="font-medium">{count}개</span>
            </li>
          ))}
        </ul>

        <p className="text-sm text-muted">
          내가 친구에게 남긴 반응도 함께 사라집니다.
        </p>
      </div>

      <DeleteAccountForm nickname={user.nickname ?? ""} />

      <Link href="/settings" className="text-center text-sm text-brand">
        그냥 두기
      </Link>
    </div>
  );
}
