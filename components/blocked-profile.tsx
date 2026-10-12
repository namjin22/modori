import { Avatar } from "@/components/avatar";
import { BackLink } from "@/components/back-link";
import { UnblockButton } from "@/components/unblock-button";

/** 내가 차단한 사람의 화면. 할 일은 보이지 않고, 차단을 풀 수만 있다. */
export function BlockedProfile({ nickname, avatar, targetId }: { nickname: string; avatar: string | null; targetId: string }) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-1">
        <BackLink href="/feed" label="소셜로" />
      </header>
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-surface px-6 py-10 text-center">
        <Avatar src={avatar} size={72} />
        <h1 className="text-xl font-bold">{nickname}</h1>
        <p className="max-w-xs text-sm text-muted text-balance">차단한 사람이에요. 차단을 풀면 다시 찾고 팔로우할 수 있어요.</p>
        <UnblockButton targetId={targetId} />
      </div>
    </div>
  );
}
