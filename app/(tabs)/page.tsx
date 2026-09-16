import { signOut } from "@/lib/auth";
import { formatKST, todayKST, weekdayKST } from "@/lib/date";
import { requireUser } from "@/lib/session";

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function formatToday(): string {
  const today = todayKST();
  const [, month, day] = formatKST(today).split("-");
  return `${Number(month)}월 ${Number(day)}일 ${WEEKDAY_NAMES[weekdayKST(today)]}요일`;
}

export default async function TodayPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted">{formatToday()}</p>
          <h1 className="mt-1 text-2xl font-bold">오늘</h1>
        </div>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            로그아웃
          </button>
        </form>
      </header>

      <section className="rounded-2xl bg-surface p-5">
        <p className="text-base font-semibold">
          {user.profileEmoji} {user.nickname}
        </p>
        <p className="mt-1 text-sm text-muted">할 일 추가는 다음에 붙인다.</p>
      </section>

      <section className="rounded-2xl border border-dashed border-border p-10 text-center">
        <p className="text-sm text-muted">아직 오늘 할 일이 없다</p>
      </section>
    </div>
  );
}
