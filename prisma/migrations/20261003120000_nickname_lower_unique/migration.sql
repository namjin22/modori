-- 닉네임은 대소문자를 구분하지 않고 하나뿐이다(Ab와 ab는 같은 이름). 앱이 가입·변경할 때 먼저 검사하지만,
-- 같은 순간에 둘이 저장하면 검사를 둘 다 통과한다. 마지막 방어선을 DB에 둔다.
-- Prisma 스키마로는 표현할 수 없는 식 인덱스라 이 마이그레이션에만 있다. 지우는 것은 없다.
CREATE UNIQUE INDEX "User_nickname_lower_key" ON "User" (lower("nickname"));
