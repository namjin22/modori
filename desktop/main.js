// 모도리 데스크톱 앱. 웹(modori.site)을 창 하나에 띄운다. 기능은 전부 웹에 있고, 여기서는
// 로그인 넘겨받기(modori://)와 바깥 링크 열기, 연결이 끊겼을 때 안내만 한다.
//
// 로그인: Google은 앱 안에 끼운 브라우저에서의 로그인을 막는다. 그래서 평소 브라우저에서 로그인하고,
// 서버가 준 한 번 쓰는 코드를 처음에 만든 verifier와 함께 바꿔 세션을 받는다(웹의 lib/desktop-login.ts).

const { app, BrowserWindow, Menu, shell } = require("electron");
const crypto = require("node:crypto");
const path = require("node:path");

const BASE = new URL(process.env.MODORI_URL || "https://modori.site");
const PROTOCOL = "modori";
// 웹의 lib/desktop.ts와 같아야 한다. 로그인 화면이 이 표시를 보고 버튼을 바꾼다.
const UA_MARK = `ModoriDesktop/${app.getVersion()}`;

/** @type {BrowserWindow | null} */
let win = null;
// 브라우저 로그인을 시작할 때 만든 비밀값. 메모리에만 두고, 코드를 바꾸면 버린다.
let verifier = null;
// 시험(Playwright)에서는 바깥 브라우저를 열지 않고 주소만 남긴다.
const externalOpened = [];
global.modoriExternalOpened = externalOpened;

function openExternal(url) {
  if (process.env.MODORI_TEST_EXTERNAL === "record") {
    externalOpened.push(url);
    return;
  }
  // http(s)와 메일만 연다. file:이나 알 수 없는 주소를 운영체제에 넘기지 않는다.
  if (/^(https?:|mailto:)/.test(url)) shell.openExternal(url);
}

/** 앱 창의 로그인 버튼(Google·DataGSM)을 누르면 평소 브라우저에서 그 로그인을 바로 시작한다. */
function startBrowserLogin(provider) {
  verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const login = new URL("/desktop/login", BASE);
  login.searchParams.set("challenge", challenge);
  if (provider === "google" || provider === "datagsm") login.searchParams.set("provider", provider);
  openExternal(login.toString());
}

/** modori://login?code=... 를 받았다. 코드를 바꿔 세션을 받는다. */
function handleDeepLink(url) {
  let link;
  try {
    link = new URL(url);
  } catch (error) {
    console.error("[desktop] 알 수 없는 주소", url, error);
    return;
  }
  if (link.protocol !== `${PROTOCOL}:` || link.hostname !== "login") return;
  const code = link.searchParams.get("code");
  if (!win) createWindow();
  if (code && verifier) {
    const exchange = new URL("/api/desktop/exchange", BASE);
    exchange.searchParams.set("code", code);
    exchange.searchParams.set("verifier", verifier);
    verifier = null;
    win.loadURL(exchange.toString());
  }
  if (win.isMinimized()) win.restore();
  win.focus();
}
global.modoriHandleDeepLink = handleDeepLink;

// 연결 안내 화면(offline.html)이 떠 있을 때 새로고침하면 안내 화면이 아니라 원래 가려던 주소로 돌아가야 한다.
let retryUrl = BASE.toString();

/** F5·Ctrl+R. 안내 화면이면 원래 주소를 다시 부르고, 아니면 지금 화면을 다시 읽는다. hard는 캐시도 무시한다. */
function reloadPage({ hard = false } = {}) {
  if (!win) return;
  const contents = win.webContents;
  if (contents.getURL().startsWith("file:")) win.loadURL(retryUrl);
  else if (hard) contents.reloadIgnoringCache();
  else contents.reload();
}
global.modoriReload = reloadPage;

function isOurs(url) {
  try {
    return new URL(url).origin === BASE.origin;
  } catch {
    return false;
  }
}

// Electron 25부터 주소는 event.url로 온다(두 번째 인자는 예전 방식이라 44에서는 비어 있다).
function guardNavigation(event, legacyUrl) {
  const url = event.url ?? legacyUrl;
  if (isOurs(url)) {
    const target = new URL(url);
    if (target.pathname === "/desktop/start") {
      event.preventDefault();
      startBrowserLogin(target.searchParams.get("provider"));
    }
    return;
  }
  // 모도리 밖(OAuth·외부 링크)은 앱 창에서 열지 않는다.
  event.preventDefault();
  openExternal(url);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 380,
    minHeight: 600,
    title: "모도리",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: true,
    backgroundColor: "#f7f8fa",
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  const contents = win.webContents;
  // Electron은 앱 이름("모도리")을 사용자 에이전트에 넣는다. HTTP 헤더에 한글이 들어가면 요청이 깨지므로
  // ASCII가 아닌 조각은 빼고 표시만 붙인다.
  const ascii = contents
    .getUserAgent()
    .split(" ")
    .filter((part) => /^[ -~]+$/.test(part))
    .join(" ");
  contents.setUserAgent(`${ascii} ${UA_MARK}`);
  contents.on("will-navigate", guardNavigation);
  contents.on("will-redirect", guardNavigation);
  contents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });
  // 서버에 닿지 못하면 흰 화면 대신 안내를 띄운다. 다시 시도는 원래 가려던 주소로.
  contents.on("did-fail-load", (_event, errorCode, _description, url, isMainFrame) => {
    // -3은 사용자가 다른 곳으로 옮겨 간 경우(ERR_ABORTED)라 오류가 아니다.
    if (!isMainFrame || errorCode === -3) return;
    const retry = isOurs(url) ? url : BASE.toString();
    retryUrl = retry;
    win.loadFile(path.join(__dirname, "offline.html"), { query: { retry } });
  });

  win.on("closed", () => {
    win = null;
  });
  win.loadURL(BASE.toString());
}

// 메뉴 막대는 Alt를 눌러야 보이지만, 단축키는 늘 먹는다. 기본 메뉴의 새로고침은 안내 화면에서 안내 화면만 다시 읽는다.
function setupMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "보기",
        submenu: [
          { label: "새로고침", accelerator: "F5", click: () => reloadPage() },
          { label: "새로고침", accelerator: "CmdOrCtrl+R", visible: false, click: () => reloadPage() },
          { label: "캐시 없이 새로고침", accelerator: "CmdOrCtrl+Shift+R", click: () => reloadPage({ hard: true }) },
          { type: "separator" },
          { label: "뒤로", accelerator: "Alt+Left", click: () => win?.webContents.navigationHistory.goBack() },
          { label: "앞으로", accelerator: "Alt+Right", click: () => win?.webContents.navigationHistory.goForward() },
          { type: "separator" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { role: "resetZoom" },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
      { label: "편집", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
    ]),
  );
}

// modori:// 링크를 이 앱이 받게 등록한다. 개발 중(electron .)에는 실행 파일과 경로를 같이 넘겨야 한다.
// 시험 중에는 등록하지 않는다. 등록은 운영체제에 남아서, 설치한 앱 대신 시험용 실행 파일이 링크를 받게 된다.
if (process.env.MODORI_TEST_EXTERNAL) {
  // 시험은 링크를 global.modoriHandleDeepLink로 직접 넘긴다.
} else if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// 시험은 설치해 쓰는 앱과 데이터 폴더(쿠키·잠금)를 나누지 않으면, 켜 둔 앱 때문에 시험용 앱이 바로 꺼진다.
if (process.env.MODORI_TEST_EXTERNAL) {
  app.setPath("userData", path.join(require("node:os").tmpdir(), `modori-desktop-test-${process.pid}`));
}

// 앱은 하나만 뜬다. Windows는 링크를 누르면 새 프로세스로 오므로, 먼저 뜬 앱이 받아 처리한다.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const link = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    if (link) handleDeepLink(link);
    else if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  // macOS는 링크를 open-url로 준다.
  app.on("open-url", (event, url) => {
    event.preventDefault();
    if (app.isReady()) handleDeepLink(url);
    else app.once("ready", () => handleDeepLink(url));
  });

  app.whenReady().then(() => {
    setupMenu();
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
