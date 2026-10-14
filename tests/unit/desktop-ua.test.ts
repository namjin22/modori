import { beforeEach, describe, expect, it, vi } from "vitest";

let ua = "";
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "user-agent": ua }) }));

import { isAndroidApp, isMobileApp } from "@/lib/desktop";

const ANDROID_APP = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36 ModoriMobile/1.0.0";
const IOS_APP = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 ModoriMobile/1.0.0";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36";

describe("앱 구분(Apple 로그인 버튼을 안드로이드 앱에서만 숨긴다)", () => {
  beforeEach(() => {
    ua = "";
  });

  it("안드로이드 앱만 안드로이드 앱이다. 아이폰 앱과 안드로이드 브라우저는 아니다", async () => {
    ua = ANDROID_APP;
    expect(await isAndroidApp()).toBe(true);
    expect(await isMobileApp()).toBe(true);
    ua = IOS_APP;
    expect(await isAndroidApp()).toBe(false);
    expect(await isMobileApp()).toBe(true);
    ua = ANDROID_CHROME;
    expect(await isAndroidApp()).toBe(false);
  });
});
