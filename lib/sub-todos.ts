import { isSameKSTDate } from "@/lib/date";
import { prisma } from "@/lib/prisma";

/**
 * 세부 할 일(2026-11-20): 큰 할 일 밑에 다는 할 일. 단계는 둘뿐이다(세부 할 일 밑에는 또 달지 못한다).
 * 세부 할 일은 부모와 같은 날·같은 카테고리에 있다(친구에게 보이는 것도 카테고리 공개 여부를 따르므로 같아야 샌다).
 * 부모를 옮기거나 카테고리를 바꾸는 모든 길이 끝에 settleSubTodos를 불러 이 약속을 맞춘다.
 */

/**
 * 세부 할 일을 달 수 있는 큰 할 일인지: 이미 세부 할 일이 아니면 된다(두 단계). 루틴이 만든 할 일에도 달 수 있다(2026-11-20 운영자 결정).
 * 루틴을 고쳐 그 할 일의 카테고리가 바뀌면 세부 할 일도 따라가게 고치는 쪽(updateRoutine)이 settleSubTodos를 부른다.
 */
export function canHaveSubTodos(todo: { parentId: string | null }): boolean {
  return todo.parentId === null;
}

type Row = { id: string; parentId: string | null; date: Date; categoryId: string | null; done: boolean };

export type Detached = { id: string; parentId: string };

/**
 * 방금 바뀐 할 일들(ids)을 기준으로 부모와 세부 할 일의 날짜·카테고리를 다시 맞춘다. 여러 번 불러도 같다.
 *
 * - 부모가 옮겨 갔으면: 안 끝낸 세부 할 일은 같이 간다. 끝낸 세부 할 일은 그 날의 기록이라 남기고 부모와의 연결만 끊는다("끝낸 일을 옮기면 기록이 사라진다").
 * - 부모의 카테고리가 바뀌었으면 세부 할 일도 따라간다(끝낸 것도).
 * - 세부 할 일이 혼자 옮겨 가거나 카테고리가 바뀌었으면 부모와의 연결을 끊는다(혼자 다른 곳에 간 것이라 꼬리가 아니다).
 * 끊은 목록을 돌려준다(되돌리기가 다시 이을 수 있게).
 */
export async function settleSubTodos(userId: string, ids: string[]): Promise<Detached[]> {
  if (ids.length === 0) return [];
  const touched: Row[] = await prisma.todo.findMany({
    where: { userId, OR: [{ id: { in: ids } }, { parentId: { in: ids } }] },
    select: { id: true, parentId: true, date: true, categoryId: true, done: true },
  });
  const asked = new Set(ids);
  const parentIds = [...new Set(touched.flatMap((row) => (asked.has(row.id) && row.parentId ? [row.parentId] : [])))];
  const parents: Row[] = parentIds.length
    ? await prisma.todo.findMany({ where: { userId, id: { in: parentIds } }, select: { id: true, parentId: true, date: true, categoryId: true, done: true } })
    : [];
  const byId = new Map([...touched, ...parents].map((row) => [row.id, row]));

  const detach: Detached[] = [];
  const follow = new Map<string, { parent: Row; rows: Row[] }>(); // 부모 id → 부모를 따라 날짜·카테고리를 맞출 세부 할 일
  const dropped = new Set<string>();

  // 혼자 옮겨 간 세부 할 일.
  for (const row of touched) {
    if (!asked.has(row.id) || !row.parentId) continue;
    const parent = byId.get(row.parentId);
    if (!parent || !isSameKSTDate(parent.date, row.date) || parent.categoryId !== row.categoryId) {
      detach.push({ id: row.id, parentId: row.parentId });
      dropped.add(row.id);
    }
  }
  // 옮겨 갔거나 카테고리가 바뀐 부모의 세부 할 일.
  for (const row of touched) {
    if (!row.parentId || !asked.has(row.parentId) || dropped.has(row.id)) continue;
    const parent = byId.get(row.parentId);
    if (!parent) continue;
    if (!isSameKSTDate(parent.date, row.date)) {
      if (row.done) {
        detach.push({ id: row.id, parentId: row.parentId });
        continue;
      }
    } else if (parent.categoryId === row.categoryId) {
      continue;
    }
    follow.set(parent.id, { parent, rows: [...(follow.get(parent.id)?.rows ?? []), row] });
  }

  await Promise.all([
    detach.length > 0 ? prisma.todo.updateMany({ where: { userId, id: { in: detach.map((item) => item.id) } }, data: { parentId: null } }) : null,
    ...[...follow.values()].map(({ parent, rows }) =>
      prisma.todo.updateMany({
        where: { userId, id: { in: rows.map((row) => row.id) } },
        data: { date: parent.date, categoryId: parent.categoryId, color: null },
      }),
    ),
  ]);
  return detach;
}
