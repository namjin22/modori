"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_NICKNAME_LENGTH = 20;

export async function saveNickname(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const raw = formData.get("nickname");
  const nickname = typeof raw === "string" ? raw.trim() : "";

  if (nickname.length === 0 || nickname.length > MAX_NICKNAME_LENGTH) {
    redirect("/onboarding?error=length");
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { nickname },
  });

  redirect("/");
}
