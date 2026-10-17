"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { isReminderMinute, sentOnWhenSet } from "@/lib/reminder";
import { requireUser } from "@/lib/session";
import { isAllowedTimezone } from "@/lib/timezones";

/** 친구 찾기의 추천 목록에 내가 나오지 않게 할지(true면 숨김). */
export async function setHideFromRecommend(hidden: boolean) {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { hideFromRecommend: hidden === true } });
  revalidatePath("/settings");
  revalidatePath("/feed/search");
}

/**
 * 이 사람의 "오늘"을 정하는 시간대를 바꾼다. 목록(lib/timezones.ts)에 있는 값만 받는다.
 * 모든 화면의 오늘·루틴·달력이 이 기준으로 다시 그려지도록 전체 화면 캐시를 비운다.
 */
export async function setTimezone(timezone: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!isAllowedTimezone(timezone)) return { ok: false };
  await prisma.user.update({ where: { id: user.id }, data: { timezone } });
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * 할 일 리마인드(앱 푸시, 하루 한 번)를 켜고 시각을 정하거나(자정부터 몇 분째, 5분 단위) 끈다(null).
 * 오늘의 그 시각이 이미 지났으면 오늘 몫은 보낸 것으로 쳐서, 고르자마자 알림이 울리지 않게 한다(lib/reminder.ts).
 */
export async function setReminder(minute: number | null): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (minute !== null && !isReminderMinute(minute)) return { ok: false };
  await prisma.user.update({
    where: { id: user.id },
    data: { reminderMinute: minute, reminderSentOn: minute === null ? null : sentOnWhenSet(minute, user.timezone, new Date()) },
  });
  revalidatePath("/settings");
  return { ok: true };
}

/** 팔로우한 친구가 할 일을 끝내면 앱 푸시로 받을지(lib/friend-done.ts). 소셜 알림 목록에는 이 값과 상관없이 보인다. */
export async function setNotifyFriendDone(on: boolean) {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { notifyFriendDone: on === true } });
  revalidatePath("/settings");
}
