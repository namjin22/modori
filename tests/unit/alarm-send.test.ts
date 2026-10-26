// 때가 된 알림 보내기(lib/alarm-send.ts): 보낼 차례인 것만, 먼저 "보낸 날"을 조건부로 적은 것만 보낸다.
import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const updateMany = vi.fn();
const sendPushToUser = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: { alarm: { findMany: (...a: unknown[]) => findMany(...a), updateMany: (...a: unknown[]) => updateMany(...a) } } }));
vi.mock("@/lib/push", () => ({ sendPushToUser: (...a: unknown[]) => sendPushToUser(...a) }));

import { sendDueAlarms } from "@/lib/alarm-send";

const seoul0700 = new Date("2026-10-25T22:00:00Z"); // 서울 2026-10-26(월) 07:00
const alarm = (overrides: Record<string, unknown> = {}) => ({
  id: "a1",
  minute: 7 * 60,
  weekdays: [],
  message: "물 마시기",
  lastSentOn: null,
  user: { id: "u1", timezone: "Asia/Seoul" },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  updateMany.mockResolvedValue({ count: 1 });
});

describe("sendDueAlarms", () => {
  it("때가 된 알림은 먼저 보낸 날을 적고, 내가 쓴 문구로 그 사람에게 푸시를 보낸다", async () => {
    findMany.mockResolvedValue([alarm()]);
    expect(await sendDueAlarms(seoul0700)).toBe(1);
    expect(updateMany.mock.calls[0][0].data).toEqual({ lastSentOn: new Date("2026-10-26T00:00:00Z") });
    expect(sendPushToUser).toHaveBeenCalledWith("u1", { title: "모도리", body: "물 마시기", url: "/", tag: "alarm:a1" });
  });

  it("때가 아니거나, 오늘 보냈거나, 다른 요일이면 보내지 않는다", async () => {
    findMany.mockResolvedValue([
      alarm({ id: "early", minute: 8 * 60 }),
      alarm({ id: "done", lastSentOn: new Date("2026-10-26T00:00:00Z") }),
      alarm({ id: "tuesday", weekdays: [2] }),
    ]);
    expect(await sendDueAlarms(seoul0700)).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it("다른 서버가 먼저 보낸 날을 적었으면(조건부 적기가 0건) 보내지 않는다", async () => {
    findMany.mockResolvedValue([alarm()]);
    updateMany.mockResolvedValue({ count: 0 });
    expect(await sendDueAlarms(seoul0700)).toBe(0);
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it("조건부로 적을 때 켜져 있는지, 그 사이 시각을 안 바꿨는지도 확인한다", async () => {
    findMany.mockResolvedValue([alarm()]);
    await sendDueAlarms(seoul0700);
    const where = updateMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ id: "a1", enabled: true, minute: 7 * 60 });
  });

  it("받을 기기가 있는 사람의 켜진 알림만 찾는다", async () => {
    findMany.mockResolvedValue([]);
    await sendDueAlarms(seoul0700);
    const where = findMany.mock.calls[0][0].where;
    expect(where.enabled).toBe(true);
    expect(JSON.stringify(where.user)).toContain("pushTokens");
    expect(JSON.stringify(where.user)).toContain("webPushSubscriptions");
  });
});
