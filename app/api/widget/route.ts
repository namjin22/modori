import { formatKST, todayIn } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { ensureRoutineTodos } from "@/lib/routine-todos";
import { getCurrentUser } from "@/lib/session";
import { buildWidget } from "@/lib/widget";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * 홈 화면 위젯이 오늘 남은 할 일을 묻는다(2026-11-20, Android 앱의 위젯. 읽기 전용).
 * 위젯은 앱 웹뷰에 있는 로그인 쿠키를 그대로 실어 부른다(mobile/android의 ModoriWidgetProvider).
 * requireUser가 아니라 getCurrentUser를 쓴다: 위젯이 새로 고쳐지는 것을 "오늘 앱을 썼다"로 세면 활성 사용자 지표가 부풀려진다(docs/metrics.md).
 * 루틴 할 일은 그 날을 여는 순간 만들어지므로(lib/routine-todos.ts) 앱을 열기 전 아침에도 보이게 여기서도 오늘 것을 만든다.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.nickname) return Response.json({}, { status: 401, headers: NO_STORE });

  const today = todayIn(user.timezone);
  await ensureRoutineTodos(user, today);
  const rows = await prisma.todo.findMany({
    where: { userId: user.id, date: today },
    select: {
      id: true,
      content: true,
      done: true,
      order: true,
      parentId: true,
      color: true,
      category: { select: { order: true, color: true } },
    },
  });
  return Response.json({ date: formatKST(today), ...buildWidget(rows) }, { headers: NO_STORE });
}
