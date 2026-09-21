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
import { isProfileImage } from "@/lib/profile-image";
import { requireUser } from "@/lib/session";

const MAX_BIO_LENGTH = 100;

export type ProfileFormState = { message: string } | null;

export async function updateProfile(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser();

  const nickname = normalizeNickname(formData.get("nickname"));
  const profileImage = String(formData.get("profileImage") ?? "").trim();
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
  if (formData.get("profileImageBusy")) {
    return { message: "사진을 줄이는 중이에요. 잠깐 뒤에 저장해주세요." };
  }
  if (profileImage && !isProfileImage(profileImage)) {
    return { message: "사진을 올리지 못했어요. 다른 파일로 해보세요." };
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
      data: { nickname, profileImage: profileImage || null, bio: bio || null },
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
