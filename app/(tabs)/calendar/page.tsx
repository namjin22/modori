export default function CalendarPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">캘린더</h1>
      <section className="rounded-2xl border border-dashed border-border p-10 text-center">
        <p className="text-sm text-muted">완료한 할 일의 색이 여기 쌓인다</p>
      </section>
    </div>
  );
}
