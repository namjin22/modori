import type { Metadata } from "next";

import { FriendFollowList } from "../follow-list";

export const metadata: Metadata = { title: "팔로우 · 모도리" };

export default async function FriendFollowingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FriendFollowList id={id} kind="following" />;
}
