import { Avatar } from "@/components/avatar";
import { BackLink } from "@/components/back-link";
import { SubmitButton } from "@/components/submit-button";

/**
 * 팔로우하지 않은 사람의 프로필. 닉네임과 사진(찾기 목록에서도 보이는 정보)만 보이고,
 * 할 일·소개·팔로우 수는 팔로우해야 보인다(개인정보처리방침 4번). 서버 액션은 넘겨 받는다.
 */
export function LockedProfile({
  nickname,
  avatar,
  follow,
  targetId,
}: {
  nickname: string;
  avatar: string | null;
  follow: (formData: FormData) => Promise<void>;
  targetId: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-1">
        <BackLink href="/feed" label="소셜로" />
      </header>
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-surface px-6 py-10 text-center">
        <Avatar src={avatar} size={72} />
        <h1 className="text-xl font-bold">{nickname}</h1>
        <p className="max-w-xs text-sm text-muted text-balance">
          팔로우하면 {nickname}님의 할 일을 볼 수 있어요.
        </p>
        <form action={follow}>
          <input type="hidden" name="targetId" value={targetId} />
          <SubmitButton
            pendingLabel="처리 중"
            className="h-11 rounded-full bg-brand px-8 text-sm font-semibold text-brand-contrast"
          >
            팔로우
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
