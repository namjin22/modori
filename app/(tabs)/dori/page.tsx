import type { Metadata } from "next";

import { DoriFace } from "@/components/avatar";
import { BackLink } from "@/components/back-link";
import { Dori, type DoriMood } from "@/components/dori";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "도리 모음 · 모도리" };

// 도리의 표정을 한눈에 본다. 메뉴에는 두지 않고 주소(/dori)로만 들어온다.
// 표정을 새로 쓰거나 바꿀 때 어디에 쓰이는지 여기 적어 둔다.
const MOODS: { mood: DoriMood; name: string; usedIn: string }[] = [
  { mood: "happy", name: "기본", usedIn: "반응(방긋)" },
  { mood: "like", name: "좋아요", usedIn: "기본 프로필 사진(소품 없이), 반응(좋아해)" },
  { mood: "hello", name: "안녕", usedIn: "닉네임 정하기, 팔로우한 친구가 없을 때 소셜, 반응" },
  { mood: "calm", name: "느긋", usedIn: "빈 목록(할 일·받은 반응·기록·친구 화면), 반응(느긋해)" },
  { mood: "party", name: "축하", usedIn: "그날 할 일을 다 끝냈을 때, 반응(축하해)" },
  { mood: "sad", name: "슬픔", usedIn: "계정 지우기, 오류 화면, 반응(아쉬워)" },
  { mood: "confused", name: "갸웃", usedIn: "없는 주소, 반응" },
  { mood: "fire", name: "불타요", usedIn: "반응" },
  { mood: "clap", name: "대단해", usedIn: "반응" },
  { mood: "cool", name: "멋져", usedIn: "반응" },
  { mood: "wow", name: "놀라워", usedIn: "반응" },
  { mood: "love", name: "반했어", usedIn: "반응" },
];

export default async function DoriPage() {
  await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-1">
        <BackLink href="/settings" label="마이페이지로" />
        <h1 className="text-2xl font-bold">도리 모음</h1>
      </header>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {MOODS.map(({ mood, name, usedIn }) => (
          <li key={mood} className="flex flex-col items-center gap-2 rounded-2xl bg-surface p-4 text-center">
            <Dori mood={mood} size={96} label={name} />
            <p className="text-sm font-semibold">
              {name} <span className="font-normal text-muted">({mood})</span>
            </p>
            <p className="text-xs text-muted">{usedIn}</p>
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
        <h2 className="text-sm font-semibold">기본 프로필 사진</h2>
        <div className="flex items-end gap-4">
          {[64, 48, 36, 28].map((size) => (
            <DoriFace key={size} size={size} className="rounded-full" />
          ))}
        </div>
      </section>
    </div>
  );
}
