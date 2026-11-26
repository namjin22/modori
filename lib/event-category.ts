import { isId } from "@/lib/ids";
import { prisma } from "@/lib/prisma";

/**
 * 폼이 고른 "내 색"(이름 붙은 색, EventCategory)을 확인해 저장할 색과 카테고리를 정한다(2026-11-25, 반복 일정까지 2026-11-26).
 * 일정(app/(tabs)/events/actions.ts)과 반복 일정(app/(tabs)/routines/event-routine-actions.ts)이 같이 쓴다.
 *
 * 내 카테고리면 그 색이 일정의 색이 된다(색은 복사해 두고 그리는 곳은 모두 color만 읽는다).
 * 카테고리를 고르지 않았으면 직접 고른 색이라 카테고리를 뗀다. 색 칸이 없던 예전 요청은 둘 다 그대로 둔다(undefined).
 * 남의 id나 이미 지운 id는 고르지 않은 것으로 본다.
 */
export async function resolveEventCategory(
  userId: string,
  formData: FormData,
  color: string | undefined,
): Promise<{ categoryId: string | null | undefined; color: string | undefined }> {
  const raw = formData.get("categoryId");
  const id = typeof raw === "string" ? raw.trim() : "";
  if (id && isId(id)) {
    const category = await prisma.eventCategory.findFirst({ where: { id, userId }, select: { id: true, color: true } });
    if (category) return { categoryId: category.id, color: category.color };
  }
  return { categoryId: color === undefined ? undefined : null, color };
}

/** 내 색 목록에서 id나 이름(대소문자 무시)으로 하나를 찾는다. AI 연결이 쓴다. */
export async function findEventCategory(userId: string, reference: string): Promise<{ id: string; name: string; color: string } | { error: string }> {
  const all = await prisma.eventCategory.findMany({ where: { userId }, orderBy: { order: "asc" }, select: { id: true, name: true, color: true } });
  const wanted = reference.trim().toLowerCase();
  const found = all.find((each) => each.id === reference) ?? all.find((each) => each.name.trim().toLowerCase() === wanted);
  if (found) return found;
  return { error: `Event category "${reference}" was not found. Available: ${all.map((each) => each.name).join(", ") || "(none)"}.` };
}
