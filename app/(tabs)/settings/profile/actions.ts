"use server";

import { Prisma } from "@prisma/client";

import { revalidatePath } from "next/cache";

import {
  isNicknameTaken,
  normalizeNickname,
  MAX_NICKNAME_LENGTH,
  validateNickname,
} from "@/lib/nickname";
import { auth } from "@/lib/i18n/messages/auth";
import { profile as profileMessages } from "@/lib/i18n/messages/profile";
import { getT } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";
import { isCharacterId } from "@/lib/characters";
import { isProfileImage } from "@/lib/profile-image";
import { requireUser } from "@/lib/session";

const MAX_BIO_LENGTH = 100;

export type ProfileFormState = { message: string } | null;

export async function updateProfile(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser();
  const t = await getT(auth);
  const tp = await getT(profileMessages);

  const nickname = normalizeNickname(formData.get("nickname"));
  const profileImage = String(formData.get("profileImage") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const characterValue = String(formData.get("avatarCharacter") ?? "");
  if (characterValue && !isCharacterId(characterValue)) return { message: t("badCharacter") };

  const valid = validateNickname(nickname);
  if (!valid.ok) {
    return {
      message:
        valid.problem === "empty" ? tp("nicknameRequired") : t("nicknameLength", { max: MAX_NICKNAME_LENGTH }),
    };
  }
  if (formData.get("profileImageBusy")) {
    return { message: tp("photoResizing") };
  }
  if (profileImage && !isProfileImage(profileImage)) {
    return { message: tp("photoUploadFailed") };
  }
  if (bio.length > MAX_BIO_LENGTH) {
    return { message: tp("bioTooLong", { max: MAX_BIO_LENGTH }) };
  }

  if (await isNicknameTaken(nickname, user.id)) {
    return { message: t("nicknameTaken") };
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        nickname,
        profileImage: profileImage || null,
        // 사진을 쓰는 동안에도 마지막에 고른 캐릭터를 남겨 둔다(사진을 지우면 그 캐릭터로 돌아간다).
        ...(characterValue && { avatarCharacter: characterValue }),
        bio: bio || null,
      },
    });
  } catch (error) {
    // 같은 순간에 같은 이름으로 둘이 저장하면 여기서 걸린다.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { message: t("nicknameJustTaken") };
    }
    throw error;
  }

  revalidatePath("/settings");
  revalidatePath("/settings/profile");
  revalidatePath("/feed");

  return { message: tp("saved") };
}
