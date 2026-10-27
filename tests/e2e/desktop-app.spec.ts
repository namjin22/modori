import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

import { _electron as electron, expect, test as base, type ElectronApplication } from "@playwright/test";

import { prisma } from "@/lib/prisma";

import { homeReady } from "./todo-helpers";

import { RUN_TAG } from "./run-tag";

// 데스크톱 앱(desktop/main.js)을 실제로 띄워 본다. 앱 폴더에 Electron을 설치한 곳에서만 돈다
// (cd desktop && npm install). CI처럼 없으면 건너뛴다.
const DESKTOP = path.join(process.cwd(), "desktop");
const electronBin = path.join(DESKTOP, "node_modules", "electron");
const installed = existsSync(path.join(electronBin, "path.txt"));

const test = base.extend<{ email: string }>({
  email: async ({}, provide, testInfo) => {
    const email = `e2e-app-${testInfo.testId}-${RUN_TAG}@modori.test`;
    await prisma.user.deleteMany({ where: { email } });
    await provide(email);
    await prisma.user.deleteMany({ where: { email } });
  },
});

// 앱은 하나만 뜨게 되어 있어(requestSingleInstanceLock) 이 파일 안에서는 차례로 돈다.
test.describe.configure({ mode: "serial" });
test.skip(!installed, "desktop/에 Electron이 설치되지 않았다");

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function launch(url: string, extraEnv: Record<string, string> = {}): Promise<ElectronApplication> {
  const executablePath = createRequire(path.join(DESKTOP, "package.json"))("electron") as unknown as string;
  // VS Code처럼 Electron으로 만든 편집기 안에서 돌리면 ELECTRON_RUN_AS_NODE가 물려 와서
  // Electron이 그냥 Node로 뜬다(app이 없고 디버깅 옵션을 거절한다). 앱을 띄울 때는 뺀다.
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  return electron.launch({
    executablePath,
    // 앱 폴더를 넘겨야 package.json(이름·버전)을 읽는다.
    args: [DESKTOP],
    env: { ...env, MODORI_URL: url, MODORI_TEST_EXTERNAL: "record", ...extraEnv },
  });
}

const externalOpened = (app: ElectronApplication) =>
  app.evaluate(() => (globalThis as unknown as { modoriExternalOpened: string[] }).modoriExternalOpened);

test("앱에서 브라우저 로그인을 마치면 modori:// 링크로 앱 창이 로그인된다", async ({ page, email }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL ?? "";
  const app = await launch(baseURL);
  try {
    const win = await app.firstWindow();
    await expect(win).toHaveTitle(/모도리/);

    // 앱 창에도 웹과 같은 로그인 버튼이 있다. 누르면 평소 브라우저가 그 로그인으로 열린다.
    // Playwright의 마우스 입력은 이 Electron 창에 닿지 않아(창 안에서 보낸 클릭·주소 이동은 된다) 클릭 이벤트를 직접 보낸다.
    await win.getByRole("link", { name: "Google로 계속하기" }).dispatchEvent("click");
    await expect.poll(async () => (await externalOpened(app)).length).toBe(1);
    const [opened] = await externalOpened(app);
    const loginUrl = new URL(opened);
    expect(loginUrl.pathname).toBe("/desktop/login");
    expect(loginUrl.searchParams.get("challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(loginUrl.searchParams.get("provider")).toBe("google");
    // 앱 창은 그대로 로그인 화면에 남는다.
    expect(win.url()).toMatch(/\/login$/);

    // 시험에서는 실제 Google 대신 테스트 로그인으로 브라우저 쪽을 마친다.
    loginUrl.searchParams.delete("provider");
    // 평소 브라우저에서 가입까지 마친다.
    await page.goto(loginUrl.toString());
    await page.getByLabel("테스트 이메일").fill(email);
    await page.getByRole("button", { name: "테스트 로그인" }).click();
    await page.getByPlaceholder("닉네임").fill(`앱창${testInfo.testId.slice(-6)}${RUN_TAG}`);
    await page.getByLabel("개인정보 수집·이용에 동의해요").check();
    await page.getByRole("button", { name: "시작하기" }).click();
    const deepLink = (await page.getByRole("link", { name: "모도리 앱 열기" }).getAttribute("href")) ?? "";

    // 운영체제가 modori:// 링크를 앱에 넘겨준 것처럼 한다.
    await app.evaluate((_electron, link) => {
      (globalThis as unknown as { modoriHandleDeepLink: (url: string) => void }).modoriHandleDeepLink(link);
    }, deepLink);
    await expect(homeReady(win)).toBeVisible();

    // 컴퓨터 알림을 누르면 내려 둔 창을 올린다(desktop/preload.js). 웹 화면에는 이 함수 하나만 보인다.
    await win.evaluate(() => window.modoriDesktop?.focus());
    expect(await win.evaluate(() => Object.keys(window.modoriDesktop ?? {}))).toEqual(["focus", "setBadge"]);
    expect(await win.evaluate(() => typeof (window as unknown as { require?: unknown }).require)).toBe("undefined");

    // 작업표시줄 아이콘 숫자(2026-10-26): 앱은 모양이 맞는 것만 받는다. 운영체제의 아이콘은 읽을 수 없어 앱이 남긴 값을 본다.
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";
    const lastBadge = () => app.evaluate(() => (globalThis as unknown as { modoriLastBadge?: unknown }).modoriLastBadge);
    // Windows에서 app.setBadgeCount를 부르면 Windows가 회색 숫자를 그려 빨간 겹침 그림을 덮어쓴다(1.0.5, 2026-10-27). 맥·리눅스만 부른다.
    await app.evaluate(({ app: electronApp }) => {
      const calls: number[] = [];
      (globalThis as unknown as { modoriBadgeCountCalls: number[] }).modoriBadgeCountCalls = calls;
      const original = electronApp.setBadgeCount.bind(electronApp);
      electronApp.setBadgeCount = (count?: number) => {
        calls.push(count ?? 0);
        return original(count);
      };
    });
    const badgeCountCalls = () => app.evaluate(() => (globalThis as unknown as { modoriBadgeCountCalls: number[] }).modoriBadgeCountCalls);
    await win.evaluate((image) => window.modoriDesktop?.setBadge(3, image), png);
    await expect.poll(lastBadge).toEqual({ count: 3, description: "안 읽은 알림 3개", hasImage: true });
    expect(await badgeCountCalls()).toEqual(process.platform === "win32" ? [] : [3]);
    // 그림이 PNG가 아니면(다른 형식·글자) 그림은 버리고 숫자만 쓴다.
    await win.evaluate(() => window.modoriDesktop?.setBadge(5, "data:text/html;base64,PGI+"));
    await expect.poll(lastBadge).toEqual({ count: 5, description: "안 읽은 알림 5개", hasImage: false });
    // 숫자가 이상하면(음수·너무 큼·정수 아님) 무시해서 앞의 값이 그대로다.
    await win.evaluate((image) => {
      window.modoriDesktop?.setBadge(-1, image);
      window.modoriDesktop?.setBadge(1000, image);
      window.modoriDesktop?.setBadge(1.5, image);
    }, png);
    await win.evaluate(() => window.modoriDesktop?.focus());
    expect(await lastBadge()).toEqual({ count: 5, description: "안 읽은 알림 5개", hasImage: false });
    // 0이면 지운다.
    await win.evaluate(() => window.modoriDesktop?.setBadge(0, null));
    await expect.poll(lastBadge).toEqual({ count: 0, description: "", hasImage: false });

    // 모도리 밖으로 가는 링크(의견 메일)는 앱 창이 아니라 바깥에서 연다.
    await win.goto(new URL("/settings", baseURL).toString());
    await win.getByRole("link", { name: "penamjin@gmail.com" }).dispatchEvent("click");
    await expect.poll(async () => (await externalOpened(app)).at(-1)).toMatch(/^mailto:penamjin@gmail\.com/);
    expect(win.url()).toMatch(/\/settings$/);
  } finally {
    await app.close();
  }
});

test("서버에 닿지 못하면 흰 화면 대신 연결 안내를 띄운다", async () => {
  // 아무것도 듣지 않는 주소.
  const app = await launch("http://127.0.0.1:9");
  try {
    const win = await app.firstWindow();
    await expect(win.getByRole("heading", { name: "모도리에 연결하지 못했어요" })).toBeVisible();
    await expect(win.getByRole("button", { name: "다시 시도" })).toBeVisible();
  } finally {
    await app.close();
  }
});

test("연결 안내 화면에서 F5(새로고침)를 누르면 원래 주소를 다시 부른다", async () => {
  const app = await launch("http://127.0.0.1:9");
  try {
    const win = await app.firstWindow();
    await expect(win.getByRole("heading", { name: "모도리에 연결하지 못했어요" })).toBeVisible();
    // 새로고침이 안내 화면 자신이 아니라 원래 주소(연결 실패)를 부르는지: 주소가 안내 화면 파일에서 다시 안내 화면으로 돌아온다.
    const loads = await app.evaluate(async ({ BrowserWindow }) => {
      const contents = BrowserWindow.getAllWindows()[0].webContents;
      let started = 0;
      contents.on("did-start-navigation", (...args: unknown[]) => {
        const [, url, , isMainFrame] = args as [unknown, string, unknown, boolean];
        if (isMainFrame && url.startsWith("http://127.0.0.1:9")) started += 1;
      });
      (globalThis as unknown as { modoriReload: () => void }).modoriReload();
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return started;
    });
    expect(loads).toBeGreaterThanOrEqual(1);
    await expect(win.getByRole("heading", { name: "모도리에 연결하지 못했어요" })).toBeVisible();
  } finally {
    await app.close();
  }
});

/** 지금은 아무도 듣지 않는 포트 하나(열었다 닫아서 얻는다). */
async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test("서버에 닿지 못하면 안내 화면에 오류 이름과 원인 안내가 뜬다", async () => {
  // 연결이 거절된다(ERR_CONNECTION_REFUSED, -102). 네트워크마다 원인이 달라서 오류 이름을 보여 주는 것이 핵심이다.
  const app = await launch(`http://127.0.0.1:${await closedPort()}`);
  try {
    const win = await app.firstWindow();
    await expect(win.getByRole("heading", { name: "모도리에 연결하지 못했어요" })).toBeVisible();
    await expect(win.getByText(/ERR_CONNECTION_REFUSED \(-102\)/)).toBeVisible();
    await expect(win.getByText(/다른 와이파이나 핫스팟/)).toBeVisible();
  } finally {
    await app.close();
  }
});

// 앱 안 업데이트(2026-10-27 요청, desktop/updater.js). 가짜 업데이트 서버(latest.yml과 설치 파일 하나)를 가리키게 해서
// 찾기·받기·해시 확인·설치 시작까지 실제 앱으로 돌려 본다. 설치 파일을 실제로 실행하지는 않는다(시험에서는 부른 사실만 남긴다).
// 업데이트는 Windows 앱만 한다.
const appVersion = (JSON.parse(readFileSync(path.join(DESKTOP, "package.json"), "utf8")) as { version: string }).version;
const FAKE_INSTALLER = Buffer.from("모도리 가짜 설치 파일");

type FeedOptions = {
  /** latest.yml이 알리는 버전. null이면 latest.yml을 주지 않는다(404). */
  version: string | null;
  /** latest.yml의 해시를 설치 파일과 다르게 한다. */
  wrongHash: boolean;
  /** none: 정상. latest: latest.yml 요청에 답하지 않는다. installer: 설치 파일을 받다가 멈춘다. */
  hang: "none" | "latest" | "installer";
};
type Feed = {
  url: string;
  requests: string[];
  /** latest.yml 요청마다 받은 헤더. */
  latestHeaders: Array<Record<string, string | string[] | undefined>>;
  set: (patch: Partial<FeedOptions>) => void;
  close: () => Promise<void>;
};

/** latest.yml과 Modori-Setup.exe를 내는 로컬 서버. 시험 도중 set으로 동작을 바꿀 수 있다. */
async function startUpdateFeed(initial: Partial<FeedOptions> = {}): Promise<Feed> {
  const options: FeedOptions = { version: "99.0.0", wrongHash: false, hang: "none", ...initial };
  const requests: string[] = [];
  const latestHeaders: Feed["latestHeaders"] = [];
  const manifest = () => {
    const hash = createHash("sha512").update(options.wrongHash ? Buffer.from("다른 파일") : FAKE_INSTALLER).digest("base64");
    return [
      `version: ${options.version}`,
      "files:",
      "  - url: Modori-Setup.exe",
      `    sha512: ${hash}`,
      `    size: ${FAKE_INSTALLER.length}`,
      "path: Modori-Setup.exe",
      `sha512: ${hash}`,
      "releaseDate: '2026-10-27T00:00:00.000Z'",
      "",
    ].join("\n");
  };
  const server = createHttpServer((request, response) => {
    // 업데이트 클라이언트는 캐시를 피하려고 주소 뒤에 ?noCache=…를 붙인다.
    const { pathname } = new URL(request.url ?? "/", "http://feed.test");
    requests.push(pathname);
    if (pathname === "/latest.yml") latestHeaders.push(request.headers);
    if (pathname === "/latest.yml" && options.hang === "latest") return;
    if (pathname === "/latest.yml" && options.version) {
      response.writeHead(200, { "content-type": "text/yaml" }).end(manifest());
    } else if (pathname === "/Modori-Setup.exe" && options.hang === "installer") {
      // 헤더와 첫 조각만 보내고 멈춘다.
      response.writeHead(200, { "content-type": "application/octet-stream", "content-length": FAKE_INSTALLER.length });
      response.write(FAKE_INSTALLER.subarray(0, 1));
    } else if (pathname === "/Modori-Setup.exe") {
      response.writeHead(200, { "content-type": "application/octet-stream", "content-length": FAKE_INSTALLER.length }).end(FAKE_INSTALLER);
    } else {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    latestHeaders,
    set: (patch) => Object.assign(options, patch),
    close: () => {
      // 멈춘 요청을 붙들고 있으면 close가 끝나지 않는다.
      server.closeAllConnections();
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

type AppWindow = Awaited<ReturnType<ElectronApplication["firstWindow"]>>;

/** 앱을 가짜 서버에 물려 띄운다. 받은 파일이 쌓이는 캐시 폴더(LOCALAPPDATA)가 실제로 설치한 앱과 섞이지 않게 임시 폴더로 돌린다. */
async function withUpdateApp(
  feed: Feed,
  run: (app: ElectronApplication, window: AppWindow) => Promise<void>,
  extraEnv: Record<string, string> = {},
) {
  const cache = mkdtempSync(path.join(tmpdir(), "modori-update-test-"));
  const app = await launch("http://127.0.0.1:9", { MODORI_UPDATE_FEED: feed.url, LOCALAPPDATA: cache, ...extraEnv });
  try {
    const win = await app.firstWindow();
    // 닿지 않는 주소라 안내 화면으로 바뀐다. 그 이동이 끝난 뒤에 화면에 말을 걸어야 한다.
    await expect(win.getByRole("heading", { name: "모도리에 연결하지 못했어요" })).toBeVisible();
    await run(app, win);
  } finally {
    await app.close();
    await feed.close();
    rmSync(cache, { recursive: true, force: true });
  }
}

const updateState = (win: AppWindow) => win.evaluate(() => window.modoriUpdater?.getState());
const updateStatus = async (win: AppWindow) => (await updateState(win))?.status;
const installs = (app: ElectronApplication) => app.evaluate(() => (globalThis as unknown as { modoriUpdateInstalls: unknown[] }).modoriUpdateInstalls);
// 시험에서 기다림을 줄이는 값(desktop/updater.js): 멈춤 제한이 0.5초, 배경 확인이 실패했을 때 다시 보기는 5초 뒤.
const FAST = { MODORI_UPDATE_FAST_MS: "500" };

test("새 버전이 있으면 켠 직후 알아내고, 누르면 받아서 해시를 확인한 뒤 설치를 시작한다", async () => {
  test.skip(process.platform !== "win32", "앱 안 업데이트는 Windows만 한다");
  const feed = await startUpdateFeed();
  await withUpdateApp(feed, async (app, win) => {
    // 웹 화면에 내주는 것은 이 넷뿐이다.
    expect(await win.evaluate(() => Object.keys(window.modoriUpdater ?? {}))).toEqual(["getState", "check", "start", "onState"]);

    // 아무것도 누르지 않아도 켠 직후 조용히 확인한다.
    await expect.poll(() => updateStatus(win)).toBe("available");
    expect(await updateState(win)).toMatchObject({ supported: true, current: appVersion, version: "99.0.0", error: null });
    expect(await installs(app)).toEqual([]);

    await win.evaluate(() => {
      const seen: string[] = [];
      (window as unknown as { __seen: string[] }).__seen = seen;
      window.modoriUpdater?.onState((state) => seen.push(state.status));
      window.modoriUpdater?.start();
    });
    await expect.poll(() => updateStatus(win)).toBe("installing");
    expect(await installs(app)).toEqual([{ silent: true, forceRun: true }]);
    // 화면은 상태가 바뀔 때마다 알림을 받는다(받는 중은 너무 빨라 건너뛸 수 있다).
    expect(await win.evaluate(() => (window as unknown as { __seen: string[] }).__seen)).toContain("installing");

    // 설치마다 다른 번호(electron-updater의 .updaterId)를 만들지도, GitHub로 보내지도 않는다. 모두 같은 값을 보낸다.
    expect(feed.latestHeaders.length).toBeGreaterThan(0);
    for (const headers of feed.latestHeaders) expect(headers["x-user-staging-id"]).toBe("00000000-0000-0000-0000-000000000000");
    const userData = await app.evaluate(({ app: electronApp }) => electronApp.getPath("userData"));
    expect(existsSync(path.join(userData, ".updaterId"))).toBe(false);
  });
});

test("받은 파일이 latest.yml의 해시와 다르면 설치하지 않고 원문 오류를 남기며, 파일이 바로잡히면 다시 시도로 받는다", async () => {
  test.skip(process.platform !== "win32", "앱 안 업데이트는 Windows만 한다");
  const feed = await startUpdateFeed({ wrongHash: true });
  await withUpdateApp(feed, async (app, win) => {
    await expect.poll(() => updateStatus(win)).toBe("available");
    await win.evaluate(() => window.modoriUpdater?.start());
    await expect.poll(() => updateStatus(win)).toBe("error");
    const state = await updateState(win);
    expect(state?.error).toMatch(/sha512 checksum mismatch/i);
    // 실패해도 새 버전은 안다(화면이 "다시 시도"를 보여 준다). 설치 파일은 실행하지 않았다.
    expect(state?.version).toBe("99.0.0");
    expect(await installs(app)).toEqual([]);

    // 운영자가 릴리스의 파일을 바로잡았다. 다시 시도는 알아 둔 낡은 정보가 아니라 새로 확인한 정보로 받아야 한다.
    feed.set({ wrongHash: false });
    await win.evaluate(() => window.modoriUpdater?.start());
    await expect.poll(() => updateStatus(win)).toBe("installing");
    expect(await installs(app)).toEqual([{ silent: true, forceRun: true }]);
  });
});

test("지금과 같은 버전이면 최신이라고 알린다", async () => {
  test.skip(process.platform !== "win32", "앱 안 업데이트는 Windows만 한다");
  await withUpdateApp(await startUpdateFeed({ version: appVersion }), async (app, win) => {
    await expect.poll(() => updateStatus(win)).toBe("none");
    expect(await updateState(win)).toMatchObject({ version: null, error: null });
    expect(await installs(app)).toEqual([]);
  });
});

test("배경 확인이 실패하면 화면에 알리지 않고, 사용자가 누른 확인이 실패하면 원문을 알린다", async () => {
  test.skip(process.platform !== "win32", "앱 안 업데이트는 Windows만 한다");
  const feed = await startUpdateFeed({ version: null });
  await withUpdateApp(feed, async (_app, win) => {
    // 켠 직후 배경 확인이 서버에 닿았는데(404) 화면은 조용하다.
    await expect.poll(() => feed.requests.includes("/latest.yml")).toBe(true);
    await win.waitForTimeout(500);
    expect((await updateState(win))?.status).toBe("idle");
    expect((await updateState(win))?.error).toBeNull();

    await win.evaluate(() => window.modoriUpdater?.check());
    await expect.poll(() => updateStatus(win)).toBe("error");
    expect((await updateState(win))?.error).toMatch(/latest\.yml/);
  });
});

test("오프라인 같은 이유로 배경 확인이 실패해도 4시간을 기다리지 않고 곧 다시 보아 알아낸다", async () => {
  test.skip(process.platform !== "win32", "앱 안 업데이트는 Windows만 한다");
  const feed = await startUpdateFeed({ version: null });
  await withUpdateApp(
    feed,
    async (_app, win) => {
      await expect.poll(() => feed.requests.includes("/latest.yml")).toBe(true);
      expect(await updateStatus(win)).not.toBe("available");
      // 서버가 살아났다. 사용자는 아무것도 누르지 않았다.
      feed.set({ version: "99.0.0" });
      await expect.poll(() => updateStatus(win), { timeout: 15_000 }).toBe("available");
    },
    FAST,
  );
});

test("확인 요청에 서버가 답하지 않으면 확인 중에 멈춰 있지 않고 오류로 알린다", async () => {
  test.skip(process.platform !== "win32", "앱 안 업데이트는 Windows만 한다");
  const feed = await startUpdateFeed({ hang: "latest" });
  await withUpdateApp(
    feed,
    async (_app, win) => {
      // 배경 확인이 멈추면 제한 시간 뒤 조용히 풀린다.
      await expect.poll(() => feed.requests.includes("/latest.yml")).toBe(true);
      await expect.poll(() => updateStatus(win)).toBe("idle");
      expect((await updateState(win))?.error).toBeNull();
      // 누른 확인이 멈추면 오류로 알린다. 버튼이 영영 눌리지 않는 상태로 두지 않는다.
      await win.evaluate(() => window.modoriUpdater?.check());
      await expect.poll(() => updateStatus(win)).toBe("error");
      expect((await updateState(win))?.error).toMatch(/응답/);
    },
    FAST,
  );
});

test("설치 파일을 받다가 응답이 멈추면 오류로 알리고, 서버가 살아나면 다시 시도로 받는다", async () => {
  test.skip(process.platform !== "win32", "앱 안 업데이트는 Windows만 한다");
  const feed = await startUpdateFeed();
  await withUpdateApp(
    feed,
    async (app, win) => {
      await expect.poll(() => updateStatus(win)).toBe("available");
      feed.set({ hang: "installer" });
      await win.evaluate(() => window.modoriUpdater?.start());
      await expect.poll(() => updateStatus(win)).toBe("error");
      expect((await updateState(win))?.error).toMatch(/응답이 멈췄/);
      expect(await installs(app)).toEqual([]);

      feed.set({ hang: "none" });
      await win.evaluate(() => window.modoriUpdater?.start());
      await expect.poll(() => updateStatus(win)).toBe("installing");
      expect(await installs(app)).toEqual([{ silent: true, forceRun: true }]);
    },
    FAST,
  );
});
