import { describe, expect, it } from "vitest";

import { hasPendingUpdate, updateButtonLabel, updateMessage, type UpdateState } from "@/lib/desktop-update";

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
