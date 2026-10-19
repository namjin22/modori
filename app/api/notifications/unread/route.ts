import { latestUnreadNotifications } from "@/lib/notification-preview";
import { countUnreadNotifications, getCurrentUser } from "@/lib/session";

/**
 * 안 읽은 알림 수(반응·새 팔로워·친구가 끝낸 일). 열어 둔 화면의 하단 탭이 1분마다 묻는다(components/bottom-nav.tsx).
 * 화면을 옮기지 않으면 뱃지가 그대로라, 웹·데스크톱에서 친구 소식이 와도 몰랐다(2026-10-17 요청).
 * `?detail=1`이면 종류마다 가장 최근 알림 한 줄과 서버 시각(now)도 준다. 이 기기에서 컴퓨터 알림을 켠 창만 묻는다(lib/desktop-notify.ts).
 * 창은 새로 생긴 일을 서버 시각끼리 견준다. 기기 시계가 틀려도 어긋나지 않는다.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user?.nickname) return Response.json({ count: 0 }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const count = await countUnreadNotifications(user.id, user.lastSeenAt, user.notifyFriendDone);
  if (new URL(request.url).searchParams.get("detail") !== "1") {
    return Response.json({ count }, { headers: { "Cache-Control": "no-store" } });
  }
  // 알림을 읽기 전에 시각을 잡는다. 읽는 사이에 생긴 일은 다음 차례에도 at > now라 다시 오지만, 창이 key로 거른다.
  const now = Date.now();
  const latest = count > 0 ? await latestUnreadNotifications(user.id, user.lastSeenAt, user.notifyFriendDone) : [];
  return Response.json({ count, now, latest }, { headers: { "Cache-Control": "no-store" } });
}
