// 앱 안 업데이트(2026-10-27 요청). 설치 파일을 웹에서 새로 받지 않고, 앱 안의 버튼으로 새 버전을 받아 설치한다.
// 새 버전 정보(latest.yml)와 설치 파일은 GitHub 릴리스에서 받고, 받은 파일은 latest.yml의 sha512로 확인한다(electron-updater).
// Windows만 된다. 맥 앱은 코드 서명이 없어 운영체제가 앱을 자동으로 바꾸게 두지 않는다.
//
// 상태는 여기(메인 프로세스)가 하나만 갖고, 웹 화면에는 preload.js의 modoriUpdater로 읽기·알림만 내준다.
// 웹이 넘기는 값은 없다. 받을 주소와 파일은 앱에 박힌 설정(app-update.yml)이 정하므로 화면이 바꿀 수 없다.

const { app, ipcMain } = require("electron");

const FIRST_CHECK_MS = 15 * 1000;
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;
// 오프라인 같은 이유로 배경 확인이 실패하면 4시간을 기다리지 않고 이만큼 뒤에 다시 본다.
const RETRY_AFTER_MS = 10 * 60 * 1000;
// 확인 응답이나 받는 중 진행이 이만큼 없으면 멈춘 것으로 본다. electron-updater의 제한 시간은 Electron의 net에서는 걸리지 않는다.
const STALL_MS = 60 * 1000;
// 설치마다 다른 번호 대신 모두에게 같은 값을 보낸다(registerUpdater 안의 설명 참고).
const NO_STAGING_ID = "00000000-0000-0000-0000-000000000000";

// 시험(Playwright)은 가짜 업데이트 서버를 가리키고, 설치 파일을 실제로 실행하지 않는다.
const testFeed = process.env.MODORI_TEST_EXTERNAL ? process.env.MODORI_UPDATE_FEED : undefined;
// 시험에서 기다림을 줄이는 값(밀리초). 제한 시간은 이 값, 다시 보기는 이 값의 10배.
const fastMs = testFeed ? Number(process.env.MODORI_UPDATE_FAST_MS) || 0 : 0;
const stallMs = fastMs || STALL_MS;
const retryMs = fastMs ? fastMs * 10 : RETRY_AFTER_MS;
// 개발 중(npm start)에는 업데이트할 설치본이 없다.
const enabled = Boolean(testFeed) || (process.platform === "win32" && app.isPackaged);

/** idle | checking | none | available | downloading | installing | error */
let state = { supported: enabled, status: "idle", version: null, percent: 0, error: null };
// 사용자가 누른 동작인지. 배경에서 한 확인이 실패(오프라인 등)한 것은 화면에 알리지 않고 로그에만 남긴다.
let userInitiated = false;
let getWindow = () => null;
let updater = null;
let retryTimer = null;
// 받는 중에 진행이 있을 때마다 부른다(멈춤 감시를 다시 건다).
let onProgress = null;
global.modoriUpdateInstalls = [];

function publicState() {
  return { ...state, current: app.getVersion() };
}

function setState(patch) {
  state = { ...state, ...patch };
  const win = getWindow();
  if (win && !win.isDestroyed()) win.webContents.send("modori:update-state", publicState());
}

/** 배경 확인이 실패했을 때 한 번만 다시 볼 때를 잡는다. 다시 봐도 실패하면 또 잡는다. */
function retryLater() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    check({ manual: false });
  }, retryMs);
}

function fail(error) {
  console.error("[updater]", error);
  if (!userInitiated) {
    setState({ status: state.version ? "available" : "idle" });
    retryLater();
    return;
  }
  // 한 줄만 보인다. 전체 내용은 위 로그에 있다.
  const message = String((error && error.message) || error).split("\n")[0].slice(0, 200);
  setState({ status: "error", error: message });
}

/** promise가 ms 안에 끝나지 않으면 message로 실패시킨다. 멈춘 요청 자체는 취소하지 못한다. */
function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function check({ manual }) {
  if (!enabled) return;
  if (["checking", "downloading", "installing"].includes(state.status)) return;
  // 이미 새 버전을 알고 있으면 배경 확인으로 그 알림을 지우지 않는다.
  if (!manual && state.version) return;
  userInitiated = manual;
  setState({ status: "checking", error: null });
  try {
    // 멈춘 요청은 electron-updater 안에 남아 다음 확인도 같은 요청을 기다린다. 그래서 풀리지 않으면 앱을 다시 켜야 한다.
    await withTimeout(updater.checkForUpdates(), stallMs, "서버가 응답하지 않아요");
  } catch (error) {
    fail(error);
  }
}

async function start() {
  const canStart = state.status === "available" || (state.status === "error" && state.version);
  if (!enabled || !canStart) return;
  userInitiated = true;
  if (state.status === "error") {
    // 알아 둔 정보가 낡았을 수 있다(같은 태그의 파일을 바꿨거나 릴리스를 내렸다). 낡은 정보로 다시 받으면 같은 오류만 난다.
    await check({ manual: true });
    if (state.status !== "available") return;
  }
  setState({ status: "downloading", percent: 0, error: null });
  const { CancellationToken } = require("electron-updater");
  const token = new CancellationToken();
  let stalled = false;
  let timer;
  const watch = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      stalled = true;
      token.cancel();
    }, stallMs);
  };
  onProgress = watch;
  watch();
  try {
    await updater.downloadUpdate(token);
  } catch (error) {
    fail(stalled ? new Error("받는 중에 응답이 멈췄어요") : error);
    return;
  } finally {
    clearTimeout(timer);
    onProgress = null;
  }
  setState({ status: "installing" });
  install();
}

function install() {
  if (testFeed) {
    // 시험에서는 설치 파일을 실행하지 않고 부른 사실만 남긴다.
    global.modoriUpdateInstalls.push({ silent: true, forceRun: true });
    return;
  }
  // 조용히 설치하고(/S) 끝나면 앱을 다시 연다. 로그인 쿠키가 든 데이터 폴더는 건드리지 않는다.
  updater.quitAndInstall(true, true);
}

/** 우리 창이 보낸 요청인지. 다른 곳에서 열린 페이지가 업데이트를 부르지 못하게 한다. */
function fromOurWindow(event) {
  const win = getWindow();
  return Boolean(win) && event.sender === win.webContents;
}

/** 창을 찾는 함수를 받아 IPC를 등록한다. app이 준비되기 전에 한 번 부른다. */
function registerUpdater(windowGetter) {
  getWindow = windowGetter;
  ipcMain.handle("modori:update-state", (event) => (fromOurWindow(event) ? publicState() : null));
  ipcMain.on("modori:update-check", (event) => {
    if (fromOurWindow(event)) check({ manual: true });
  });
  ipcMain.on("modori:update-start", (event) => {
    if (fromOurWindow(event)) start();
  });

  if (!enabled) return;
  // 쓰지 않는 곳(개발 중, 맥)에서는 불러오지도 않는다. 플랫폼마다 다른 업데이트 클래스가 만들어진다.
  const { autoUpdater } = require("electron-updater");
  updater = autoUpdater;
  // 받는 것은 사용자가 누른 뒤에만 한다(설치 파일이 100MB를 넘는다). 설치도 그때 같이 하므로 끌 때 자동 설치는 끈다.
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  // 우리 설치 파일은 통째로 들어 있는 한 파일이다. 받는 도중 다른 파일을 더 내려받는 웹 설치 프로그램은 쓰지 않는다.
  updater.disableWebInstaller = true;
  // electron-updater는 기본으로 설치마다 다른 무작위 번호를 데이터 폴더(.updaterId)에 적고 확인 요청마다 GitHub에 보낸다(단계적 배포용).
  // 우리는 단계적 배포를 쓰지 않고, 쓰지 않을 식별자는 저장도 전송도 하지 않는다(개인정보 규칙). 모두 같은 값을 보낸다.
  // 이 값은 라이브러리 안쪽 속성이라 시험이 파일이 생기지 않고 같은 값이 가는지 확인한다(tests/e2e/desktop-app.spec.ts).
  updater.stagingUserIdPromise = { value: Promise.resolve(NO_STAGING_ID) };
  if (testFeed) {
    updater.forceDevUpdateConfig = true;
    updater.setFeedURL({ provider: "generic", url: testFeed });
  }

  updater.on("update-available", (info) => setState({ status: "available", version: info.version, percent: 0, error: null }));
  updater.on("update-not-available", () => setState({ status: "none", version: null, error: null }));
  updater.on("download-progress", (progress) => {
    if (onProgress) onProgress();
    const percent = Math.round(progress.percent);
    if (percent !== state.percent) setState({ status: "downloading", percent });
  });
  // 듣는 쪽이 없으면 error 이벤트가 앱을 죽인다. 확인·받기 실패는 부른 쪽의 catch가 처리한다(같은 오류가 이벤트로도 온다).
  // 설치 단계는 quitAndInstall이 바로 실패를 알릴 때(받은 파일이 없을 때)만 여기서 화면에 닿는다. 설치 파일을 여는 데 실패하는 것은
  // 나중에 알려지는데, 그때는 이미 앱을 닫는 중이라 화면에 보이지 않는다(다시 열면 15초 뒤 새 버전 카드가 다시 뜬다).
  updater.on("error", (error) => {
    if (state.status === "installing") fail(error);
    else console.warn("[updater] 이벤트", (error && error.message) || error);
  });
}

/** 켠 직후와 그 뒤 몇 시간마다 조용히 새 버전이 있는지 본다. */
function scheduleUpdateChecks() {
  if (!enabled) return;
  setTimeout(() => check({ manual: false }), testFeed ? 300 : FIRST_CHECK_MS);
  setInterval(() => check({ manual: false }), CHECK_EVERY_MS);
}

module.exports = { registerUpdater, scheduleUpdateChecks };
