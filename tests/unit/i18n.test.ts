// 화면 언어(lib/i18n): 사전의 세 언어가 서로 어긋나지 않는지, 글 안의 {이름}이 같은지, 영어·일본어에 한글이 새지 않았는지.
import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, LOCALES, isLocale, localeOrDefault, translate, translator, type MessageBundle } from "@/lib/i18n";
import { alarms } from "@/lib/i18n/messages/alarms";
import { auth } from "@/lib/i18n/messages/auth";
import { categories, colorNames } from "@/lib/i18n/messages/categories";
import { characterNames } from "@/lib/i18n/messages/characters";
import { common } from "@/lib/i18n/messages/common";
import { datetime } from "@/lib/i18n/messages/datetime";
import { desktop } from "@/lib/i18n/messages/desktop";
import { errors } from "@/lib/i18n/messages/errors";
import { events } from "@/lib/i18n/messages/events";
import { language } from "@/lib/i18n/messages/language";
import { legal } from "@/lib/i18n/messages/legal";
import { nav } from "@/lib/i18n/messages/nav";
import { notices } from "@/lib/i18n/messages/notices";
import { profile } from "@/lib/i18n/messages/profile";
import { emojiLabels, reactions } from "@/lib/i18n/messages/reactions";
import { routines } from "@/lib/i18n/messages/routines";
import { settings } from "@/lib/i18n/messages/settings";
import { social } from "@/lib/i18n/messages/social";
import { stats } from "@/lib/i18n/messages/stats";
import { timezoneNames } from "@/lib/i18n/messages/timezones";
import { todos } from "@/lib/i18n/messages/todos";

// 파일 이름 → 그 파일이 내보내는 사전들. 새 사전 파일을 더하면 여기에도 적어야 시험이 본다.
const FILES: Record<string, Record<string, MessageBundle>> = {
  alarms: { alarms },
  auth: { auth },
  categories: { categories, colorNames },
  characters: { characterNames },
  common: { common },
  datetime: { datetime },
  desktop: { desktop },
  errors: { errors },
  events: { events },
  language: { language },
  legal: { legal },
  nav: { nav },
  notices: { notices },
  profile: { profile },
  reactions: { reactions, emojiLabels },
  routines: { routines },
  settings: { settings },
  social: { social },
  stats: { stats },
  timezones: { timezoneNames },
  todos: { todos },
};

const HANGUL = /[ㄱ-ㆎ가-힣]/;
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

const ALL = Object.entries(FILES).flatMap(([file, bundles]) => Object.entries(bundles).map(([name, bundle]) => ({ file, name, bundle })));

describe("사전 파일", () => {
  it("lib/i18n/messages의 모든 파일이 이 시험에 올라 있다", () => {
    const files = readdirSync(join(process.cwd(), "lib/i18n/messages"))
      .filter((name) => name.endsWith(".ts"))
      .map((name) => name.replace(/\.ts$/, ""))
      .sort();
    expect(files).toEqual(Object.keys(FILES).sort());
  });
});

describe.each(ALL)("$file / $name", ({ bundle }) => {
  it("세 언어의 열쇠가 같다", () => {
    const keys = Object.keys(bundle.ko).sort();
    for (const locale of LOCALES) expect(Object.keys(bundle[locale]).sort()).toEqual(keys);
  });

  it("글 안의 {이름}이 세 언어에서 같다", () => {
    for (const key of Object.keys(bundle.ko)) {
      const expected = placeholders(bundle.ko[key]);
      for (const locale of LOCALES) expect(placeholders(bundle[locale][key]), `${locale} ${key}`).toEqual(expected);
    }
  });

  it("영어·일본어에는 한글이 없고, 비어 있지 않다", () => {
    for (const locale of ["en", "ja"] as const) {
      for (const [key, text] of Object.entries(bundle[locale])) {
        expect(HANGUL.test(text), `${locale} ${key}: ${text}`).toBe(false);
        expect(text.length, `${locale} ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("한국어는 (알림 안내 한 곳만 빼고) 비어 있지 않다", () => {
    for (const [key, text] of Object.entries(bundle.ko)) {
      if (key === "koreanOnly") continue;
      expect(text.length, `ko ${key}`).toBeGreaterThan(0);
    }
  });
});

describe("translate", () => {
  const sample = { ko: { a: "{name}님 {count}개" }, en: { a: "{name}: {count}" }, ja: { a: "{name}さん{count}件" } };

  it("{이름}을 값으로 채운다", () => {
    expect(translate(sample, "ko", "a", { name: "남진", count: 3 })).toBe("남진님 3개");
    expect(translate(sample, "en", "a", { name: "Jin", count: 3 })).toBe("Jin: 3");
    expect(translate(sample, "ja", "a", { name: "ジン", count: 3 })).toBe("ジンさん3件");
  });

  it("값이 없는 {이름}은 그대로 둔다", () => {
    expect(translate(sample, "en", "a", { name: "Jin" })).toBe("Jin: {count}");
  });

  it("translator는 언어를 미리 묶는다", () => {
    expect(translator(sample, "en")("a", { name: "Jin", count: 1 })).toBe("Jin: 1");
  });
});

describe("언어 값", () => {
  it("목록에 있는 값만 받고, 아니면 한국어로 돌린다", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(localeOrDefault("ja")).toBe("ja");
    expect(localeOrDefault("fr")).toBe(DEFAULT_LOCALE);
    expect(DEFAULT_LOCALE).toBe("ko");
  });
});
