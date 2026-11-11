import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  appendLine,
  compareVersions,
  describePreviousInstall,
  formatLine,
  KEEP_BYTES,
  lastAttempt,
  MAX_BYTES,
  readLog,
  redactHome,
} from "../../desktop/update-log";

const NOW = new Date("2026-11-11T01:02:03.000Z");

describe("compareVersions", () => {
  it("앞이 작으면 -1, 같으면 0, 크면 1", () => {
    expect(compareVersions("1.0.8", "1.0.9")).toBe(-1);
    expect(compareVersions("1.0.9", "1.0.9")).toBe(0);
    expect(compareVersions("1.0.9", "1.0.8")).toBe(1);
  });

  it("글자가 아니라 숫자로 견준다(1.0.10은 1.0.9보다 크다)", () => {
    expect(compareVersions("1.0.10", "1.0.9")).toBe(1);
    expect(compareVersions("1.10.0", "1.9.9")).toBe(1);
  });

  it("자릿수가 달라도 빈 자리는 0으로 본다", () => {
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
  });

  it("숫자가 아니면 견줄 수 없어 0", () => {
    expect(compareVersions("1.0.x", "1.0.9")).toBe(0);
  });
});

describe("redactHome", () => {
  it("홈 폴더 경로를 ~로 바꾸고 대소문자는 가리지 않는다", () => {
    const home = "C:\\Users\\남진";
    expect(redactHome("Executing: C:\\Users\\남진\\AppData\\Local\\x\\a.exe", home)).toBe("Executing: ~\\AppData\\Local\\x\\a.exe");
    expect(redactHome("c:\\users\\남진\\a", home)).toBe("~\\a");
  });

  it("정규식 글자가 든 경로도 그대로 찾는다", () => {
    expect(redactHome("C:\\Users\\a.b+c\\x", "C:\\Users\\a.b+c")).toBe("~\\x");
    expect(redactHome("C:\\Users\\aXb+c\\x", "C:\\Users\\a.b+c")).toBe("C:\\Users\\aXb+c\\x");
  });

  it("홈이 비어 있으면 그대로 둔다", () => {
    expect(redactHome("abc", "")).toBe("abc");
  });
});

describe("formatLine", () => {
  it("시각, 수준, 내용을 한 줄로 만든다", () => {
    expect(formatLine("info", "start version=1.0.9", "", NOW)).toBe("2026-11-11T01:02:03.000Z info start version=1.0.9\n");
  });

  it("줄바꿈은 공백으로 바꿔 한 사건을 한 줄에 둔다", () => {
    expect(formatLine("error", "첫 줄\n  둘째 줄\r\n셋째", "", NOW)).toBe("2026-11-11T01:02:03.000Z error 첫 줄 둘째 줄 셋째\n");
  });

  it("오류 객체는 stack을 쓰고 홈 경로를 가린다", () => {
    const error = new Error("boom");
    error.stack = "Error: boom\n    at C:\\Users\\me\\app\\x.js:1:1";
    expect(formatLine("error", error, "C:\\Users\\me", NOW)).toBe("2026-11-11T01:02:03.000Z error Error: boom at ~\\app\\x.js:1:1\n");
  });
});

const line = (text: string) => `2026-11-11T01:00:00.000Z info ${text}\n`;

describe("lastAttempt / describePreviousInstall", () => {
  it("설치 시도가 없으면 null", () => {
    expect(lastAttempt(line("start version=1.0.8"))).toBeNull();
    expect(describePreviousInstall(line("start version=1.0.8"), "1.0.8")).toBeNull();
    expect(describePreviousInstall("", "1.0.8")).toBeNull();
  });

  it("목표 버전으로 다시 켜졌으면 적용된 것", () => {
    const log = line("install-attempt target=1.0.9 from=1.0.8");
    expect(describePreviousInstall(log, "1.0.9")).toBe("install-result target=1.0.9 applied=true current=1.0.9");
  });

  it("목표보다 낮은 버전으로 켜졌으면 적용되지 않은 것(제보된 증상)", () => {
    const log = line("install-attempt target=1.0.9 from=1.0.8");
    expect(describePreviousInstall(log, "1.0.8")).toBe("install-result target=1.0.9 applied=false current=1.0.8");
  });

  it("이미 결과를 적었으면 다시 적지 않는다", () => {
    const log = line("install-attempt target=1.0.9 from=1.0.8") + line("install-result target=1.0.9 applied=false current=1.0.8");
    expect(describePreviousInstall(log, "1.0.8")).toBeNull();
  });

  it("가장 나중의 시도만 본다: 앞 시도의 결과는 새 시도를 가리지 않는다", () => {
    const log =
      line("install-attempt target=1.0.9 from=1.0.8") +
      line("install-result target=1.0.9 applied=false current=1.0.8") +
      line("install-attempt target=1.0.9 from=1.0.8");
    expect(lastAttempt(log)).toEqual({ target: "1.0.9", resolved: false });
    expect(describePreviousInstall(log, "1.0.9")).toBe("install-result target=1.0.9 applied=true current=1.0.9");
  });
});

describe("appendLine / readLog", () => {
  const dirs: string[] = [];
  const makeFile = () => {
    const dir = mkdtempSync(path.join(tmpdir(), "modori-updatelog-"));
    dirs.push(dir);
    return path.join(dir, "updater.log");
  };

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("파일이 없으면 빈 글자를 돌려주고, 줄을 더하면 이어 붙는다", () => {
    const file = makeFile();
    expect(readLog(file)).toBe("");
    appendLine(file, "a\n");
    appendLine(file, "b\n");
    expect(readLog(file)).toBe("a\nb\n");
  });

  it("너무 커지면 뒤쪽 일부만 남기고, 잘린 첫 줄은 버린다", () => {
    const file = makeFile();
    const row = `${"x".repeat(99)}\n`;
    writeFileSync(file, row.repeat(Math.ceil(MAX_BYTES / row.length) + 5));
    appendLine(file, "마지막 줄\n");

    const text = readFileSync(file, "utf8");
    expect(statSync(file).size).toBeLessThanOrEqual(KEEP_BYTES);
    expect(text.endsWith("마지막 줄\n")).toBe(true);
    // 모든 줄이 온전하다(잘린 줄이 남지 않는다).
    expect(text.split("\n").every((each) => each === "" || each === "마지막 줄" || each === "x".repeat(99))).toBe(true);
  });

  it("없는 파일 말고 다른 이유로 못 읽으면 던진다", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "modori-updatelog-"));
    dirs.push(dir);
    // 폴더를 파일처럼 읽으면 ENOENT가 아닌 오류가 난다.
    expect(() => readLog(dir)).toThrow();
  });
});
