import Link from "next/link";

import { followUser, unfollowUser } from "@/app/(tabs)/feed/actions";
import { Avatar } from "@/components/avatar";
import { SubmitButton } from "@/components/submit-button";
import { avatarUrl } from "@/lib/avatar";

export type Person = {
  id: string;
  nickname: string | null;
  profileImage: string | null;
  avatarCharacter: string | null;
};

/** 사람 한 줄(사진, 닉네임, 팔로우 버튼). 친구 찾기 결과와 추천 친구가 같이 쓴다. */
export function PersonRow({ person, isFollowing }: { person: Person; isFollowing: boolean }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-surface p-4">
      {/* 팔로우하지 않은 사람의 화면은 "팔로우하면 볼 수 있어요" 안내가 뜬다. */}
      <Link prefetch={false} href={`/feed/u/${person.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar src={avatarUrl(person)} size={36} />
        <span className="truncate font-medium">{person.nickname}</span>
      </Link>

      <form action={isFollowing ? unfollowUser : followUser}>
        <input type="hidden" name="targetId" value={person.id} />
        <SubmitButton
          pendingLabel="처리 중"
          className={`h-9 rounded-full px-4 text-sm font-medium ${
            isFollowing ? "bg-surface-hover text-muted" : "bg-brand text-brand-contrast"
          }`}
        >
          {isFollowing ? "팔로우 중" : "팔로우"}
        </SubmitButton>
      </form>
    </li>
  );
}
