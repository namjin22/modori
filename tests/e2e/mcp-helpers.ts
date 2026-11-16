import { test as base, type APIRequestContext } from "@playwright/test";

import { generateApiToken } from "@/lib/api-token-secret";
import { addDays, formatKST, parseKSTDate, todayIn } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";

// 모도리의 MCP 서버(docs/mcp.md)를 시험하는 파일들이 같이 쓰는 도구. 이 시험이 MCP 클라이언트 역할을 한다(JSON-RPC를 직접 보낸다).
export type Account = { id: string; email: string; nickname: string; tag: string };

export type Rpc = {
  status: number;
  body: { result?: { content?: { text: string }[]; isError?: boolean; tools?: { name: string }[] }; error?: { message: string } };
};

/** 시험마다 새 계정 하나를 만들고 끝나면 지운다(계정을 지우면 딸린 것이 모두 지워진다). */
export const test = base.extend<{ account: Account }>({
  account: async ({}, provide, testInfo) => {
    const tag = `${testInfo.testId.slice(-6)}${RUN_TAG}`;
    const email = `e2e-mcpf-${tag}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    const user = await prisma.user.create({ data: { email, nickname: `엠${tag}`, privacyAgreedAt: new Date() } });
    await provide({ id: user.id, email, nickname: user.nickname ?? "", tag });
    await prisma.user.deleteMany({ where: { email } });
  },
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

export const TODAY = formatKST(todayIn("Asia/Seoul"));
export const day = (offset: number) => formatKST(addDays(parseKSTDate(TODAY), offset));

export async function makeToken(userId: string, scope: "READ" | "WRITE" | "FULL", options: { allowFriends?: boolean; expiresAt?: Date } = {}) {
  const { token, hash, hint } = generateApiToken();
  const row = await prisma.apiToken.create({
    data: { userId, name: "시험", scope, tokenHash: hash, hint, expiresAt: options.expiresAt ?? new Date(Date.now() + 30 * 86_400_000), allowFriends: options.allowFriends ?? false },
  });
  return { token, id: row.id };
}

export async function rpc(request: APIRequestContext, token: string | null, method: string, params?: unknown): Promise<Rpc> {
  const response = await request.post("/mcp", {
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    data: { jsonrpc: "2.0", id: 1, method, params },
  });
  const text = await response.text();
  return { status: response.status(), body: text ? JSON.parse(text) : {} };
}

/** 도구를 부르고 결과 글(JSON)을 풀어 준다. 도구가 거절했거나 검증에서 막혔으면 failed. */
export async function call(request: APIRequestContext, token: string, name: string, args: unknown) {
  const { status, body } = await rpc(request, token, "tools/call", { name, arguments: args });
  const text = body.result?.content?.[0]?.text;
  const failed = status !== 200 || body.error !== undefined || body.result?.isError === true;
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text ?? body.error?.message ?? "" };
  }
  return { failed, data, raw: text ?? body.error?.message ?? "" };
}

export async function toolNames(request: APIRequestContext, token: string): Promise<string[]> {
  const list = await rpc(request, token, "tools/list");
  return (list.body.result?.tools ?? []).map((tool) => tool.name).sort();
}

export function seedTodo(userId: string, date: string, content: string, extra: { order?: number; categoryId?: string; done?: boolean; memo?: string } = {}) {
  return prisma.todo.create({ data: { userId, content, date: parseKSTDate(date), order: extra.order ?? 0, categoryId: extra.categoryId, done: extra.done ?? false, memo: extra.memo } });
}

/** 다른 사람 한 명. 시험이 끝나면 호출하는 쪽이 지운다(deleteOther). */
export async function makeOther(tag: string, label: string) {
  // 실행마다 다른 꼬리표(RUN_TAG)를 붙인다. 앞선 실행이 시간 초과로 정리하지 못한 계정과 겹치지 않게.
  return prisma.user.create({ data: { email: `e2e-mcpf-${label}-${tag}-${RUN_TAG}@modori.test`, nickname: `${label}${tag}${RUN_TAG}`, privacyAgreedAt: new Date() } });
}

export const deleteOther = (id: string) => prisma.user.deleteMany({ where: { id } });
