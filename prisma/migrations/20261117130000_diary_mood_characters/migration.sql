-- 일기의 "오늘의 기분"을 이모지에서 캐릭터 표정으로 바꾼다(2026-11-17 요청). 처음에 저장된 이모지 값을 도리의 표정 값("dori:표정")으로 옮긴다.
-- 값만 바꾸고 지우는 데이터는 없다. 새 값은 반응과 같은 "캐릭터id:표정" 모양이다.
UPDATE "DiaryEntry"
SET "mood" = CASE "mood"
  WHEN '😊' THEN 'dori:happy'
  WHEN '😄' THEN 'dori:like'
  WHEN '🥰' THEN 'dori:love'
  WHEN '😌' THEN 'dori:happy'
  WHEN '🤔' THEN 'dori:confused'
  WHEN '😐' THEN 'dori:hello'
  WHEN '😴' THEN 'dori:calm'
  WHEN '😢' THEN 'dori:sad'
  WHEN '😭' THEN 'dori:sad'
  WHEN '😡' THEN 'dori:fire'
  WHEN '🤒' THEN 'dori:sad'
  WHEN '🥳' THEN 'dori:party'
  ELSE "mood"
END
WHERE "mood" IN ('😊', '😄', '🥰', '😌', '🤔', '😐', '😴', '😢', '😭', '😡', '🤒', '🥳');
