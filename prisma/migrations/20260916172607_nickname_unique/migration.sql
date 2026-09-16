-- 닉네임은 친구를 찾는 이름이라 겹치면 안 된다.
-- 적용 전 중복 확인: lower(nickname) 기준 중복 0건.
CREATE UNIQUE INDEX "User_nickname_key" ON "User"("nickname");
