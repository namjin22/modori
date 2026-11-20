import { createServer, type Server } from "node:http";

import { expect, test, type Page } from "@playwright/test";

import { addDays, formatKST, parseKSTDate, todayIn } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { RUN_TAG } from "./run-tag";

// AI 도우미(2026-11-17, docs/decisions.md): 목표를 말하면 AI가 되묻고 할 일·일정을 제안하고, 사용자가 미리보기를 확인해야 저장된다.
// 시험은 진짜 AI 서비스를 부르지 않는다. playwright.config.ts가 시험 서버의 AI_API_BASE를 이 가짜 서버(3199번, OpenAI 호환 chat/completions 모양)로 돌려 두었다.
// 이 파일 안의 시험은 차례대로 돈다(가짜 서버와 보낸 내용 기록을 같이 쓴다).
const PORT = 3199;
const TODAY = formatKST(todayIn("Asia/Seoul"));
const day = (offset: number) => formatKST(addDays(parseKSTDate(TODAY), offset));

// 가짜 서버는 받은 요청(OpenAI 호환 messages)을 예전 기록 모양(system·contents, AI의 말은 role "model")으로 옮겨 적는다. 아래 검사들은 이 모양을 그대로 읽는다.
type Seen = { url: string; model: string; key: string | undefined; system: string; contents: { role: string; parts: { text: string }[] }[] };
type ChatRequest = { model?: string; messages?: { role: string; content: string }[] };
const seen: Seen[] = [];
let server: Server;

/** 보낸 말 속의 표시([질문] 등)로 가짜 답을 고른다. */
function answerFor(lastUser: string): { status: number; body: unknown } {
  const completion = (content: string | null, finishReason: string) => ({ status: 200, body: { choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: finishReason }] } });
  const wrap = (object: unknown) => completion(JSON.stringify(object), "stop");
  if (lastUser.includes("[429]")) return { status: 429, body: { error: { message: "quota" } } };
  if (lastUser.includes("[500]")) return { status: 500, body: { error: { message: "boom" } } };
  // AI 서비스가 모델 이름을 못 찾을 때의 모양. message는 코드에 들어가면 안 된다(우리가 보낸 말을 되풀이할 수 있다).
  if (lastUser.includes("[404]")) return { status: 404, body: { error: { type: "invalid_request_error", code: "model_not_found", message: "The model `비밀모델` does not exist" } } };
  if (lastUser.includes("[막힘]")) return completion(null, "content_filter");
  if (lastUser.includes("[깨짐]")) return completion("그냥 글이에요", "stop");
  if (lastUser.includes("[질문]")) return wrap({ reply: "시험이 언제인가요? 하루에 몇 시간 공부할 수 있나요?", todos: [], events: [] });
  if (lastUser.includes("[위험]")) return wrap({ reply: "이렇게 해 봐요", todos: [{ content: "3일 단식하기", date: day(1), category: null }], events: [] });
  if (lastUser.includes("[거절]")) return wrap({ reply: "그 목표는 몸에 부담이 커서 계획을 짜지 않을게요. 한 달에 2~4kg 정도로 다시 이야기해요.", declined: true, todos: [], events: [] });
  // 세부 할 일(2026-11-20): 큰 할 일 하나에 세부 할 일 셋, 쪼갤 필요 없는 할 일 하나.
  if (lastUser.includes("[세부]")) {
    return wrap({
      reply: "큰 일 밑에 쪼개 봤어요",
      todos: [
        { content: "포트폴리오 완성", date: day(1), category: "공부", subTodos: ["메인 페이지 디자인", "프로젝트 설명 쓰기", "배포하기"] },
        { content: "장보기", date: day(1), category: null },
      ],
      events: [],
    });
  }
  if (lastUser.includes("[꽉참]")) return wrap({ reply: "하나 더 넣어 볼게요", todos: [{ content: "한도 넘는 할 일", date: TODAY, category: null }], events: [] });
  // 기본: 계획 제안(카테고리 "공부" 하나와 없는 카테고리 하나, 일정 하나)
  return wrap({
    reply: "이렇게 짜 봤어요",
    todos: [
      { content: "수학 3단원 풀기", date: day(1), category: "공부" },
      { content: "영어 단어 50개", date: day(2), category: "공부" },
      { content: "독서 30분", date: day(3), category: "없는카테고리" },
    ],
    events: [{ title: "기말고사", startDate: day(5), endDate: day(6), startTime: null, endTime: null }],
  });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf-8") || "{}") as ChatRequest;
      const messages = body.messages ?? [];
      seen.push({
        url: request.url ?? "",
        model: body.model ?? "",
        key: request.headers.authorization?.replace(/^Bearer /, ""),
        system: messages.filter((message) => message.role === "system").map((message) => message.content).join(""),
        contents: messages
          .filter((message) => message.role !== "system")
          .map((message) => ({ role: message.role === "assistant" ? "model" : message.role, parts: [{ text: message.content }] })),
      });
      const last = messages.at(-1)?.content ?? "";
      const answer = answerFor(last);
      response.writeHead(answer.status, { "content-type": "application/json" });
      response.end(JSON.stringify(answer.body));
    });
  });
  await new Promise<void>((resolve) => server.listen(PORT, "127.0.0.1", resolve));
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

const emails: string[] = [];

test.afterEach(async () => {
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  emails.length = 0;
});

/** 가입을 마친 계정을 바로 만들고 로그인한다(카테고리 "공부"는 공개, "비공개"는 비공개). */
async function makeUser(page: Page, label: string, options: { consented?: boolean } = {}) {
  const email = `e2e-ai-${label}-${RUN_TAG}@modori.test`;
  emails.push(email);
  await prisma.user.deleteMany({ where: { email } });
  const user = await prisma.user.create({
    data: { email, nickname: `ai${label}${RUN_TAG}`, privacyAgreedAt: new Date(), tutorialSeenAt: new Date(), aiChatConsentAt: options.consented === false ? null : new Date() },
  });
  const study = await prisma.category.create({ data: { userId: user.id, name: "공부", color: "#2563eb", order: 0 } });
  const secret = await prisma.category.create({ data: { userId: user.id, name: "비공개", color: "#ef4444", order: 1, isPublic: false } });
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await expect(page).toHaveURL(/\/$/);
  return { user, study, secret };
}

const input = (page: Page) => page.getByLabel("AI에게 보낼 말");
async function say(page: Page, text: string) {
  await input(page).fill(text);
  await page.getByRole("button", { name: "보내기", exact: true }).click();
}

test("동의하기 전에는 대화창이 열리지 않고 내 데이터가 나가지 않는다. 동의하면 열린다", async ({ page, request }) => {
  const { user } = await makeUser(page, "consent", { consented: false });
  const before = seen.length;

  // 홈의 "AI 도우미" 버튼으로 들어간다.
  await page.getByRole("link", { name: "AI 도우미" }).click();
  await expect(page).toHaveURL(/\/ai$/);
  await expect(page.getByRole("heading", { level: 1, name: "AI 도우미" })).toBeVisible();
  // 건강 안내는 늘 보인다.
  await expect(page.getByRole("note").filter({ hasText: "AI는 틀릴 수 있어요" })).toBeVisible();

  // 무엇이 어디로 가는지 먼저 보이고, 동의해야 시작할 수 있다.
  await expect(page.getByRole("heading", { name: "시작하기 전에 알려 드려요" })).toBeVisible();
  await expect(page.getByText("Cloudflare의 Workers AI로 전송돼요")).toBeVisible();
  await expect(page.getByText("AI 모델 학습에 쓰지 않고, 처리가 끝나면 보관하지 않는다고 밝혀요")).toBeVisible();
  await expect(page.getByText("메모와 친구 정보는 보내지 않아요")).toBeVisible();
  await expect(input(page)).toHaveCount(0);
  const start = page.getByRole("button", { name: "동의하고 시작하기" });
  await expect(start).toBeDisabled();

  // 동의 없이 서버를 직접 불러도 막힌다(AI에게 아무것도 가지 않는다).
  const blocked = await page.request.post("/api/ai/chat", { data: { messages: [{ role: "user", text: "안녕" }] } });
  expect(blocked.status()).toBe(403);
  expect(seen.length).toBe(before);
  // 로그인하지 않은 요청은 401.
  expect((await request.post("/api/ai/chat", { data: { messages: [{ role: "user", text: "안녕" }] } })).status()).toBe(401);

  await page.getByRole("checkbox", { name: "위 내용을 읽었고 동의해요" }).check();
  await start.click();
  await expect(input(page)).toBeVisible();
  expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).aiChatConsentAt).not.toBeNull();
});

test("목표를 말하면 제안이 미리보기로 뜨고, 골라서 넣으면 저장되며, 되돌릴 수 있다. AI에게는 메모가 가지 않는다", async ({ page }) => {
  const { user, study, secret } = await makeUser(page, "plan");
  const other = await prisma.user.create({ data: { email: `e2e-ai-other-${RUN_TAG}@modori.test`, nickname: `ai남${RUN_TAG}`, privacyAgreedAt: new Date() } });
  emails.push(other.email ?? "");
  await prisma.todo.createMany({
    data: [
      { userId: user.id, content: "수학 문제집 3장", date: parseKSTDate(TODAY), categoryId: study.id, memo: "비밀메모ABC" },
      { userId: user.id, content: "일기 대신 산책", date: parseKSTDate(TODAY), categoryId: secret.id },
      { userId: other.id, content: "남의 비밀 할 일", date: parseKSTDate(TODAY) },
    ],
  });
  await prisma.event.create({ data: { userId: user.id, title: "동아리 모임", startDate: parseKSTDate(TODAY), endDate: parseKSTDate(TODAY), startTime: 16 * 60 + 30, endTime: 18 * 60, color: "#2563eb", memo: "일정비밀메모" } });

  await page.goto("/ai");
  await say(page, "다음 주 기말고사 준비 계획을 짜 줘");
  const card = page.getByRole("region", { name: "이렇게 넣을까요?" });
  await expect(card).toBeVisible();
  await expect(page.getByText("이렇게 짜 봤어요")).toBeVisible();
  // 미리보기: 할 일 셋(없는 카테고리는 "카테고리 없음"), 일정 하나.
  await expect(card.getByRole("checkbox")).toHaveCount(4);
  await expect(card.getByText("공부", { exact: false }).first()).toBeVisible();
  await expect(card.getByText("카테고리 없음")).toBeVisible();
  // 아직 저장되지 않았다.
  expect(await prisma.todo.count({ where: { userId: user.id, content: "수학 3단원 풀기" } })).toBe(0);

  // AI에게 간 것: 키·모델, 이번 달 내 데이터, 같은 말. 메모·남의 데이터는 없다. 비공개 카테고리의 할 일은 운영자가 정한 대로 들어간다.
  const sent = seen.at(-1);
  expect(sent?.key).toBe("e2e-fake-key");
  expect(sent?.url).toBe("/ai/v1/chat/completions");
  expect(sent?.model).toBe("fake-model");
  expect(sent?.system).toContain(`오늘은 ${TODAY}(Asia/Seoul)`);
  expect(sent?.system).toContain("수학 문제집 3장");
  expect(sent?.system).toContain("동아리 모임");
  expect(sent?.system).toContain("[카테고리] 공부, 비공개");
  expect(sent?.system).toContain("일기 대신 산책");
  expect(sent?.system).not.toContain("비밀메모ABC");
  expect(sent?.system).not.toContain("일정비밀메모");
  expect(sent?.system).not.toContain("남의 비밀 할 일");
  expect(sent?.system).not.toContain(user.email ?? "@");
  expect(sent?.contents).toEqual([{ role: "user", parts: [{ text: "다음 주 기말고사 준비 계획을 짜 줘" }] }]);

  // 이어서 말하면 지금까지의 대화가 같이 간다(AI의 말은 model).
  await say(page, "[질문] 더 자세히");
  await expect(page.getByText("시험이 언제인가요?")).toBeVisible();
  expect(seen.at(-1)?.contents.map((message) => message.role)).toEqual(["user", "model", "user"]);

  // 영어 단어는 빼고 넣는다.
  await card.getByRole("checkbox", { name: /영어 단어 50개/ }).uncheck();
  await card.getByRole("button", { name: "모도리에 넣기 (3)" }).click();
  await expect(card.getByText("할 일 2개, 일정 1개를 넣었어요.")).toBeVisible();

  const todos = await prisma.todo.findMany({ where: { userId: user.id, content: { in: ["수학 3단원 풀기", "독서 30분", "영어 단어 50개"] } }, orderBy: { date: "asc" } });
  expect(todos.map((todo) => [todo.content, formatKST(todo.date), todo.categoryId])).toEqual([
    ["수학 3단원 풀기", day(1), study.id],
    ["독서 30분", day(3), null],
  ]);
  // AI가 만든 일정은 기본 비공개다.
  const events = await prisma.event.findMany({ where: { userId: user.id, title: "기말고사" } });
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ isPublic: false, memoPublic: false });
  expect([formatKST(events[0].startDate), formatKST(events[0].endDate)]).toEqual([day(5), day(6)]);

  // 홈에 보인다. 되돌리면 사라진다.
  await card.getByRole("button", { name: "되돌리기" }).click();
  await expect(card.getByText("되돌렸어요.")).toBeVisible();
  expect(await prisma.todo.count({ where: { userId: user.id, content: { in: ["수학 3단원 풀기", "독서 30분"] } } })).toBe(0);
  expect(await prisma.event.count({ where: { userId: user.id, title: "기말고사" } })).toBe(0);
  // 원래 있던 것은 그대로다.
  expect(await prisma.todo.count({ where: { userId: user.id, content: "수학 문제집 3장" } })).toBe(1);
});

test("되묻는 답에는 제안 상자가 없고, 극단적인 제안은 버려지며, 거절하는 답은 그대로 보인다", async ({ page }) => {
  const { user } = await makeUser(page, "safety");
  await page.goto("/ai");

  await say(page, "[질문] 시험 공부 계획");
  await expect(page.getByText("시험이 언제인가요?")).toBeVisible();
  await expect(page.getByRole("region", { name: "이렇게 넣을까요?" })).toHaveCount(0);

  // AI가 단식 같은 계획을 제안해도 화면에 나오지 않는다. 고정 안내만 보인다.
  await say(page, "[위험] 일주일에 5kg 빼고 싶어");
  await expect(page.getByText("몸에 부담이 큰 방법이 들어 있어서 이 계획은 넣을 수 없어요")).toBeVisible();
  await expect(page.getByText("3일 단식하기")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "이렇게 넣을까요?" })).toHaveCount(0);

  await say(page, "[거절] 한 달에 10kg 빼고 싶어");
  await expect(page.getByText("한 달에 2~4kg 정도로 다시 이야기해요")).toBeVisible();
  await expect(page.getByRole("region", { name: "이렇게 넣을까요?" })).toHaveCount(0);
  // 건강 안내는 대화 중에도 계속 보인다.
  await expect(page.getByRole("note").filter({ hasText: "의사와 먼저 상의하세요" })).toBeVisible();
  expect(await prisma.todo.count({ where: { userId: user.id } })).toBe(0);
});

test("AI 서비스가 막히거나 실패하면 이유를 알려 주고, 저장되는 것은 없다", async ({ page }) => {
  const { user } = await makeUser(page, "errors");
  await page.goto("/ai");

  for (const [mark, message] of [
    ["[429]", "지금 이용자가 많아요"],
    ["[500]", "AI 서비스에 연결하지 못했어요"],
    ["[막힘]", "이 내용은 답할 수 없어요"],
    ["[깨짐]", "답을 이해하지 못했어요"],
  ] as const) {
    await say(page, `${mark} 안녕`);
    await expect(page.getByText(message)).toBeVisible();
  }
  // 원인을 가리키는 코드가 같이 보인다(2026-11-18: 키를 넣고도 "보내지 못했어요"만 나와 이유를 알 수 없었다).
  await expect(page.getByText("오류 코드: http-500")).toBeVisible();
  await expect(page.getByText("오류 코드: http-429")).toBeVisible();
  // 오류 말풍선은 대화로 다시 보내지 않는다(AI가 한 말이 아니다).
  await say(page, "[질문] 다시");
  const last = seen.at(-1)?.contents.map((message) => message.parts[0].text) ?? [];
  expect(last.filter((text) => text.includes("이용자가 많아요") || text.includes("연결하지 못했어요"))).toEqual([]);
  expect(await prisma.todo.count({ where: { userId: user.id } })).toBe(0);
});

test("짧은 시간에 너무 많이 보내면 막힌다(AI에게 가지 않는다)", async ({ page }) => {
  await makeUser(page, "burst");
  await page.goto("/ai");
  const before = seen.length;
  const results: number[] = [];
  for (let index = 0; index < 7; index += 1) {
    const response = await page.request.post("/api/ai/chat", { data: { messages: [{ role: "user", text: `[질문] ${index}` }] } });
    results.push(response.status());
  }
  expect(results.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
  expect(results.slice(5)).toEqual([429, 429]);
  expect(seen.length - before).toBe(5);
  expect(await (await page.request.post("/api/ai/chat", { data: { messages: [{ role: "user", text: "x" }] } })).json()).toMatchObject({ ok: false, error: "limit-burst" });
});

test("서버는 제안을 다시 검사한다: 하루 50개를 넘으면 아무것도 넣지 않는다. 잘못된 요청은 거절한다", async ({ page }) => {
  const { user } = await makeUser(page, "limit");
  await prisma.todo.createMany({ data: Array.from({ length: 50 }, (_, index) => ({ userId: user.id, content: `채움 ${index}`, date: parseKSTDate(TODAY), order: index })) });
  await page.goto("/ai");

  await say(page, "[꽉참] 하나 더");
  const card = page.getByRole("region", { name: "이렇게 넣을까요?" });
  await card.getByRole("button", { name: "모도리에 넣기 (1)" }).click();
  await expect(card.getByRole("alert")).toContainText("넣지 못했어요");
  expect(await prisma.todo.count({ where: { userId: user.id } })).toBe(50);

  // 형식이 틀린 요청·너무 긴 요청.
  expect((await page.request.post("/api/ai/chat", { data: { messages: [] } })).status()).toBe(400);
  expect((await page.request.post("/api/ai/chat", { data: { messages: [{ role: "model", text: "x" }] } })).status()).toBe(400);
  expect((await page.request.post("/api/ai/chat", { data: "이건 JSON이 아니다", headers: { "content-type": "text/plain" } })).status()).toBe(400);
  expect((await page.request.post("/api/ai/chat", { data: { messages: [{ role: "user", text: "가".repeat(90_000) }] } })).status()).toBe(413);
});

test("AI 서비스가 거절하면 원인 코드가 보이고(서버는 502가 아니라 200으로 알린다), 다시 보내기는 내 말을 두 번 쌓지 않는다", async ({ page }) => {
  await makeUser(page, "code");
  await page.goto("/ai");

  await say(page, "[404] 모델 없음");
  // 상태 숫자와 우리가 붙인 영문 상태 이름만 코드에 들어간다. 오류 본문의 message(보낸 말을 되풀이할 수 있다)는 들어가지 않는다.
  await expect(page.getByText("오류 코드: http-404-NOT_FOUND")).toBeVisible();
  await expect(page.getByText("비밀모델")).toHaveCount(0);
  await expect(page.getByText("AI 서비스에 연결하지 못했어요")).toBeVisible();

  // 다시 보내기: 오류 말풍선을 치우고 같은 말을 다시 보낸다. 내 말은 한 번만 보인다.
  const before = seen.length;
  await page.getByRole("button", { name: "다시 보내기" }).click();
  await expect(page.getByText("오류 코드: http-404-NOT_FOUND")).toBeVisible();
  expect(seen.length - before).toBe(1);
  await expect(page.getByText("[404] 모델 없음", { exact: true })).toHaveCount(1);
  expect(seen.at(-1)?.contents.map((message) => message.role)).toEqual(["user"]);

  // 앞단(Cloudflare)이 502·504의 본문을 바꿔 버려도 이유가 보이도록, 서비스 쪽 실패는 200에 JSON으로 돌려준다.
  const direct = await page.request.post("/api/ai/chat", { data: { messages: [{ role: "user", text: "[404] 직접" }] } });
  expect(direct.status()).toBe(200);
  expect(await direct.json()).toEqual({ ok: false, error: "unavailable", code: "http-404-NOT_FOUND" });
});

test("AI가 세부 할 일까지 제안하면 미리보기에 큰 할 일 밑으로 보이고, 넣으면 같은 날·카테고리에 달리며, 되돌리면 함께 사라진다. 세부 관계는 AI에게 제목만 간다", async ({ page }) => {
  const { user, study } = await makeUser(page, "sub");
  // 이번 달에 이미 세부 할 일이 하나 있다: AI에게는 위 할 일의 제목만 같이 간다(메모는 가지 않는다).
  const big = await prisma.todo.create({ data: { userId: user.id, content: "기존 큰 일", date: parseKSTDate(TODAY), categoryId: study.id, order: 0, memo: "큰일비밀메모" } });
  await prisma.todo.create({ data: { userId: user.id, content: "기존 세부 일", date: parseKSTDate(TODAY), categoryId: study.id, order: 1, parentId: big.id, memo: "세부비밀메모" } });

  await page.goto("/ai");
  await say(page, "[세부] 포트폴리오 쪼개 줘");
  const card = page.getByRole("region", { name: "이렇게 넣을까요?" });
  await expect(card).toBeVisible();
  // 고르는 칸은 큰 할 일 둘뿐이고, 세부 할 일 셋은 큰 할 일 밑에 들여 보인다.
  await expect(card.getByRole("checkbox")).toHaveCount(2);
  const subs = card.getByRole("list", { name: "세부 할 일" });
  await expect(subs.getByRole("listitem")).toHaveText(["메인 페이지 디자인", "프로젝트 설명 쓰기", "배포하기"]);
  await expect(card.getByRole("button", { name: "모도리에 넣기 (5)" })).toBeVisible();
  expect(await prisma.todo.count({ where: { userId: user.id, content: "메인 페이지 디자인" } })).toBe(0);

  const sent = seen.at(-1);
  expect(sent?.system).toContain("기존 세부 일 [공부] (세부 할 일, 위 할 일: 기존 큰 일)");
  expect(sent?.system).not.toContain("큰일비밀메모");
  expect(sent?.system).not.toContain("세부비밀메모");
  expect(sent?.system).toContain("subTodos");

  await card.getByRole("button", { name: "모도리에 넣기 (5)" }).click();
  await expect(card.getByRole("status")).toContainText("할 일 5개(세부 할 일 3개 포함), 일정 0개를 넣었어요.");

  const parent = await prisma.todo.findFirstOrThrow({ where: { userId: user.id, content: "포트폴리오 완성" } });
  const kids = await prisma.todo.findMany({ where: { userId: user.id, parentId: parent.id }, orderBy: { order: "asc" } });
  expect(kids.map((kid) => kid.content)).toEqual(["메인 페이지 디자인", "프로젝트 설명 쓰기", "배포하기"]);
  for (const kid of kids) {
    expect(kid.categoryId).toBe(study.id);
    expect(kid.date.getTime()).toBe(parent.date.getTime());
  }
  expect((await prisma.todo.findFirstOrThrow({ where: { userId: user.id, content: "장보기" } })).parentId).toBeNull();

  // 되돌리면 큰 할 일과 세부 할 일이 함께 사라진다(처음부터 있던 두 개만 남는다).
  await card.getByRole("button", { name: "되돌리기" }).click();
  await expect(card.getByText("되돌렸어요.")).toBeVisible();
  expect(await prisma.todo.count({ where: { userId: user.id } })).toBe(2);
});

test("세부 할 일까지 넣으면 하루 상한(50개)을 넘을 때는 큰 할 일도 남기지 않고 아무것도 넣지 않는다", async ({ page }) => {
  const { user } = await makeUser(page, "subfull");
  // 내일이 47개: 큰 할 일 둘(49개)은 들어가도 세부 할 일 셋(52개)은 안 들어간다.
  await prisma.todo.createMany({ data: Array.from({ length: 47 }, (_, index) => ({ userId: user.id, content: `채움 ${index}`, date: parseKSTDate(day(1)), order: index })) });
  await page.goto("/ai");
  await say(page, "[세부] 상한 시험");
  const card = page.getByRole("region", { name: "이렇게 넣을까요?" });
  await card.getByRole("button", { name: "모도리에 넣기 (5)" }).click();
  await expect(card.getByRole("alert")).toContainText("넣지 못했어요");
  await expect.poll(() => prisma.todo.count({ where: { userId: user.id } })).toBe(47);
  expect(await prisma.todo.count({ where: { userId: user.id, content: "포트폴리오 완성" } })).toBe(0);
});
