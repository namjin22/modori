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

  await prisma.user.update({
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
