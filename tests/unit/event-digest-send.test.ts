// 때가 된 오늘 일정 알림 보내기(lib/event-digest-send.ts): 보낼 차례인 사람만, 먼저 "보낸 날"을 조건부로 적은 사람에게만, 앱 푸시로만 보낸다.
import { beforeEach, describe, expect, it, vi } from "vitest";

const userFindMany = vi.fn();
const userUpdateMany = vi.fn();
const eventFindMany = vi.fn();
const routineFindMany = vi.fn();
const skipFindMany = vi.fn();
const sendPushToUser = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: (...a: unknown[]) => userFindMany(...a), updateMany: (...a: unknown[]) => userUpdateMany(...a) },
    event: { findMany: (...a: unknown[]) => eventFindMany(...a) },
    eventRoutine: { findMany: (...a: unknown[]) => routineFindMany(...a) },
    eventRoutineSkip: { findMany: (...a: unknown[]) => skipFindMany(...a) },
  },
}));
vi.mock("@/lib/push", () => ({ sendPushToUser: (...a: unknown[]) => sendPushToUser(...a) }));

import { sendDueEventDigests } from "@/lib/event-digest-send";

const seoul0600 = new Date("2026-10-28T21:00:00Z"); // 서울 2026-10-29(목) 06:00
const today = new Date("2026-10-29T00:00:00Z");
const owner = (overrides: Record<string, unknown> = {}) => ({
  id: "u1",
  timezone: "Asia/Seoul",
  eventDigestMinute: 6 * 60,
  eventDigestSentOn: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  userUpdateMany.mockResolvedValue({ count: 1 });
  eventFindMany.mockResolvedValue([{ title: "치과", startDate: today, startTime: 15 * 60 }]);
  routineFindMany.mockResolvedValue([]);
  skipFindMany.mockResolvedValue([]);
});

describe("sendDueEventDigests", () => {
  it("때가 된 사람은 먼저 보낸 날을 적고, 오늘 일정을 앱 푸시로만 보낸다", async () => {
    userFindMany.mockResolvedValue([owner()]);
    expect(await sendDueEventDigests(seoul0600)).toBe(1);
    expect(userUpdateMany.mock.calls[0][0].data).toEqual({ eventDigestSentOn: today });
    expect(sendPushToUser).toHaveBeenCalledWith(
      "u1",
      { title: "모도리", body: "오늘 일정 1개 · 치과 15:00", url: "/", tag: "event-digest" },
      { web: false },
    );
  });

  it("그 사람의 오늘에 걸친 일정을 찾는다(여러 날 일정 포함, 반복 일정의 종료일 없음 포함)", async () => {
    userFindMany.mockResolvedValue([owner()]);
    await sendDueEventDigests(seoul0600);
    expect(eventFindMany.mock.calls[0][0].where).toEqual({ userId: "u1", startDate: { lte: today }, endDate: { gte: today } });
    expect(routineFindMany.mock.calls[0][0].where).toMatchObject({ userId: "u1", OR: [{ endDate: null }, { endDate: { gte: today } }] });
  });

  it("일정이 없으면 보내지 않지만 오늘 몫은 적어 1분마다 다시 찾지 않는다", async () => {
    userFindMany.mockResolvedValue([owner()]);
    eventFindMany.mockResolvedValue([]);
    expect(await sendDueEventDigests(seoul0600)).toBe(0);
    expect(userUpdateMany).toHaveBeenCalledTimes(1);
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it("반복 일정도 일정으로 센다", async () => {
    userFindMany.mockResolvedValue([owner()]);
    eventFindMany.mockResolvedValue([]);
    routineFindMany.mockResolvedValue([
      { id: "r1", title: "학원", color: "#fff", startTime: 18 * 60, endTime: null, freq: "DAILY", byWeekday: [], byMonthday: [], startDate: new Date("2026-10-01T00:00:00Z"), endDate: null, pausedAt: null },
    ]);
    expect(await sendDueEventDigests(seoul0600)).toBe(1);
    expect(sendPushToUser.mock.calls[0][1].body).toBe("오늘 일정 1개 · 학원 18:00");
  });

  it("이 날만 뺀 반복 일정은 세지 않는다", async () => {
    userFindMany.mockResolvedValue([owner()]);
    eventFindMany.mockResolvedValue([]);
    routineFindMany.mockResolvedValue([
      { id: "r1", title: "학원", color: "#fff", startTime: 18 * 60, endTime: null, freq: "DAILY", byWeekday: [], byMonthday: [], startDate: new Date("2026-10-01T00:00:00Z"), endDate: null, pausedAt: null },
    ]);
    skipFindMany.mockResolvedValue([{ eventRoutineId: "r1", date: today }]);
    expect(await sendDueEventDigests(seoul0600)).toBe(0);
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it("때가 아니거나, 오늘 보냈거나, 끈 사람에게는 보내지 않는다", async () => {
    userFindMany.mockResolvedValue([
      owner({ id: "early", eventDigestMinute: 8 * 60 }),
      owner({ id: "done", eventDigestSentOn: today }),
      owner({ id: "off", eventDigestMinute: null }),
    ]);
    expect(await sendDueEventDigests(seoul0600)).toBe(0);
    expect(userUpdateMany).not.toHaveBeenCalled();
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it("다른 서버가 먼저 보낸 날을 적었으면(조건부 적기가 0건) 일정을 찾지도 보내지도 않는다", async () => {
    userFindMany.mockResolvedValue([owner()]);
    userUpdateMany.mockResolvedValue({ count: 0 });
    expect(await sendDueEventDigests(seoul0600)).toBe(0);
    expect(eventFindMany).not.toHaveBeenCalled();
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it("조건부로 적을 때 그 사이 시각을 안 바꿨는지도 확인한다", async () => {
    userFindMany.mockResolvedValue([owner()]);
    await sendDueEventDigests(seoul0600);
    expect(userUpdateMany.mock.calls[0][0].where).toMatchObject({ id: "u1", eventDigestMinute: 6 * 60 });
  });

  it("알림을 받을 앱 기기가 있는 사람만 찾는다(웹 푸시 구독은 보지 않는다)", async () => {
    userFindMany.mockResolvedValue([]);
    await sendDueEventDigests(seoul0600);
    const where = userFindMany.mock.calls[0][0].where;
    expect(where.eventDigestMinute).toEqual({ not: null });
    expect(JSON.stringify(where)).toContain("pushTokens");
    expect(JSON.stringify(where)).not.toContain("webPushSubscriptions");
  });
});
