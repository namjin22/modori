import { PersonRow } from "@/components/person-row";
import { ShuffleButton } from "@/components/shuffle-button";
import { recommendPeople, recommendSeed } from "@/lib/recommend";

/**
 * 추천 친구 세 명과 "다른 사람 보기" 버튼. 친구 찾기 화면과, 아직 아무도 팔로우하지 않은 사람의 소셜 화면이 같이 쓴다.
 * 추천할 사람이 없으면 아무것도 그리지 않는다. shufflePath는 다시 뽑을 때 주소를 바꿀 화면이다.
 */
export async function RecommendedFriends({
  userId,
  seed,
  shufflePath,
}: {
  userId: string;
  seed: string | undefined;
  shufflePath: string;
}) {
  const people = await recommendPeople(userId, recommendSeed(seed));
  if (people.length === 0) return null;

  return (
    <section aria-label="추천 친구" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">추천 친구</h2>
        <ShuffleButton path={shufflePath} />
      </div>
      <ul className="flex flex-col gap-3">
        {people.map((person) => (
          <PersonRow key={person.id} person={person} isFollowing={false} />
        ))}
      </ul>
    </section>
  );
}
