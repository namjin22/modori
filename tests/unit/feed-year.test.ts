import { isValidElement, type ReactElement, type ReactNode } from "react";
import { expect, it, vi } from "vitest";

import FeedPage from "@/app/(tabs)/feed/page";
import { FeedItem } from "@/components/feed-item";
import { parseKSTDate } from "@/lib/date";

const { findTodos } = vi.hoisted(() => ({ findTodos: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    todo: { findMany: findTodos },
    follow: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(1) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock("@/lib/session", () => ({
  requireUser: vi.fn().mockResolvedValue({ id: "viewer", lastSeenAt: null }),
  countUnreadNotifications: vi.fn().mockResolvedValue(0),
}));
vi.mock("@/lib/avatar", () => ({ avatarUrl: () => null }));
vi.mock("@/components/avatar", () => ({ Avatar: () => null }));
vi.mock("@/components/dori", () => ({ Dori: () => null }));
vi.mock("@/components/feed-item", () => ({ FeedItem: () => null }));

function elements(node: ReactNode): ReactElement<{ children?: ReactNode; className?: string }>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<{ children?: ReactNode; className?: string }>(node)) return [];
  return [node, ...elements(node.props.children)];
}

it("keeps adjacent same-author cards separate across years without splitting the same date", async () => {
  const author = { id: "friend", nickname: "친구" };
  const todo = (id: string, day: string) => ({
    id, date: parseKSTDate(day), doneAt: new Date("2026-09-29T00:00:00Z"),
    user: author, content: id, color: null, category: { name: "공부", color: "#2563eb" }, reactions: [],
  });
  findTodos.mockResolvedValue([
    todo("new", "2026-09-28"),
    todo("old-1", "2025-09-28"),
    todo("old-2", "2025-09-28"),
    todo("older", "2024-09-28"),
  ]);

  const page = await FeedPage({ searchParams: Promise.resolve({}) });
  const cards = elements(page).filter((element) =>
    element.type === "li" && element.props.className?.includes("rounded-2xl bg-surface px-4"),
  );
  expect(cards.map((card) => ({
    date: elements(card).find((element) => element.props.className === "text-xs text-muted")?.props.children,
    ids: elements(card).filter((element) => element.type === FeedItem).map((element) =>
      (element.props as { todo: { id: string } }).todo.id,
    ),
  }))).toEqual([
    { date: "9월 28일", ids: ["new"] },
    { date: "9월 28일", ids: ["old-1", "old-2"] },
    { date: "9월 28일", ids: ["older"] },
  ]);
});
