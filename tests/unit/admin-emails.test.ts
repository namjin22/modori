import { describe, expect, it } from "vitest";

import { adminEmails } from "@/lib/admin";
import { PRIVACY_MANAGER } from "@/lib/privacy";

describe("adminEmails", () => {
  const manager = PRIVACY_MANAGER.email.toLowerCase();

  it("환경변수가 없거나 비어 있으면 개인정보 보호책임자 한 명이다", () => {
    expect(adminEmails(undefined)).toEqual([manager]);
    expect(adminEmails("")).toEqual([manager]);
    expect(adminEmails("  ,  , ")).toEqual([manager]);
  });

  it("쉼표로 적은 이메일을 더한다: 앞뒤 공백을 자르고 소문자로 바꾸며 중복은 하나로", () => {
    expect(adminEmails("Second@Example.com, third@example.com")).toEqual([manager, "second@example.com", "third@example.com"]);
    expect(adminEmails(`${PRIVACY_MANAGER.email.toUpperCase()},second@example.com,SECOND@example.com`)).toEqual([manager, "second@example.com"]);
  });

  it("책임자는 환경변수에서 빼도 늘 운영자다", () => {
    expect(adminEmails("someone@example.com")).toContain(manager);
  });
});
