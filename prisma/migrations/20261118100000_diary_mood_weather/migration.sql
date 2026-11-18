-- 일기의 "오늘의 기분"을 캐릭터 표정에서 일기 전용 "마음 날씨" 그림 여섯 가지로 바꾼다(2026-11-18 요청). 값만 옮기고 지우는 데이터는 없다.
-- 이전 값은 반응과 같은 "캐릭터id:표정"(예: dori:happy)이었다. 캐릭터와 상관없이 표정 이름으로 가장 비슷한 날씨에 옮긴다.
-- sun 맑음(최고) / partly 구름 조금(좋음) / cloud 흐림(그저 그래요) / rain 비(우울) / storm 천둥(화남) / moon 밤(피곤)
UPDATE "DiaryEntry"
SET "mood" = CASE split_part("mood", ':', 2)
  WHEN 'happy' THEN 'sun'
  WHEN 'like' THEN 'sun'
  WHEN 'love' THEN 'sun'
  WHEN 'party' THEN 'sun'
  WHEN 'clap' THEN 'sun'
  WHEN 'pant' THEN 'sun'
  WHEN 'ball' THEN 'sun'
  WHEN 'wink' THEN 'sun'
  WHEN 'fish' THEN 'sun'
  WHEN 'goggles' THEN 'sun'
  WHEN 'cool' THEN 'partly'
  WHEN 'hello' THEN 'partly'
  WHEN 'bone' THEN 'partly'
  WHEN 'smug' THEN 'partly'
  WHEN 'snowman' THEN 'partly'
  WHEN 'foxfire' THEN 'partly'
  WHEN 'shy' THEN 'partly'
  WHEN 'confused' THEN 'cloud'
  WHEN 'beg' THEN 'cloud'
  WHEN 'wow' THEN 'cloud'
  WHEN 'sad' THEN 'rain'
  WHEN 'fire' THEN 'storm'
  WHEN 'calm' THEN 'moon'
  WHEN 'nap' THEN 'moon'
  ELSE 'cloud'
END
WHERE "mood" IS NOT NULL
  AND "mood" NOT IN ('sun', 'partly', 'cloud', 'rain', 'storm', 'moon');
