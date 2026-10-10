import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { isAdmin } from "@/lib/admin";
import { loadUserRows, parseSort, SORTS, sortRows } from "@/lib/admin-users";
import { formatKST } from "@/lib/date";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "사용자 · 모도리" };

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-surface p-4">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      {note && <span className="text-xs text-muted">{note}</span>}
    </div>
  );
}

/**
 * 운영자만 본다. 가입한 사람 한 명씩 이용 현황을 모아 본다(누가 쓰고, 누가 멈췄는지).
 * 개수와 날짜만 보이고 할 일·메모·소개 같은 내용은 이 화면에 나오지 않는다. 방침 4항에 적었다.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; q?: string }>;
}) {
  const user = await requireUser();
  if (!(await isAdmin(user.id))) notFound();

  const { sort: rawSort, q = "" } = await searchParams;
  const sort = parseSort(rawSort);
  const query = q.slice(0, 40);
  const [all, found] = await Promise.all([loadUserRows(""), query ? loadUserRows(query) : null]);
  const rows = sortRows(found ?? all, sort);

  const noTodo = all.filter((row) => row.todos === 0).length;
  const noFollow = all.filter((row) => row.following === 0).length;
  const active7 = all.filter((row) => row.active7).length;
  const hidden = all.filter((row) => row.hideFromRecommend || row.recommendBlocked).length;
  const pushOn = all.filter((row) => row.pushDevices > 0).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-1">
        <BackLink href="/settings" label="마이페이지로" />
        <h1 className="text-2xl font-bold">사용자</h1>
        <a
          href="/admin/users/export"
          download
          className="ml-auto rounded-xl bg-surface px-3 py-2 text-sm font-medium text-brand"
        >
          CSV 받기
        </a>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="가입자" value={all.length} />
        <Stat
          label="최근 7일 쓴 사람"
          value={active7}
          note={`가입자의 ${all.length ? Math.round((active7 / all.length) * 100) : 0}%`}
        />
        <Stat label="할 일을 한 번도 안 적은 사람" value={noTodo} />
        <Stat label="아무도 팔로우하지 않은 사람" value={noFollow} />
        <Stat label="푸시 알림을 켠 사람" value={pushOn} />
        <Stat label="추천 친구에서 뺀 사람" value={hidden} />
      </section>

      <form className="flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="닉네임·이메일 검색"
          aria-label="사용자 검색"
          className="h-10 min-w-0 flex-1 rounded-xl bg-surface px-3 text-sm"
        />
        <input type="hidden" name="sort" value={sort} />
        <button type="submit" className="h-10 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-contrast">
          검색
        </button>
      </form>

      <nav aria-label="정렬" className="flex flex-wrap gap-2 text-sm">
        {(Object.entries(SORTS) as [keyof typeof SORTS, string][]).map(([key, label]) => (
          <Link
            key={key}
            prefetch={false}
            href={`/admin/users?sort=${key}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
            aria-current={sort === key ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 ${sort === key ? "bg-brand font-semibold text-brand-contrast" : "bg-surface text-muted"}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="overflow-x-auto rounded-2xl bg-surface">
        <table className="w-full min-w-[1100px] text-sm tabular-nums">
          <thead className="text-xs text-muted">
            <tr className="text-right [&>th]:px-3 [&>th]:py-2 [&>th:first-child]:text-left">
              <th>사용자</th>
              <th>가입일</th>
              <th>경로</th>
              <th>로그인</th>
              <th>최근 사용</th>
              <th>쓴 날(90일)</th>
              <th>할 일(완료/전체)</th>
              <th>카테고리·루틴·일정</th>
              <th>팔로잉·팔로워</th>
              <th>반응(보냄/받음)</th>
              <th>프로필</th>
              <th>푸시</th>
              <th>추천</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="text-right [&>td]:px-3 [&>td]:py-2 [&>td:first-child]:text-left">
                <td>
                  <div className="max-w-[14rem] truncate font-medium">{row.nickname}</div>
                  <div className="max-w-[14rem] truncate text-xs text-muted">{row.email ?? "이메일 없음"}</div>
                </td>
                <td>{formatKST(row.createdAt)}</td>
                <td>{row.source}</td>
                <td>{row.providers.join("·") || "–"}</td>
                <td className={row.active7 ? "" : "text-muted"}>{row.lastActive ? formatKST(row.lastActive) : "–"}</td>
                <td>{row.activeDays}</td>
                <td className={row.todos === 0 ? "text-muted" : ""}>
                  {row.todosDone}/{row.todos}
                </td>
                <td>
                  {row.categories}·{row.routines}·{row.events}
                </td>
                <td className={row.following === 0 ? "text-muted" : ""}>
                  {row.following}·{row.followers}
                </td>
                <td>
                  {row.reactionsSent}/{row.reactionsReceived}
                </td>
                <td>{row.profile === "photo" ? "사진" : row.character}</td>
                <td>{row.pushDevices > 0 ? row.pushDevices : "–"}</td>
                <td className={row.hideFromRecommend || row.recommendBlocked ? "text-danger" : "text-muted"}>
                  {row.recommendBlocked ? "운영자가 뺌" : row.hideFromRecommend ? "뺌" : "나옴"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={13} className="px-3 py-6 text-center text-muted">
                  {query ? `"${query}"에 맞는 사용자가 없어요` : "아직 가입한 사람이 없어요"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        개수와 날짜만 보여요. 할 일·메모·소개 같은 내용은 이 화면에 나오지 않아요. 추천 &quot;뺌&quot;은 그 사람이 마이페이지에서 끈 것이고, &quot;운영자가 뺌&quot;은 본인 설정과 상관없이 빠진 것이에요.
        CSV에는 닉네임·이메일이 들어 있지 않아요.
      </p>
    </div>
  );
}
