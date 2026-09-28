-- 지표(docs/metrics.md). 새 표 둘만 만들고, 기존 행은 바꾸거나 지우지 않는다.
CREATE TABLE "ActiveDay" (
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,

    CONSTRAINT "ActiveDay_pkey" PRIMARY KEY ("userId","date")
);

CREATE TABLE "DailyStat" (
    "date" DATE NOT NULL,
    "accounts" INTEGER NOT NULL,
    "users" INTEGER NOT NULL,
    "withTodo" INTEGER NOT NULL,
    "withFollow" INTEGER NOT NULL,
    "withReaction" INTEGER NOT NULL,
    "dau" INTEGER NOT NULL,
    "wau" INTEGER NOT NULL,
    "todosCreated" INTEGER NOT NULL,
    "follows" INTEGER NOT NULL,
    "reactionsCreated" INTEGER NOT NULL,
    "cohortSize" INTEGER NOT NULL,
    "cohortReturned" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyStat_pkey" PRIMARY KEY ("date")
);

CREATE INDEX "ActiveDay_date_idx" ON "ActiveDay"("date");

ALTER TABLE "ActiveDay" ADD CONSTRAINT "ActiveDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 이 기능 전의 이용한 날을 이미 있는 행동 기록(가입, 직접 적은 할 일, 완료, 일정·루틴 만들기, 반응, 팔로우)으로 채운다.
-- 화면만 보고 아무것도 하지 않은 날은 알 수 없어 빠진다. 그래서 그 기간은 실제보다 적게 센다.
-- 시각 열은 UTC로 저장돼 있어 한국 날짜로 바꿔 묶는다.
INSERT INTO "ActiveDay" ("userId", "date")
SELECT DISTINCT a."userId", a."date"
FROM (
    SELECT "id" AS "userId", (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date AS "date" FROM "User"
    UNION ALL
    SELECT "userId", (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date FROM "Todo" WHERE "routineId" IS NULL
    UNION ALL
    SELECT "userId", (("doneAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date FROM "Todo" WHERE "doneAt" IS NOT NULL
    UNION ALL
    SELECT "userId", (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date FROM "Event"
    UNION ALL
    SELECT "userId", (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date FROM "Routine"
    UNION ALL
    SELECT "userId", (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date FROM "Reaction"
    UNION ALL
    SELECT "followerId", (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date FROM "Follow"
) a
JOIN "User" u ON u."id" = a."userId" AND u."nickname" IS NOT NULL
WHERE a."date" >= (now() AT TIME ZONE 'Asia/Seoul')::date - 90
ON CONFLICT DO NOTHING;
