import { requireUser } from "@/lib/session";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">설정</h1>

      <section className="rounded-2xl bg-surface p-5">
        <p className="text-3xl">{user.profileEmoji}</p>
        <p className="mt-2 text-base font-semibold">{user.nickname}</p>
      </section>

      <section className="rounded-2xl border border-dashed border-border p-10 text-center">
        <p className="text-sm text-muted">프로필 수정과 데이터 내보내기가 들어갈 자리</p>
      </section>
    </div>
  );
}
