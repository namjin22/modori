"use server";

import { Prisma } from "@prisma/client";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { safeNext } from "@/lib/next-path";

import {
  isNicknameTaken,
  normalizeNickname,
  MAX_NICKNAME_LENGTH,
  validateNickname,
} from "@/lib/nickname";
import { prisma } from "@/lib/prisma";
import { isCharacterId } from "@/lib/characters";
import { isProfileImage } from "@/lib/profile-image";
import { getCurrentUser } from "@/lib/session";

// 빈 화면으로 시작하면 무엇부터 해야 할지 모른다. 지우거나 바꿀 수 있는 기본값을 하나 준다.
// 여러 개를 미리 만들어 두면 쓰지도 않는 칸이 화면을 채운다.
// 브랜드 파랑과 겹치는 색은 피한다. 카테고리 색인지 버튼 색인지 구분이 안 된다.
const DEFAULT_CATEGORIES = [{ name: "오늘", color: "#2563eb" }];

export type OnboardingState = { message: string } | null;

export async function saveNickname(
  _previous: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const userId = user.id;
  const nickname = normalizeNickname(formData.get("nickname"));

  const valid = validateNickname(nickname);
  if (!valid.ok) return { message: `닉네임은 1~${MAX_NICKNAME_LENGTH}자로 적어주세요.` };
  // 화면의 체크박스만 믿지 않는다. 동의 없이 가입되면 안 된다.
  if (formData.get("agree") !== "on") {
    return { message: "개인정보 수집·이용에 동의해주세요." };
  }

  // 가입할 때 고른 프로필 사진. 비어 있으면 도리 얼굴을 쓴다(components/avatar-choice.tsx).
  const profileImage = String(formData.get("profileImage") ?? "").trim();
  const characterValue = String(formData.get("avatarCharacter") ?? "");
  if (characterValue && !isCharacterId(characterValue)) return { message: "캐릭터를 고르지 못했어요. 다시 골라주세요." };
  if (formData.get("profileImageBusy")) {
    return { message: "사진을 줄이는 중이에요. 잠깐 뒤에 눌러주세요." };
  }
  if (profileImage && !isProfileImage(profileImage)) {
    return { message: "사진을 올리지 못했어요. 다른 사진이나 도리로 해주세요." };
  }

  if (await isNicknameTaken(nickname, userId)) {
    return { message: "이미 쓰고 있는 닉네임이에요. 다른 이름으로 해주세요." };
  }

  try {
    // 언제 동의했는지 남긴다. 방침이 바뀌면 이 시각과 시행일을 견줘 다시 물을 수 있다.
    await prisma.user.update({
      where: { id: userId },
      data: { nickname, privacyAgreedAt: new Date(), ...(profileImage && { profileImage }), ...(characterValue && { avatarCharacter: characterValue }) },
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

  // 온보딩을 다시 밟는 경우(닉네임만 지운 계정)에 중복으로 만들지 않는다.
  const existing = await prisma.category.count({ where: { userId } });
  if (existing === 0) {
    await prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((category, index) => ({
        ...category,
        userId,
        order: index,
      })),
    });
  }

  // 가입 전에 열어 둔 화면(온보딩으로 보내는 응답)을 브라우저가 기억하고 있으면 홈으로 가도 되돌아온다. 전부 비운다.
  revalidatePath("/", "layout");
  // 친구가 보낸 링크로 처음 가입했으면 그 화면으로 보낸다.
  redirect(safeNext(formData.get("next")) ?? "/");
}
