import Link from "next/link";

import { formatKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const MAX_ITEMS = 50;

export default async function ReactionsPage() {
  const user = await requireUser();

  // 이 화면을 여는 시점이 "읽음" 기준이다. 목록을 먼저 읽고 갱신한다.
  const lastSeenAt = user.lastSeenAt;

  const reactions = await prisma.reaction.findMany({
    where: { todo: { userId: user.id }, userId: { not: user.id } },
    orderBy: { createdAt: "desc" },
    take: MAX_ITEMS,
    include: {
      user: { select: { nickname: true, profileEmoji: true } },
      todo: { select: { content: true, date: true } },
    },
  });

  // 응답을 보내기 전에 끝내야 한다. after()로 미루면 바로 피드로 돌아갔을 때
  // 아직 안 읽은 것으로 나온다. updateMany를 쓰는 이유는 그 사이 계정이 사라져도
  // 화면 전체가 죽지 않게 하려는 것이다(update는 대상이 없으면 던진다).
  await prisma.user.updateMany({
    where: { id: user.id },
    data: { lastSeenAt: new Date() },
  });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <Link href="/feed" aria-label="피드로" className="text-muted">
          ←
        </Link>
        <h1 className="text-2xl font-bold">받은 반응</h1>
      </header>

      {reactions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">
          아직 받은 반응이 없다
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {reactions.map((reaction) => {
            const isNew = reaction.createdAt > lastSeenAt;

            return (
              <li
                key={reaction.id}
                className={`flex items-center gap-3 rounded-2xl p-3 ${
                  isNew ? "bg-brand-subtle" : "bg-surface"
                }`}
              >
                <span className="text-xl">{reaction.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    <span className="font-semibold">
                      {reaction.user.profileEmoji} {reaction.user.nickname}
                    </span>
                    <span className="text-muted"> · {reaction.todo.content}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {formatKST(reaction.todo.date)}
                  </p>
                </div>
                {isNew && <span className="text-xs text-brand">NEW</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
