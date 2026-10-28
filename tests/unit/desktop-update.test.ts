import { describe, expect, it } from "vitest";

import { hasPendingUpdate, outdatedDesktopVersion, updateButtonLabel, updateMessage, type UpdateState } from "@/lib/desktop-update";

const base: UpdateState = { supported: true, current: "1.0.7", status: "idle", version: null, percent: 0, error: null };
const state = (patch: Partial<UpdateState>): UpdateState => ({ ...base, ...patch });

describe("hasPendingUpdate", () => {
  it("새 버전을 알고 아직 설치 전이면 true", () => {
    expect(hasPendingUpdate(state({ status: "available", version: "1.0.8" }))).toBe(true);
    expect(hasPendingUpdate(state({ status: "downloading", version: "1.0.8", percent: 40 }))).toBe(true);
    expect(hasPendingUpdate(state({ status: "installing", version: "1.0.8" }))).toBe(true);
  });

  it("받다가 실패한 것(버전을 안다)은 배너에 남겨 다시 시도하게 한다", () => {
    expect(hasPendingUpdate(state({ status: "error", version: "1.0.8", error: "net::ERR" }))).toBe(true);
  });

  it("확인만 실패했거나(버전을 모른다) 최신이면 false", () => {
    expect(hasPendingUpdate(state({ status: "error", error: "offline" }))).toBe(false);
    expect(hasPendingUpdate(state({ status: "none" }))).toBe(false);
    expect(hasPendingUpdate(state({ status: "checking" }))).toBe(false);
    expect(hasPendingUpdate(state({ status: "idle" }))).toBe(false);
  });

  it("앱 안 업데이트를 못 하는 앱(맥, 개발 중)이나 연결이 없으면 false", () => {
    expect(hasPendingUpdate(state({ supported: false, status: "available", version: "1.0.8" }))).toBe(false);
    expect(hasPendingUpdate(null)).toBe(false);
  });
});

describe("updateButtonLabel", () => {
  it("새 버전을 알면 받는 버튼, 모르면 확인하는 버튼", () => {
    expect(updateButtonLabel(state({ status: "idle" }))).toBe("업데이트 확인");
    expect(updateButtonLabel(state({ status: "none" }))).toBe("업데이트 확인");
    expect(updateButtonLabel(state({ status: "available", version: "1.0.8" }))).toBe("업데이트");
    expect(updateButtonLabel(state({ status: "downloading", version: "1.0.8", percent: 42 }))).toBe("받는 중 42%");
    expect(updateButtonLabel(state({ status: "installing", version: "1.0.8" }))).toBe("설치하는 중");
  });

  it("실패했을 때 글자는 새 버전을 아는지로 갈린다", () => {
    expect(updateButtonLabel(state({ status: "error", version: "1.0.8", error: "x" }))).toBe("다시 시도");
    expect(updateButtonLabel(state({ status: "error", error: "x" }))).toBe("다시 확인");
  });
});

describe("updateMessage", () => {
  it("상태마다 한 줄을 돌려준다", () => {
    expect(updateMessage(state({ status: "idle" }))).toBe("");
    expect(updateMessage(state({ status: "checking" }))).toBe("새 버전을 확인하고 있어요");
    expect(updateMessage(state({ status: "none" }))).toBe("최신 버전이에요");
    expect(updateMessage(state({ status: "available", version: "1.0.8" }))).toBe("새 버전 1.0.8이 나왔어요");
    expect(updateMessage(state({ status: "downloading", version: "1.0.8", percent: 7 }))).toBe("1.0.8 받는 중이에요 (7%)");
    expect(updateMessage(state({ status: "installing", version: "1.0.8" }))).toBe("설치하고 곧 다시 시작해요");
  });

  it("실패하면 원문 한 줄을 그대로 붙인다", () => {
    expect(updateMessage(state({ status: "error", error: "sha512 checksum mismatch" }))).toBe(
      "업데이트하지 못했어요: sha512 checksum mismatch",
    );
    expect(updateMessage(state({ status: "error" }))).toBe("업데이트하지 못했어요");
  });
});

describe("outdatedDesktopVersion", () => {
  const windows = (version: string) => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36 ModoriDesktop/${version}`;

  it("앱 안 업데이트가 없는 옛 Windows 앱이면 그 버전을 돌려준다", () => {
    expect(outdatedDesktopVersion(windows("1.0.6"))).toBe("1.0.6");
    expect(outdatedDesktopVersion(windows("1.0.0"))).toBe("1.0.0");
    expect(outdatedDesktopVersion(windows("0.9.9"))).toBe("0.9.9");
  });

  it("앱 안 업데이트가 들어간 버전부터는 null(그 앱은 스스로 새 버전을 알린다)", () => {
    expect(outdatedDesktopVersion(windows("1.0.7"))).toBeNull();
    expect(outdatedDesktopVersion(windows("1.0.8"))).toBeNull();
    expect(outdatedDesktopVersion(windows("1.1.0"))).toBeNull();
    expect(outdatedDesktopVersion(windows("2.0.0"))).toBeNull();
  });

  it("버전 숫자는 글자가 아니라 숫자로 비교한다(1.0.10은 1.0.7보다 새 것)", () => {
    expect(outdatedDesktopVersion(windows("1.0.10"))).toBeNull();
    expect(outdatedDesktopVersion(windows("1.10.0"))).toBeNull();
  });

  it("맥 앱은 받기 링크가 Windows 설치 파일이라 null", () => {
    expect(outdatedDesktopVersion("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/150 Safari/537.36 ModoriDesktop/1.0.6")).toBeNull();
  });

  it("데스크톱 앱이 아니거나 버전을 읽을 수 없으면 null", () => {
    expect(outdatedDesktopVersion("")).toBeNull();
    expect(outdatedDesktopVersion("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/150 Safari/537.36")).toBeNull();
    expect(outdatedDesktopVersion("Mozilla/5.0 (Linux; Android 14) ModoriMobile/1.0.0")).toBeNull();
    expect(outdatedDesktopVersion(windows("abc"))).toBeNull();
    expect(outdatedDesktopVersion(windows("1.0"))).toBeNull();
  });
});
