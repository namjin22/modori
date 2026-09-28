import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addDays, parseKSTDate } from "@/lib/date";

const db = vi.hoisted(() => ({
  findUnique: vi.fn(),
  deleteActiveDays: vi.fn(),
  deleteSessions: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    dailyStat: { findUnique: db.findUnique },
    activeDay: { deleteMany: db.deleteActiveDays },
    session: { deleteMany: db.deleteSessions },
  },
}));

const today = parseKSTDate("2026-09-28");
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-28T03:00:00Z"));
  db.findUnique.mockResolvedValue({ date: addDays(today, -1) });
  db.deleteActiveDays.mockResolvedValue({ count: 0 });
  db.deleteSessions.mockResolvedValue({ count: 0 });
});
afterEach(() => vi.useRealTimers());

describe("ActiveDay 90-day retention", () => {
  it("keeps today through day 89 inclusive and deletes day 90 and older", async () => {
    const { runDailyOnce } = await import("@/lib/daily");
    await runDailyOnce();

    const cutoff = db.deleteActiveDays.mock.calls[0]?.[0]?.where.date.lt as Date;
    expect(db.deleteActiveDays).toHaveBeenCalledTimes(1);
    expect(cutoff).toEqual(addDays(today, -89));
    expect([today, addDays(today, -89)].every((day) => day >= cutoff)).toBe(true);
    expect([90, 91].every((age) => addDays(today, -age) < cutoff)).toBe(true);
  });

  it("still removes expired days if the snapshot lookup fails", async () => {
    db.findUnique.mockRejectedValue(new Error("snapshot unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { runDailyOnce } = await import("@/lib/daily");
      await runDailyOnce();
      expect(db.deleteActiveDays).toHaveBeenCalledWith({ where: { date: { lt: addDays(today, -89) } } });
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it("retries a failed cleanup on another request the same day without repeating the snapshot or session cleanup", async () => {
    db.deleteActiveDays.mockRejectedValueOnce(new Error("cleanup unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { runDailyOnce } = await import("@/lib/daily");
      await runDailyOnce();
      expect(db.deleteActiveDays).toHaveBeenCalledTimes(1);
      await runDailyOnce();
      expect(db.deleteActiveDays).toHaveBeenCalledTimes(2);
      expect(db.deleteActiveDays).toHaveBeenLastCalledWith({ where: { date: { lt: addDays(today, -89) } } });
      expect(db.findUnique).toHaveBeenCalledTimes(1);
      expect(db.deleteSessions).toHaveBeenCalledTimes(1);
      await runDailyOnce();
      expect(db.deleteActiveDays).toHaveBeenCalledTimes(2);
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
