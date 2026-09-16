"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const MAX_NICKNAME_LENGTH = 20;
const MAX_BIO_LENGTH = 100;

export type ProfileFormState = { message: string } | null;

// 이모지 하나인지 본다. 사람 이름 자리에 문장이 들어가면 목록이 망가진다.
const SINGLE_EMOJI = /^\p{Extended_Pictographic}(\p{Emoji_Modifier}|️|‍\p{Extended_Pictographic})*$/u;

export async function updateProfile(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser();

  const nickname = String(formData.get("nickname") ?? "").trim();
  const profileEmoji = String(formData.get("profileEmoji") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();

  if (nickname.length === 0) {
    return { message: "닉네임을 입력해주세요." };
  }
  if (nickname.length > MAX_NICKNAME_LENGTH) {
    return { message: `닉네임은 ${MAX_NICKNAME_LENGTH}자까지 쓸 수 있어요.` };
  }
  if (!SINGLE_EMOJI.test(profileEmoji)) {
    return { message: "프로필은 이모지 한 개로 정해주세요." };
  }
  if (bio.length > MAX_BIO_LENGTH) {
    return { message: `소개는 ${MAX_BIO_LENGTH}자까지 쓸 수 있어요.` };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { nickname, profileEmoji, bio: bio || null },
  });

  revalidatePath("/settings");
  revalidatePath("/settings/profile");
  revalidatePath("/feed");

  return { message: "저장했어요." };
}
