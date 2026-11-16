"use server";

import { revalidatePath } from "next/cache";

import {
  API_TOKEN_EXPIRY_DAYS,
  API_TOKEN_SCOPES,
  MAX_API_TOKENS,
  MAX_TOKEN_NAME_LENGTH,
  tokenExpiry,
  type ApiTokenScopeName,
} from "@/lib/api-token";
import { generateApiToken } from "@/lib/api-token-secret";
import { ai } from "@/lib/i18n/messages/ai";
import { getT } from "@/lib/i18n/server";
import { isId } from "@/lib/ids";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

/** token은 이 응답에서만 보인다. 어디에도 값이 남지 않는다(DB에는 해시만 둔다). */
export type CreateTokenResult = { ok: true; token: string } | { ok: false; message: string };

function readScope(value: FormDataEntryValue | null): ApiTokenScopeName | null {
  return API_TOKEN_SCOPES.find((scope) => scope === value) ?? null;
}

function readExpiryDays(value: FormDataEntryValue | null): number | null {
  const days = Number(value);
  return API_TOKEN_EXPIRY_DAYS.find((allowed) => allowed === days) ?? null;
}

export async function createApiToken(formData: FormData): Promise<CreateTokenResult> {
  const user = await requireUser();
  const t = await getT(ai);

  const rawName = formData.get("name");
  const name = typeof rawName === "string" ? rawName.trim() : "";
  if ([...name].length < 1 || [...name].length > MAX_TOKEN_NAME_LENGTH) return { ok: false, message: t("nameAgain", { max: MAX_TOKEN_NAME_LENGTH }) };
  const scope = readScope(formData.get("scope"));
  if (!scope) return { ok: false, message: t("scopeAgain") };
  const days = readExpiryDays(formData.get("days"));
  if (!days) return { ok: false, message: t("expiryAgain") };

  const count = await prisma.apiToken.count({ where: { userId: user.id } });
  if (count >= MAX_API_TOKENS) return { ok: false, message: t("full", { max: MAX_API_TOKENS }) };

  const { token, hash, hint } = generateApiToken();
  // 친구의 공개 정보를 읽게 할지는 권한과 따로 묻고 기본은 끈다(체크하지 않으면 값이 오지 않는다).
  const allowFriends = formData.get("friends") === "on";
  await prisma.apiToken.create({ data: { userId: user.id, name, scope, allowFriends, tokenHash: hash, hint, expiresAt: tokenExpiry(days) } });

  revalidatePath("/settings/ai");
  revalidatePath("/settings/preferences");
  return { ok: true, token };
}

/** 토큰을 지운다. 지우는 즉시 그 토큰을 쓰는 AI의 요청이 401로 막힌다. */
export async function deleteApiToken(id: string): Promise<void> {
  const user = await requireUser();
  if (!isId(id)) return;
  await prisma.apiToken.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/settings/ai");
  revalidatePath("/settings/preferences");
}
