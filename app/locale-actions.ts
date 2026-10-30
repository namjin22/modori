"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { isLocale, LOCALE_COOKIE } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * 화면 언어를 바꾼다. 기기의 쿠키에 적어 로그인 전 화면도 이 언어로 그리고, 로그인한 계정이면 계정에도 적어
 * 다른 기기와 푸시 알림이 같은 언어를 쓰게 한다. 목록(lib/i18n/index.ts)에 있는 값만 받는다.
 */
export async function setLocale(locale: string): Promise<{ ok: boolean }> {
  if (!isLocale(locale)) return { ok: false };
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  const user = await getCurrentUser();
  if (user && user.locale !== locale) await prisma.user.update({ where: { id: user.id }, data: { locale } });
  // 모든 화면의 글이 바뀐다. 전체 화면 캐시를 비운다.
  revalidatePath("/", "layout");
  return { ok: true };
}
