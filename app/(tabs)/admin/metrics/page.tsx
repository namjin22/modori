import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { isAdmin } from "@/lib/admin";
import { addDays, formatMonthDayKST, todayKST } from "@/lib/date";
import {
  activeUsers,
  groupByWeek,
  percent,
  profileChoices,
  reactionKinds,
  sourceBreakdown,
  totalsBefore,
} from "@/lib/metrics";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "지표 · 모도리" };

const WEEKS = 12;

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-surface p-4">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      {note && <span className="text-xs text-muted">{note}</span>}
    </div>
  );
}

function rate(part: number, whole: number): string {
  const value = percent(part, whole);
  return value === null ? "–" : `${value}%`;
}

/** 운영자만 본다. 숫자의 뜻과 세는 법은 docs/metrics.md. */
export default async function MetricsPage() {
  const user = await requireUser();
  if (!(await isAdmin(user.id))) notFound();

  const today = todayKST();
  const [totals, dau, wau, daily, sources, kinds, choices] = await Promise.all([
    totalsBefore(new Date()),
    activeUsers(today, today),
    activeUsers(addDays(today, -6), today),
    prisma.dailyStat.findMany({
      where: { date: { gte: addDays(today, -WEEKS * 7) } },
      orderBy: { date: "asc" },
    }),
    sourceBreakdown(today),
    reactionKinds(),
    profileChoices(),
  ]);
  const weeks = groupByWeek(daily).reverse();

  // 가입 단계. 앞 단계에서 몇 명이 다음 단계까지 왔는지 보면 어디서 멈추는지 보인다.
  const funnel = [
    { label: "로그인", count: totals.accounts },
    { label: "가입 완료(닉네임)", count: totals.users },
    { label: "할 일 적음", count: totals.withTodo },
    { label: "팔로우함", count: totals.withFollow },
    { label: "반응 보냄", count: totals.withReaction },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-1">
        <BackLink href="/settings" label="마이페이지로" />
        <h1 className="text-2xl font-bold">지표</h1>
        {/* 포트폴리오 그래프용. 전체 기간의 하루 합계를 CSV로 받는다. */}
        <Link
          prefetch={false}
          href="/admin/users"
          className="ml-auto rounded-xl bg-surface px-3 py-2 text-sm font-medium text-brand"
        >
          사용자별 보기
        </Link>
        <a
          href="/admin/metrics/export"
          download
          className="rounded-xl bg-surface px-3 py-2 text-sm font-medium text-brand"
        >
          CSV 받기
        </a>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="가입자" value={totals.users} note={`로그인만 한 계정 ${totals.accounts - totals.users}`} />
        <Stat label="오늘 쓴 사람" value={dau} />
        <Stat label="최근 7일 쓴 사람" value={wau} note={`가입자의 ${rate(wau, totals.users)}`} />
        <Stat label="팔로우 연결" value={totals.follows} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">가입 단계</h2>
        <ol className="flex flex-col divide-y divide-border rounded-2xl bg-surface px-4">
          {funnel.map((step, index) => (
            <li key={step.label} className="flex items-center justify-between py-2.5 text-sm">
              <span>{step.label}</span>
              <span className="tabular-nums">
                {step.count}
                {index > 0 && (
                  <span className="ml-2 text-xs text-muted">
                    앞 단계의 {rate(step.count, funnel[index - 1].count)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">가입 경로</h2>
        <div className="overflow-x-auto rounded-2xl bg-surface">
          <table className="w-full min-w-[480px] text-sm tabular-nums">
            <thead className="text-xs text-muted">
              <tr className="text-right [&>th]:px-3 [&>th]:py-2 [&>th:first-child]:text-left">
                <th>경로</th>
                <th>가입</th>
                <th>할 일 적음</th>
                <th>팔로우함</th>
                <th>반응 보냄</th>
                <th>7일 안에 씀</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sources.map((row) => (
                <tr key={row.source} className="text-right [&>td]:px-3 [&>td]:py-2 [&>td:first-child]:text-left">
                  <td>{row.source}</td>
                  <td>{row.users}</td>
                  <td>{row.withTodo}</td>
                  <td>{row.withFollow}</td>
                  <td>{row.withReaction}</td>
                  <td>{row.active7}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">
          초대 링크 끝에 ?from=discord처럼 붙인 표시예요. 표시가 없는 가입은 direct, 모바일 앱에서 시작한 가입은 app-android예요.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">반응과 프로필</h2>
        <ul className="flex flex-col divide-y divide-border rounded-2xl bg-surface px-4 text-sm">
          <li className="flex items-center justify-between py-2.5">
            <span>이모지 반응</span>
            <span className="tabular-nums">
              {kinds.emoji}
              {kinds.topEmoji.length > 0 && (
                <span className="ml-2 text-xs text-muted">
                  {kinds.topEmoji.map((row) => `${row.emoji}${row.count}`).join(" ")}
                </span>
              )}
            </span>
          </li>
          {kinds.byCharacter.map((row) => (
            <li key={row.id} className="flex items-center justify-between py-2.5">
              <span>{row.name} 표정 반응</span>
              <span className="tabular-nums">{row.count}</span>
            </li>
          ))}
          <li className="flex items-center justify-between py-2.5">
            <span>프로필 사진을 올린 사람</span>
            <span className="tabular-nums">{choices.photo}</span>
          </li>
          {choices.byCharacter.map((row) => (
            <li key={row.id} className="flex items-center justify-between py-2.5">
              <span>프로필 캐릭터 {row.name}</span>
              <span className="tabular-nums">{row.count}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">
          지금 남아 있는 반응·계정 기준이에요. 계정을 지우면 줄어요. 하루 합계에는 캐릭터 반응 수와 가입 경로별 누적이 남아요.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">주별</h2>
        {weeks.length === 0 ? (
          <p className="text-sm text-muted">하루 합계는 날이 바뀐 뒤 첫 접속이나 서버 상태 확인 때 찍혀요. 내일부터 쌓여요.</p>
        ) : (
          // 좁은 화면에서는 표만 옆으로 민다. 페이지 전체가 밀리지 않게 여기서 가둔다.
          <div className="overflow-x-auto rounded-2xl bg-surface">
            <table className="w-full min-w-[640px] text-sm tabular-nums">
              <thead className="text-xs text-muted">
                <tr className="text-right [&>th]:px-3 [&>th]:py-2 [&>th:first-child]:text-left">
                  <th>주</th>
                  <th>가입자</th>
                  <th>순증</th>
                  <th>주간 활성</th>
                  <th>할 일</th>
                  <th>반응</th>
                  <th>캐릭터 반응</th>
                  <th>7일 재방문</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {weeks.map((week) => (
                  <tr key={week.start.getTime()} className="text-right [&>td]:px-3 [&>td]:py-2 [&>td:first-child]:text-left">
                    <td>
                      {formatMonthDayKST(week.start)}~{formatMonthDayKST(week.end)}
                    </td>
                    <td>{week.users}</td>
                    <td>{week.signups ?? "–"}</td>
                    <td>{week.wau}</td>
                    <td>{week.todosCreated}</td>
                    <td>{week.reactionsCreated}</td>
                    <td>{week.reactionsCharacter}</td>
                    <td>
                      {rate(week.cohortReturned, week.cohortSize)}
                      <span className="ml-1 text-xs text-muted">
                        ({week.cohortReturned}/{week.cohortSize})
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted">
          주간 활성은 그 주 마지막 날까지 7일, 7일 재방문은 그 주에 합계를 찍은 날의 7일 전 가입자가 다음 날부터 7일 안에
          다시 쓴 비율이에요. 이 기능 전(9월 28일까지)의 이용한 날은 행동 기록(할 일·반응·팔로우)으로 채워 실제보다 적어요.
        </p>
      </section>
    </div>
  );
}
