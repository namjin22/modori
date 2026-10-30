"use server";

import { revalidatePath } from "next/cache";

import { MAX_ALARMS, alarmSentOnWhenSet, isAlarmMinute, readAlarmMessage, readWeekdays } from "@/lib/alarm";
import { settings } from "@/lib/i18n/messages/settings";
import { getT } from "@/lib/i18n/server";
import { isId } from "@/lib/ids";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export type AlarmFormState = { message: string; ok?: boolean } | null;

/** 내가 정한 알림을 만들거나(id가 없을 때) 고친다. 시각은 5분 단위, 요일을 안 고르면 매일, 문구는 60자까지(lib/alarm.ts). */
export async function saveAlarm(_previous: AlarmFormState, formData: FormData): Promise<AlarmFormState> {
  const user = await requireUser();
  const t = await getT(settings);

  const minute = Number(formData.get("minute"));
  if (!isAlarmMinute(minute)) return { message: t("alarmTimeAgain") };
  const weekdays = readWeekdays(formData.getAll("weekday"));
  if (!weekdays) return { message: t("alarmWeekdaysAgain") };
  const message = readAlarmMessage(formData.get("message"));
  if (!message) return { message: t("alarmMessage") };

  const rawId = formData.get("id");
  const id = typeof rawId === "string" && rawId ? rawId : null;
  if (id !== null && !isId(id)) return { message: t("alarmNotFound") };

  // 시각이 이미 지난 알림은 오늘 몫을 보낸 것으로 쳐서, 만들거나 고치자마자 울리지 않게 한다.
  const data = { minute, weekdays, message, lastSentOn: alarmSentOnWhenSet(minute, user.timezone, new Date()) };

  if (id === null) {
    const count = await prisma.alarm.count({ where: { userId: user.id } });
    if (count >= MAX_ALARMS) return { message: t("alarmTooMany", { max: MAX_ALARMS }) };
    await prisma.alarm.create({ data: { userId: user.id, ...data } });
  } else {
    const updated = await prisma.alarm.updateMany({ where: { id, userId: user.id }, data });
    if (updated.count === 0) return { message: t("alarmGone") };
  }

  revalidatePath("/settings/alarms");
  revalidatePath("/settings");
  return { message: t("alarmSaved"), ok: true };
}

/** 알림을 켜거나 끈다. 켤 때도 오늘의 그 시각이 지났으면 오늘 몫은 보낸 것으로 친다. */
export async function setAlarmEnabled(id: string, enabled: boolean): Promise<void> {
  const user = await requireUser();
  if (!isId(id)) return;
  const alarm = await prisma.alarm.findFirst({ where: { id, userId: user.id }, select: { minute: true } });
  if (!alarm) return;
  await prisma.alarm.updateMany({
    where: { id, userId: user.id },
    data: { enabled: enabled === true, ...(enabled === true && { lastSentOn: alarmSentOnWhenSet(alarm.minute, user.timezone, new Date()) }) },
  });
  revalidatePath("/settings/alarms");
}

export async function deleteAlarm(id: string): Promise<void> {
  const user = await requireUser();
  if (!isId(id)) return;
  await prisma.alarm.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/settings/alarms");
  revalidatePath("/settings");
}
