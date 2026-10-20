import { crc32, deflateSync } from "node:zlib";

import { expect, test as base, type Page } from "@playwright/test";

import { todayKST } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";
import { RUN_TAG } from "./run-tag";

// 공개 피드(2026-10-19): 모르는 사람도 보는 "끝낸 할 일 + 짧은 글", 이모지 반응, 신고·차단·운영자 숨김. 시험 서버는 PUBLIC_FEED=on으로 연다.
const test = base.extend<{ emails: { me: string; stranger: string } }>({
  emails: async ({}, provide, testInfo) => {
    const tag = testInfo.testId.slice(-6);
    const emails = { me: `e2e-pub-me-${tag}-${RUN_TAG}@modori.test`, stranger: `e2e-pub-you-${tag}-${RUN_TAG}@modori.test` };
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await provide(emails);
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
  },
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function signUp(page: Page, email: string, nickname: string) {
  await page.goto("/login");
  await page.getByLabel("테스트 이메일").fill(email);
  await page.getByRole("button", { name: "테스트 로그인" }).click();
  await page.getByPlaceholder("닉네임").fill(nickname);
  await page.getByLabel("개인정보 수집·이용에 동의해요").check();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(homeReady(page)).toBeVisible();
}

/** 팔로우하지 않은 사람이 오늘 끝낸 할 일로 글을 올려 둔다. */
async function strangerWithPost(email: string, nickname: string, body: string) {
  const stranger = await prisma.user.create({
    data: { email, nickname, categories: { create: { name: "공부", color: "#2563eb", order: 0 } } },
    include: { categories: true },
  });
  const post = await prisma.post.create({ data: { userId: stranger.id, todoContent: "모르는 사람이 끝낸 일", todoColor: "#22c55e", body } });
  return { stranger, post };
}

test("오늘 끝낸 할 일과 짧은 글을 올리면 공개 피드(모두) 맨 위에 뜨고, 내 글은 지울 수 있다", async ({ page, emails }, testInfo) => {
  const tag = testInfo.testId.slice(-6);
  await signUp(page, emails.me, `나피${tag}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email: emails.me }, include: { categories: true } });
  await prisma.todo.create({ data: { userId: me.id, categoryId: me.categories[0].id, date: todayKST(), content: "수학 3장 끝", done: true, doneAt: new Date(), order: 0 } });

  // 하단 탭은 화면을 미리 받아 둔다. DB에 직접 넣은 할 일이 보이게 홈을 다시 연다(화면에서 체크하면 저절로 비워진다).
  await page.reload();
  // 하단 소셜 탭은 공개 피드(모두)부터 연다. 위에 [모두 | 내 친구] 탭이 있다.
  await page.getByRole("link", { name: "소셜", exact: true }).click();
  await expect(page).toHaveURL(/\/feed\/public$/);
  await expect(page.getByRole("navigation", { name: "소셜 보기" }).getByRole("link", { name: "모두", exact: true })).toHaveAttribute("aria-current", "page");

  const composer = page.getByRole("form", { name: "피드에 올리기" });
  await expect(composer.getByRole("radio", { name: /수학 3장 끝/ })).toHaveAttribute("aria-checked", "true");
  await composer.getByLabel("피드 글").fill("오늘은 집중이 잘 됐다");
  await composer.getByRole("button", { name: "올리기" }).click();
  await expect(composer.getByRole("status")).toHaveText("피드에 올렸어요.");

  const feed = page.getByRole("list", { name: "피드 글" });
  const first = feed.getByRole("listitem").first();
  await expect(first).toContainText("수학 3장 끝");
  await expect(first).toContainText("오늘은 집중이 잘 됐다");
  await first.getByRole("button", { name: "지우기" }).click();
  await expect.poll(async () => prisma.post.count({ where: { userId: me.id } })).toBe(0);

  // 내 친구 탭은 예전 소셜 화면이다.
  await page.getByRole("navigation", { name: "소셜 보기" }).getByRole("link", { name: "내 친구" }).click();
  await expect(page).toHaveURL(/\/feed$/);
});

test("모르는 사람의 글을 보고 반응하고 신고하면 그 글이 신고에 남는다. 차단하거나 운영자가 숨기면 사라진다", async ({ page, emails }, testInfo) => {
  const tag = testInfo.testId.slice(-6);
  await signUp(page, emails.me, `나신${tag}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email: emails.me } });
  const { stranger, post } = await strangerWithPost(emails.stranger, `남${tag}${RUN_TAG}`, "처음 보는 사람의 글");

  await page.goto("/feed/public");
  const card = page.getByRole("list", { name: "피드 글" }).getByRole("listitem").filter({ hasText: "처음 보는 사람의 글" });
  await expect(card).toBeVisible();

  // 이모지 반응
  await card.getByRole("button", { name: "반응 보내기" }).click();
  await page.getByRole("tab", { name: "이모지" }).click();
  await page.getByRole("button", { name: "좋아요" }).click();
  await expect.poll(async () => prisma.postReaction.count({ where: { postId: post.id, userId: me.id } })).toBe(1);

  // 신고하면 그 글이 같이 남는다.
  await card.getByRole("button", { name: /신고·차단$/ }).click();
  await page.getByRole("button", { name: "신고하기", exact: true }).click();
  await page.getByLabel("스팸·광고").check();
  await page.getByRole("dialog").getByRole("button", { name: "신고하기", exact: true }).click();
  await expect(page.getByText("신고했어요. 운영자가 확인할게요.")).toBeVisible();
  expect((await prisma.report.findFirstOrThrow({ where: { reporterId: me.id, reportedId: stranger.id } })).postId).toBe(post.id);

  // 운영자가 숨기면 보이지 않는다.
  await prisma.post.update({ where: { id: post.id }, data: { hiddenAt: new Date() } });
  await page.reload();
  await expect(page.getByText("처음 보는 사람의 글")).toHaveCount(0);

  // 차단한 사람의 글도 보이지 않는다.
  const second = await prisma.post.create({ data: { userId: stranger.id, todoContent: "또 끝낸 일", body: "두 번째 글" } });
  await page.reload();
  await expect(page.getByText("두 번째 글")).toBeVisible();
  await prisma.block.create({ data: { blockerId: me.id, blockedId: stranger.id } });
  await page.reload();
  await expect(page.getByText("두 번째 글")).toHaveCount(0);
  expect(second.id).toBeTruthy();
});

test("오늘 끝낸 일이 없으면 올리는 칸 대신 안내가 보인다", async ({ page, emails }, testInfo) => {
  await signUp(page, emails.me, `나없${testInfo.testId.slice(-6)}${RUN_TAG}`);
  await page.goto("/feed/public");
  await expect(page.getByText("오늘 할 일을 하나 끝내면 여기서 피드에 올릴 수 있어요.")).toBeVisible();
  await expect(page.getByRole("form", { name: "피드에 올리기" })).toHaveCount(0);
});

// ── 피드 글에 붙이는 사진(2026-10-20) ──────────────────────────────────────────────
// 공개 피드는 모든 계정이 같이 보는 한 줄이라, 글을 올리는 시험끼리 병렬로 돌면 "맨 위 글이 내 글"이라는 가정이 깨진다
// (사진 시험을 별도 파일로 두었더니 위 시험이 남의 글을 맨 위에서 보고 실패했다). 같은 파일에 두어 차례로 돌린다.
// 브라우저가 줄여 올리고, 서버가 다시 검사하고, 글을 볼 수 있는 사람에게만 내려준다.

/** 한 색으로 채운 PNG. 압축이 잘 돼서 1600×1200도 몇 KB다. */
function solidPng(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.alloc(1 + width * 3, 0x80);
  row[0] = 0;
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// tests/unit/profile-image.test.ts와 같은 실제 1×1 JPEG.
const TINY_JPEG = Buffer.from(
  "/9j//gAPTGF2YzYzLjEuMTAyAP/bAEMACAQEBAQEBQUFBQUFBgYGBgYGBgYGBgYGBgcHBwgICAcHBwYGBwcICAgICQkJCAgICAkJCgoKDAwLCw4ODhERFP/EAE0AAQEAAAAAAAAAAAAAAAAAAAAGAQEBAQAAAAAAAAAAAAAAAAAABgcQAQAAAAAAAAAAAAAAAAAAAAARAQAAAAAAAAAAAAAAAAAAAAD/wAARCAABAAEDARIAAhIAAxIA/9oADAMBAAIRAxEAPwCLEmN/H//Z",
  "base64",
);

/** 사진 맨 앞에 위치 정보가 든 메타데이터(APP1)를 끼운 JPEG. 휴대폰 사진은 이런 정보를 달고 있다. */
function jpegWithLocation(): Buffer {
  const meta = Buffer.from("Exif\0\0GPSLatitude=37.5665;GPSLongitude=126.9780", "latin1");
  const segment = Buffer.alloc(4);
  segment.set([0xff, 0xe1]);
  segment.writeUInt16BE(meta.length + 2, 2);
  return Buffer.concat([TINY_JPEG.subarray(0, 2), segment, meta, TINY_JPEG.subarray(2)]);
}

async function withDoneTodo(page: Page, email: string) {
  const me = await prisma.user.findUniqueOrThrow({ where: { email }, include: { categories: true } });
  await prisma.todo.create({ data: { userId: me.id, categoryId: me.categories[0].id, date: todayKST(), content: "사진 올릴 일", done: true, doneAt: new Date(), order: 0 } });
  await page.reload();
  await page.goto("/feed/public");
  return me;
}

test("큰 사진을 고르면 1080px로 줄어 올라가고, 피드에서 보이고, 글을 지우면 사진도 지워진다", async ({ page, emails }, testInfo) => {
  await signUp(page, emails.me, `사진${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await withDoneTodo(page, emails.me);

  const composer = page.getByRole("form", { name: "피드에 올리기" });
  await composer.getByLabel("피드 사진 파일").setInputFiles({ name: "큰사진.png", mimeType: "image/png", buffer: solidPng(1600, 1200) });
  await expect(composer.getByRole("img", { name: "올릴 사진 미리보기" })).toBeVisible();
  await expect(composer.getByText(/사진에 얼굴이나 개인정보가 보이지 않게 해 주세요/)).toBeVisible();
  await composer.getByLabel("피드 글").fill("사진과 함께");
  await composer.getByRole("button", { name: "올리기" }).click();
  await expect(composer.getByRole("status")).toHaveText("피드에 올렸어요.");
  // 올리면 미리보기가 비워진다.
  await expect(composer.getByRole("img", { name: "올릴 사진 미리보기" })).toHaveCount(0);

  const post = await prisma.post.findFirstOrThrow({ where: { userId: me.id }, include: { photo: true } });
  expect(post.photo).toMatchObject({ width: 1080, height: 810 });
  expect(post.photo?.data.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));

  const image = page.getByRole("list", { name: "피드 글" }).getByRole("listitem").first().getByRole("img", { name: /님이 올린 사진/ });
  await expect(image).toHaveAttribute("src", `/api/post-photo/${post.id}`);
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(1080);

  await page.getByRole("list", { name: "피드 글" }).getByRole("listitem").first().getByRole("button", { name: "지우기" }).click();
  await expect.poll(async () => prisma.postPhoto.count({ where: { postId: post.id } })).toBe(0);
});

test("사진 속 위치 정보는 저장본에 남지 않는다", async ({ page, emails }, testInfo) => {
  await signUp(page, emails.me, `위치${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await withDoneTodo(page, emails.me);

  const original = jpegWithLocation();
  expect(original.includes("GPSLatitude")).toBe(true);

  const composer = page.getByRole("form", { name: "피드에 올리기" });
  await composer.getByLabel("피드 사진 파일").setInputFiles({ name: "내사진.jpg", mimeType: "image/jpeg", buffer: original });
  await expect(composer.getByRole("img", { name: "올릴 사진 미리보기" })).toBeVisible();
  await composer.getByRole("button", { name: "올리기" }).click();
  await expect(composer.getByRole("status")).toHaveText("피드에 올렸어요.");

  const stored = await prisma.postPhoto.findFirstOrThrow({ where: { post: { userId: me.id } } });
  expect(Buffer.from(stored.data).includes("GPSLatitude")).toBe(false);
  expect(Buffer.from(stored.data).includes("Exif")).toBe(false);
});

test("사진이 아닌 파일은 붙지 않고, 서버는 사진이 아닌 값을 받지 않는다", async ({ page, emails }, testInfo) => {
  await signUp(page, emails.me, `거절${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await withDoneTodo(page, emails.me);

  const composer = page.getByRole("form", { name: "피드에 올리기" });
  await composer.getByLabel("피드 사진 파일").setInputFiles({ name: "가짜.png", mimeType: "image/png", buffer: Buffer.from("이건 사진이 아니에요") });
  await expect(composer.getByRole("alert")).toHaveText("이 사진은 쓸 수 없어요. 다른 사진으로 해 보세요.");
  await expect(composer.getByRole("img", { name: "올릴 사진 미리보기" })).toHaveCount(0);

  // 화면을 거치지 않고 가짜 값을 직접 넣어 보낸다: 숨은 칸을 바꿔 서버 검사를 건드린다.
  await composer.getByLabel("피드 사진 파일").setInputFiles({ name: "작은.png", mimeType: "image/png", buffer: solidPng(40, 40) });
  await expect(composer.getByRole("img", { name: "올릴 사진 미리보기" })).toBeVisible();
  await composer.locator('input[name="photo"]').evaluate((input: HTMLInputElement) => {
    // 숨은 칸은 React가 값을 쥐고 있어서, 폼을 보내기 직전에 값을 바꿔 넣는다.
    input.form?.addEventListener(
      "submit",
      () => {
        input.value = "data:image/jpeg;base64,bm90IGEgaW1hZ2U=";
      },
      { capture: true, once: true },
    );
  });
  await composer.getByRole("button", { name: "올리기" }).click();
  await expect(composer.getByRole("status")).toHaveText("사진을 올리지 못했어요. 다른 사진으로 해 보세요.");
  expect(await prisma.post.count({ where: { userId: me.id } })).toBe(0);
});

test("사진 붙인 글은 하루 3개까지만 올라간다", async ({ page, emails }, testInfo) => {
  await signUp(page, emails.me, `상한${testInfo.testId.slice(-6)}${RUN_TAG}`);
  const me = await withDoneTodo(page, emails.me);
  for (let index = 0; index < 3; index += 1) {
    await prisma.post.create({
      data: { userId: me.id, todoContent: `이미 올림 ${index}`, body: "", photo: { create: { data: TINY_JPEG, width: 1, height: 1 } } },
    });
  }

  const composer = page.getByRole("form", { name: "피드에 올리기" });
  await composer.getByLabel("피드 사진 파일").setInputFiles({ name: "넷째.png", mimeType: "image/png", buffer: solidPng(40, 40) });
  await expect(composer.getByRole("img", { name: "올릴 사진 미리보기" })).toBeVisible();
  await composer.getByRole("button", { name: "올리기" }).click();
  await expect(composer.getByRole("status")).toHaveText("사진은 하루에 3개 글까지 붙일 수 있어요.");

  // 사진 없는 글은 올릴 수 있다.
  await composer.getByRole("button", { name: "사진 빼기" }).click();
  await composer.getByRole("button", { name: "올리기" }).click();
  await expect(composer.getByRole("status")).toHaveText("피드에 올렸어요.");
});

test("사진은 글을 볼 수 있는 로그인한 사람에게만 내려간다. 숨기거나 차단하면 받을 수 없다", async ({ page, request, emails }, testInfo) => {
  const tag = testInfo.testId.slice(-6);
  await signUp(page, emails.me, `열람${tag}${RUN_TAG}`);
  const me = await prisma.user.findUniqueOrThrow({ where: { email: emails.me } });
  const stranger = await prisma.user.create({ data: { email: emails.stranger, nickname: `남${tag}${RUN_TAG}`, privacyAgreedAt: new Date() } });
  const post = await prisma.post.create({
    data: { userId: stranger.id, todoContent: "남의 일", body: "", photo: { create: { data: TINY_JPEG, width: 1, height: 1 } } },
  });
  const noPhoto = await prisma.post.create({ data: { userId: stranger.id, todoContent: "사진 없는 글", body: "" } });
  const path = `/api/post-photo/${post.id}`;

  // 로그인하지 않은 요청
  expect((await request.get(path)).status()).toBe(401);

  // 로그인한 사람은 받는다. 사진은 JPEG로, 내려받은 그대로 열린다.
  const ok = await page.request.get(path);
  expect(ok.status()).toBe(200);
  expect(ok.headers()["content-type"]).toBe("image/jpeg");
  expect(ok.headers()["cache-control"]).toContain("private");
  expect((await ok.body()).equals(TINY_JPEG)).toBe(true);

  // 사진이 없는 글, 없는 글, 이상한 주소
  expect((await page.request.get(`/api/post-photo/${noPhoto.id}`)).status()).toBe(404);
  expect((await page.request.get("/api/post-photo/없는글")).status()).toBe(404);

  // 운영자가 숨긴 글
  await prisma.post.update({ where: { id: post.id }, data: { hiddenAt: new Date() } });
  expect((await page.request.get(path)).status()).toBe(404);
  await prisma.post.update({ where: { id: post.id }, data: { hiddenAt: null } });
  expect((await page.request.get(path)).status()).toBe(200);

  // 차단한 사람
  await prisma.block.create({ data: { blockerId: me.id, blockedId: stranger.id } });
  expect((await page.request.get(path)).status()).toBe(404);
});

