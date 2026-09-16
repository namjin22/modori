"use server";

import { Prisma } from "@prisma/client";

import { revalidatePath } from "next/cache";

import {
  isNicknameTaken,
  normalizeNickname,
  MAX_NICKNAME_LENGTH,
  validateNickname,
} from "@/lib/nickname";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const MAX_BIO_LENGTH = 100;

export type ProfileFormState = { message: string } | null;

// 이모지 하나인지 본다. 사람 이름 자리에 문장이 들어가면 목록이 망가진다.
const SINGLE_EMOJI = /^\p{Extended_Pictographic}(\p{Emoji_Modifier}|️|‍\p{Extended_Pictographic})*$/u;

export async function updateProfile(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser();

  const nickname = normalizeNickname(formData.get("nickname"));
  const profileEmoji = String(formData.get("profileEmoji") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();

  const valid = validateNickname(nickname);
  if (!valid.ok) {
    return {
      message:
        valid.problem === "empty"
          ? "닉네임을 입력해주세요."
          : `닉네임은 1~${MAX_NICKNAME_LENGTH}자로 적어주세요.`,
    };
  }
  if (!SINGLE_EMOJI.test(profileEmoji)) {
    return { message: "프로필은 이모지 한 개로 정해주세요." };
  }
  if (bio.length > MAX_BIO_LENGTH) {
    return { message: `소개는 ${MAX_BIO_LENGTH}자까지 쓸 수 있어요.` };
  }

  if (await isNicknameTaken(nickname, user.id)) {
    return { message: "이미 쓰고 있는 닉네임이에요. 다른 이름으로 해주세요." };
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { nickname, profileEmoji, bio: bio || null },
    });
  } catch (error) {
    // 같은 순간에 같은 이름으로 둘이 저장하면 여기서 걸린다.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { message: "방금 누군가 같은 닉네임을 가져갔어요. 다시 골라주세요." };
    }
    throw error;
  }

  revalidatePath("/settings");
  revalidatePath("/settings/profile");
  revalidatePath("/feed");

  return { message: "저장했어요." };
}
