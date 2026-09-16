export default function FeedPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">피드</h1>
      <section className="rounded-2xl border border-dashed border-border p-10 text-center">
        <p className="text-sm text-muted">팔로우한 친구가 완료한 할 일이 보인다</p>
      </section>
    </div>
  );
}
