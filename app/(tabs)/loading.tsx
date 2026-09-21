// 탭을 눌렀을 때 서버가 응답할 때까지 빈 화면으로 멈춰 있지 않도록 뼈대를 먼저 보여준다.
export default function TabsLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-hidden>
      <div className="h-8 w-32 rounded-lg bg-surface-hover" />
      <div className="h-24 rounded-2xl bg-surface" />
      <div className="h-16 rounded-2xl bg-surface" />
      <div className="h-16 rounded-2xl bg-surface" />
    </div>
  );
}
