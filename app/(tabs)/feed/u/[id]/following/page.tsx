import type { Metadata } from "next";

import { settings } from "@/lib/i18n/messages/settings";
import { getT } from "@/lib/i18n/server";

import { FriendFollowList } from "../follow-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT(settings))("followingPageTitle") };
}

export default async function FriendFollowingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FriendFollowList id={id} kind="following" />;
}
