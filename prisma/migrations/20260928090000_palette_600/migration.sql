-- 빨강·파랑·보라를 한 단계 진한 색으로 바꿨다. 흰 글씨가 작은 글자 대비 기준(4.5:1)을 넘게 한다.
-- 이미 고른 색도 새 팔레트로 옮긴다. 값만 바꾸고 지우는 데이터는 없다.
UPDATE "Category" SET "color" = '#dc2626' WHERE lower("color") = '#ef4444';
UPDATE "Category" SET "color" = '#2563eb' WHERE lower("color") = '#3b82f6';
UPDATE "Category" SET "color" = '#7c3aed' WHERE lower("color") = '#8b5cf6';
UPDATE "Todo" SET "color" = '#dc2626' WHERE lower("color") = '#ef4444';
UPDATE "Todo" SET "color" = '#2563eb' WHERE lower("color") = '#3b82f6';
UPDATE "Todo" SET "color" = '#7c3aed' WHERE lower("color") = '#8b5cf6';
UPDATE "Event" SET "color" = '#dc2626' WHERE lower("color") = '#ef4444';
UPDATE "Event" SET "color" = '#2563eb' WHERE lower("color") = '#3b82f6';
UPDATE "Event" SET "color" = '#7c3aed' WHERE lower("color") = '#8b5cf6';
