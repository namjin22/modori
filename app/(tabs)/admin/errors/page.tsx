import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { isAdmin } from "@/lib/admin";
import { formatKST } from "@/lib/date";
import { DoriMessage } from "@/components/dori-message";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "오류 기록 · 모도리" };

/** 운영자만 본다. 다른 사람에게는 없는 주소처럼 보인다. */
export default async function ErrorsPage() {
  const user = await requireUser();
  if (!(await isAdmin(user.id))) notFound();

  const errors = await prisma.errorEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-1">
        <BackLink href="/settings" label="마이페이지로" />
        <h1 className="text-2xl font-bold">오류 기록</h1>
      </header>
      <p className="text-sm text-muted">최근 100건, 30일 지난 것은 지워져요.</p>

      {errors.length === 0 ? (
        <DoriMessage mood="cool">
          <p>기록된 오류가 없어요</p>
        </DoriMessage>
      ) : (
        <ul className="flex flex-col gap-2">
          {errors.map((error) => (
            <li key={error.id} className="flex flex-col gap-1 rounded-2xl bg-surface p-4 text-sm">
              <p className="flex flex-wrap gap-x-2 text-xs text-muted">
                <span>
                  {formatKST(error.createdAt)}{" "}
                  {error.createdAt.toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour12: false })}
                </span>
                <span>{error.source === "server" ? "서버" : "브라우저"}</span>
                {error.path && <span>{error.path}</span>}
                {error.digest && <span>digest {error.digest}</span>}
              </p>
              <p className="break-all font-mono text-xs">{error.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
