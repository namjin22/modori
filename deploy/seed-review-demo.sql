-- App Store 심사용 시연 데이터 (2026-10-14). 심사자가 친구 기능(팔로우·반응·공개/비공개)을 볼 수 있게 한다.
-- 운영 DB에 한 번 넣는다. 고정 id와 ON CONFLICT라 다시 돌려도 중복되지 않는다.
--
--   ssh gsmsv-modori 'cd /opt/modori && docker compose exec -T db psql -U modori -d modori' < deploy/seed-review-demo.sql
--
-- 만드는 것
--   review-user  : 심사용 계정. 이메일로 Google 로그인하면 이 행에 이어진다(allowDangerousEmailAccountLinking).
--   review-friend: 시연용 친구 "모도리친구". 로그인할 수 없는 계정(이메일 없음). 추천 친구·추천 차단에서 뺀다.
-- 두 계정 모두 signupSource = 'demo'로 표시해 가입 지표에서 따로 센다(docs/metrics.md).
-- 지울 때: DELETE FROM "User" WHERE id IN ('review-user','review-friend'); (연결된 표는 CASCADE로 같이 지워진다)
--
-- 심사용 계정의 privacyAgreedAt은 비워 둔다(운영자 본인 계정이고, 동의 시각을 대신 찍지 않는다. 동의 기능 전 가입자도 비어 있다).

BEGIN;

INSERT INTO "User" (id, email, nickname, bio, "avatarCharacter", "signupSource", "hideFromRecommend", "recommendBlocked", timezone)
VALUES
  ('review-user',   'a01076476547@gmail.com', '앱심사',     '심사용 계정이에요',          'dori', 'demo', true, true, 'Asia/Seoul'),
  ('review-friend', NULL,                     '모도리친구', '같이 채워 가요. 시연용 계정', 'mong', 'demo', true, true, 'Asia/Seoul')
-- 심사용 이메일로 이미 로그인해 계정이 생겼다면(이메일 유일 제약) 여기서 건너뛴다. 그때는 아래 id를 그 계정 id로 바꿔 다시 돌린다.
ON CONFLICT DO NOTHING;

-- 카테고리: 친구는 공개 둘 + 비공개 하나, 심사용 계정은 기본 둘.
INSERT INTO "Category" (id, "userId", name, color, "order", "isPublic")
VALUES
  ('review-friend-cat-study',  'review-friend', '공부', '#2563eb', 0, true),
  ('review-friend-cat-fit',    'review-friend', '운동', '#22c55e', 1, true),
  ('review-friend-cat-secret', 'review-friend', '개인', '#7c3aed', 2, false),
  ('review-user-cat-study',    'review-user',   '공부', '#2563eb', 0, true),
  ('review-user-cat-life',     'review-user',   '생활', '#f97316', 1, true)
ON CONFLICT (id) DO NOTHING;

-- 할 일: 어제·오늘·내일·모레. 심사가 며칠 뒤에 열려도 달력에 채워진 날이 보이게 넉넉히 둔다.
INSERT INTO "Todo" (id, "userId", "categoryId", content, date, done, "doneAt", "order")
VALUES
  ('review-f-t1', 'review-friend', 'review-friend-cat-study',  '영어 단어 30개 외우기', DATE '2026-10-13', true,  TIMESTAMPTZ '2026-10-13 21:10+09', 0),
  ('review-f-t2', 'review-friend', 'review-friend-cat-fit',    '30분 걷기',            DATE '2026-10-13', true,  TIMESTAMPTZ '2026-10-13 19:00+09', 1),
  ('review-f-t3', 'review-friend', 'review-friend-cat-study',  '수학 문제집 2쪽',      DATE '2026-10-14', true,  TIMESTAMPTZ '2026-10-14 15:30+09', 0),
  ('review-f-t4', 'review-friend', 'review-friend-cat-fit',    '스트레칭 10분',        DATE '2026-10-14', false, NULL, 1),
  ('review-f-t5', 'review-friend', 'review-friend-cat-secret', '병원 예약 전화하기',   DATE '2026-10-14', false, NULL, 2),
  ('review-f-t6', 'review-friend', 'review-friend-cat-study',  '발표 자료 만들기',     DATE '2026-10-15', false, NULL, 0),
  ('review-f-t7', 'review-friend', 'review-friend-cat-fit',    '줄넘기 100개',         DATE '2026-10-16', false, NULL, 0),
  ('review-u-t1', 'review-user',   'review-user-cat-study',    '교재 한 단원 읽기',    DATE '2026-10-13', true,  TIMESTAMPTZ '2026-10-13 20:00+09', 0),
  ('review-u-t2', 'review-user',   'review-user-cat-life',     '방 정리하기',          DATE '2026-10-14', true,  TIMESTAMPTZ '2026-10-14 12:00+09', 0),
  ('review-u-t3', 'review-user',   'review-user-cat-study',    '과제 제출하기',        DATE '2026-10-14', false, NULL, 1),
  ('review-u-t4', 'review-user',   'review-user-cat-life',     '장보기',               DATE '2026-10-15', false, NULL, 0)
ON CONFLICT (id) DO NOTHING;

-- 서로 팔로우, 그리고 친구가 심사용 계정의 끝낸 일에 반응을 남긴다(받은 반응·알림 화면이 비지 않게).
INSERT INTO "Follow" ("followerId", "followingId")
VALUES ('review-user', 'review-friend'), ('review-friend', 'review-user')
ON CONFLICT DO NOTHING;

INSERT INTO "Reaction" (id, "userId", "todoId", "todoUserId", emoji)
VALUES
  ('review-r1', 'review-friend', 'review-u-t1', 'review-user', '👏'),
  ('review-r2', 'review-friend', 'review-u-t2', 'review-user', '🔥')
ON CONFLICT DO NOTHING;

COMMIT;
