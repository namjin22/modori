// 앱 안 업데이트의 기록(2026-11-11). 조용한 설치가 어디서 멈췄는지 아무 흔적이 남지 않아, 제보된 실패(다른 PC에서 20분을 기다려도 1.0.7 그대로,
// 중간에 관리자 권한 창이 떴다)의 원인을 가릴 수 없었다. 새 버전 확인·받기·설치 시도의 시각과 버전, electron-updater가 남기는 오류를
// 앱 데이터 폴더의 updater.log 한 파일에 적는다. 이 기기에만 있고 모도리 서버로 보내지 않는다(docs/privacy-inventory.md).
//
// 파일을 읽고 쓰는 일과 글자 처리를 나눠 둔다. 글자 처리(버전 비교, 경로 가리기, 지난 설치 시도 찾기)는 Electron 없이 시험한다.

const fs = require("node:fs");

// 이 크기를 넘으면 오래된 쪽을 잘라 낸다. 확인이 4시간마다 한 줄씩이라 몇 달은 담긴다.
const MAX_BYTES = 200 * 1024;
const KEEP_BYTES = 100 * 1024;

/** "1.0.9" 두 개를 견준다. 앞이 작으면 -1, 같으면 0, 크면 1. 숫자가 아니면 0(견줄 수 없다). */
function compareVersions(a, b) {
  const left = String(a).split(".").map(Number);
  const right = String(b).split(".").map(Number);
  if ([...left, ...right].some((part) => !Number.isInteger(part))) return 0;
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

/** 홈 폴더 경로(윈도우 사용자 이름이 들어 있다)를 ~로 바꾼다. 대소문자는 가리지 않는다(윈도우 경로). */
function redactHome(text, home) {
  const source = String(text);
  if (!home) return source;
  const escaped = home.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.replace(new RegExp(escaped, "gi"), "~");
}

/** 한 줄로 만든다: "2026-11-11T01:02:03.000Z info 내용". 줄바꿈은 공백으로 바꿔 한 줄 한 사건을 지킨다. */
function formatLine(level, message, home, now = new Date()) {
  const text = message && message.stack ? message.stack : message;
  return `${now.toISOString()} ${level} ${redactHome(text, home).replace(/\s*\r?\n\s*/g, " ")}\n`;
}

/**
 * 기록에서 가장 나중의 설치 시도와 그 결과를 찾는다. 시도는 "install-attempt target=1.0.9 from=1.0.8", 결과는
 * "install-result target=1.0.9 applied=true|false"로 적는다. 시도가 없으면 null.
 */
function lastAttempt(logText) {
  const lines = String(logText).split("\n");
  let index = -1;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].includes(" install-attempt ")) {
      index = i;
      break;
    }
  }
  if (index === -1) return null;
  const target = /target=(\S+)/.exec(lines[index]);
  if (!target) return null;
  const later = lines.slice(index + 1);
  return { target: target[1], resolved: later.some((line) => line.includes(` install-result target=${target[1]} `)) };
}

/**
 * 앱을 켰을 때 지난 설치 시도가 어떻게 됐는지 적을 한 줄. 이미 결과를 적었거나 시도가 없으면 null.
 * 설치가 끝나면 앱이 새 버전으로 다시 열리므로, 켠 버전이 목표보다 낮으면 설치가 적용되지 않은 것이다.
 */
function describePreviousInstall(logText, current) {
  const attempt = lastAttempt(logText);
  if (!attempt || attempt.resolved) return null;
  const applied = compareVersions(current, attempt.target) >= 0;
  return `install-result target=${attempt.target} applied=${applied} current=${current}`;
}

/** 기록 파일 끝에 한 줄을 더한다. 너무 커지면 뒤쪽 일부만 남긴다. 실패하면 부른 쪽이 알 수 있게 던진다. */
function appendLine(file, line) {
  fs.appendFileSync(file, line);
  if (fs.statSync(file).size > MAX_BYTES) {
    const buffer = fs.readFileSync(file);
    const tail = buffer.subarray(buffer.length - KEEP_BYTES).toString("utf8");
    // 잘린 첫 줄은 버린다.
    fs.writeFileSync(file, tail.slice(tail.indexOf("\n") + 1));
  }
}

function readLog(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    // 처음 켠 앱에는 기록이 없다. 그 밖의 이유로 못 읽으면 남긴다.
    if (error && error.code === "ENOENT") return "";
    throw error;
  }
}

module.exports = { compareVersions, redactHome, formatLine, lastAttempt, describePreviousInstall, appendLine, readLog, MAX_BYTES, KEEP_BYTES };
