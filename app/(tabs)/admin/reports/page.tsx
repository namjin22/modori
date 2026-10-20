import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { isAdmin } from "@/lib/admin";
import { formatKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { REPORT_REASONS, isReportReason } from "@/lib/report";
import { requireUser } from "@/lib/session";

import { hidePost } from "../../feed/public/actions";

import { deleteReportedAccount, handleReport } from "./actions";

export const metadata: Metadata = { title: "신고 · 모도리" };

/**
 * 운영자만 본다. 사용자가 낸 신고를 확인하고 처리한다. App Store 심사 지침 1.2는 신고를 빨리(24시간 안) 살피라고 한다.
 * 같은 사람에 대한 신고는 한 묶음으로 보인다.
 */
export default async function AdminReportsPage() {
  const user = await requireUser();
  if (!(await isAdmin(user.id))) notFound();

  const reports = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      reason: true,
      detail: true,
      createdAt: true,
      handledAt: true,
      reporter: { select: { nickname: true } },
      reported: { select: { id: true, nickname: true, email: true, bio: true } },
      // 피드 글에서 한 신고면 그 글(2026-10-19). 지워졌으면 비어 있다.
      post: { select: { id: true, todoContent: true, body: true, hiddenAt: true, photo: { select: { width: true, height: true } } } },
    },
  });

  type Row = (typeof reports)[number];
  const groups = new Map<string, { reported: Row["reported"]; items: Row[]; open: boolean }>();
  for (const report of reports) {
    const group = groups.get(report.reported.id) ?? { reported: report.reported, items: [], open: false };
    group.items.push(report);
    if (!report.handledAt) group.open = true;
    groups.set(report.reported.id, group);
  }
  const ordered = [...groups.values()].sort((a, b) => Number(b.open) - Number(a.open));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-1">
        <BackLink href="/settings" label="마이페이지로" />
        <h1 className="text-2xl font-bold">신고</h1>
      </header>

      {ordered.length === 0 && <p className="text-sm text-muted">아직 들어온 신고가 없어요.</p>}

      <ul className="flex flex-col gap-3">
        {ordered.map(({ reported, items, open }) => (
          <li key={reported.id} className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {reported.nickname} <span className="text-xs font-normal text-muted">{reported.email ?? "이메일 없음"}</span>
                </p>
                {reported.bio && <p className="truncate text-sm text-muted">소개: {reported.bio}</p>}
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${open ? "bg-danger/15 text-danger" : "bg-surface-hover text-muted"}`}>
                {open ? "확인 전" : "처리함"}
              </span>
            </div>

            <ul className="flex flex-col gap-2 text-sm">
              {items.map((report) => (
                <li key={report.id} className="rounded-xl bg-surface-hover px-3 py-2">
                  <p>
                    <b>{isReportReason(report.reason) ? REPORT_REASONS[report.reason] : report.reason}</b>{" "}
                    <span className="text-xs text-muted">
                      {formatKST(report.createdAt)} · 신고한 사람 {report.reporter.nickname}
                    </span>
                  </p>
                  {report.detail && <p className="mt-0.5 whitespace-pre-line text-muted">{report.detail}</p>}
                  {report.post && (
                    <div className="mt-2 flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-2.5">
                      <p className="text-xs text-muted">신고된 피드 글{report.post.hiddenAt ? " · 숨김" : ""}</p>
                      <p className="font-medium">✓ {report.post.todoContent}</p>
                      {report.post.body && <p className="whitespace-pre-line">{report.post.body}</p>}
                      {report.post.photo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/post-photo/${report.post.id}`}
                          alt="신고된 글의 사진"
                          width={report.post.photo.width}
                          height={report.post.photo.height}
                          loading="lazy"
                          className="max-h-64 w-auto max-w-full rounded-lg"
                        />
                      )}
                      {!report.post.hiddenAt && (
                        <form action={hidePost}>
                          <input type="hidden" name="postId" value={report.post.id} />
                          <button type="submit" className="h-8 rounded-lg bg-danger/10 px-3 text-xs font-semibold text-danger">
                            이 글 숨기기
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-2">
              {open && (
                <form action={handleReport}>
                  <input type="hidden" name="reportedId" value={reported.id} />
                  <button type="submit" className="h-9 rounded-full bg-brand px-4 text-sm font-semibold text-brand-contrast">
                    확인했어요
                  </button>
                </form>
              )}
              <form action={deleteReportedAccount} className="flex flex-1 items-center gap-2">
                <input type="hidden" name="reportedId" value={reported.id} />
                <input
                  name="confirm"
                  placeholder="지우려면 닉네임 입력"
                  aria-label={`${reported.nickname} 계정 지우기 확인`}
                  className="h-9 min-w-0 flex-1 rounded-xl bg-surface-hover px-3 text-sm"
                />
                <button type="submit" className="h-9 shrink-0 rounded-full px-3 text-sm font-medium text-danger">
                  계정 지우기
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted">
        계정을 지우면 그 사람의 기록과 이 신고가 함께 지워져요. 되돌릴 수 없어요.
      </p>
    </div>
  );
}
