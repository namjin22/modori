import { countUnreadNotifications, getCurrentUser } from "@/lib/session";

/**
 * 안 읽은 알림 수(반응·새 팔로워·친구가 끝낸 일). 열어 둔 화면의 하단 탭이 1분마다 묻는다(components/bottom-nav.tsx).
 * 화면을 옮기지 않으면 뱃지가 그대로라, 웹·데스크톱에서 친구 소식이 와도 몰랐다(2026-10-17 요청).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.nickname) return Response.json({ count: 0 }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const count = await countUnreadNotifications(user.id, user.lastSeenAt);
  return Response.json({ count }, { headers: { "Cache-Control": "no-store" } });
}
