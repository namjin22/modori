-- App Store 심사용 시연 데이터를 "오늘" 기준으로 다시 깐다(2026-10-20). seed-review-demo.sql로 계정·카테고리·팔로우를 만든 뒤에 쓴다.
-- 심사가 언제 열릴지 몰라서, 날짜를 고정해 두면 며칠 뒤 심사자가 볼 때 오늘 칸이 비어 있었다. 제출하기 직전과 심사가 길어질 때 다시 돌린다.
--
--   ssh gsmsv-modori 'cd /opt/modori && docker compose exec -T db psql -U modori -d modori' < deploy/refresh-review-demo.sql
--
-- 지우는 것은 시연용으로 만든 행(id가 'review-'로 시작)뿐이다. 심사용 계정에서 손으로 만든 할 일은 그대로 둔다.
-- 할 일: 사흘 전부터 열흘 뒤까지. 지난 날은 끝낸 일, 오늘은 하나만 끝냄, 앞날은 할 일로.
-- 일정: 친구의 시험(D-day, 공개)과 심사용 계정의 발표(시각 있음).

BEGIN;

DELETE FROM "Todo" WHERE "userId" IN ('review-user', 'review-friend') AND id LIKE 'review-%';
DELETE FROM "Event" WHERE "userId" IN ('review-user', 'review-friend') AND id LIKE 'review-%';

WITH today AS (SELECT (now() AT TIME ZONE 'Asia/Seoul')::date AS d),
days AS (SELECT o, (SELECT d FROM today) + o AS day FROM generate_series(-3, 10) AS o),
plan (who, slot, category, contents) AS (
  VALUES
    ('review-friend', 0, 'review-friend-cat-study',  ARRAY['영어 단어 30개 외우기', '수학 문제집 2쪽', '발표 자료 만들기', '과학 요약 정리']),
    ('review-friend', 1, 'review-friend-cat-fit',    ARRAY['30분 걷기', '스트레칭 10분', '줄넘기 100개']),
    ('review-friend', 2, 'review-friend-cat-secret', ARRAY['병원 예약 전화하기', '책상 정리']),
    ('review-user',   0, 'review-user-cat-study',    ARRAY['교재 한 단원 읽기', '과제 제출하기', '단어 시험 준비']),
    ('review-user',   1, 'review-user-cat-life',     ARRAY['방 정리하기', '장보기'])
)
INSERT INTO "Todo" (id, "userId", "categoryId", content, date, done, "doneAt", "order")
SELECT
  'review-' || p.who || '-' || to_char(days.day, 'YYYYMMDD') || '-' || p.slot,
  p.who,
  p.category,
  p.contents[1 + ((days.o + 3) % array_length(p.contents, 1))],
  days.day,
  -- 지난 날은 다 끝냈고, 오늘은 첫 칸만 끝냈다.
  days.o < 0 OR (days.o = 0 AND p.slot = 0),
  CASE
    WHEN days.o < 0 THEN (days.day + time '19:00' + p.slot * interval '40 minutes') AT TIME ZONE 'Asia/Seoul'
    WHEN days.o = 0 AND p.slot = 0 THEN now() - interval '30 minutes'
  END,
  p.slot
FROM days CROSS JOIN plan AS p;

-- 친구가 심사용 계정의 끝낸 일에 반응을 남긴다(받은 반응·알림 화면이 비지 않게).
INSERT INTO "Reaction" (id, "userId", "todoId", "todoUserId", emoji)
SELECT 'review-r-' || t.id, 'review-friend', t.id, 'review-user', CASE WHEN t."order" = 0 THEN '👏' ELSE '🔥' END
FROM "Todo" AS t
WHERE t."userId" = 'review-user' AND t.id LIKE 'review-%' AND t.done
ON CONFLICT DO NOTHING;

INSERT INTO "Event" (id, "userId", title, "startDate", "endDate", "startTime", "endTime", color, memo, "isPublic", "memoPublic")
SELECT 'review-e-friend-exam', 'review-friend', '중간고사', d + 6, d + 7, NULL, NULL, '#7c3aed', '범위: 1~4단원', true, true FROM (SELECT (now() AT TIME ZONE 'Asia/Seoul')::date AS d) AS today
UNION ALL
SELECT 'review-e-user-talk', 'review-user', '조별 발표', d + 2, d + 2, 14 * 60, 15 * 60, '#2563eb', '노트북 챙기기', true, false FROM (SELECT (now() AT TIME ZONE 'Asia/Seoul')::date AS d) AS today;

COMMIT;

-- 확인: 오늘 칸에 친구 할 일이 보이는지.
SELECT "userId", date, content, done FROM "Todo"
WHERE "userId" IN ('review-user', 'review-friend') AND date = (now() AT TIME ZONE 'Asia/Seoul')::date
ORDER BY "userId", "order";
