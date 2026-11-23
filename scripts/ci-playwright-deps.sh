#!/usr/bin/env bash
# E2E용 Chromium이 요구하는 시스템 패키지를 깐다(verify.yml의 e2e·warm 작업).
#
# 러너 이미지에는 글꼴 9개(한글 fonts-wqy-zenhei, 일본어 fonts-ipafont-gothic 등)만 빠져 있다(2026-11-23 실측).
# 예전에는 조각마다 `playwright install --with-deps`로 apt-get update와 내려받기를 해서 7~71초로 들쭉날쭉했고,
# 조각 8개 중 가장 느린 것이 검증 전체 시간을 정했다. 그래서 한 번 받은 .deb를 캐시해 두고 다음부터는 dpkg로 바로 깐다.
#
# 원칙: 글꼴이 빠진 채로 시험이 돌면 화면이 달라진다. 그래서
# - Playwright가 알려 주는 "빠진 패키지" 목록의 형식을 알아볼 때만 빠른 길을 탄다. 모르면 예전 길(playwright install-deps)로 간다.
# - 빠른 길로 깐 뒤에 다시 물어서 빠진 것이 남아 있으면 예전 길로 간다.
# - 예전 길로 깐 뒤에도 빠진 것이 남아 있으면 실패로 끝낸다.
#
# 캐시 폴더: PLAYWRIGHT_DEBS(기본 ~/.cache/playwright-debs). 받아 둔 .deb만 들어 있다.
set -euo pipefail

DIR="${PLAYWRIGHT_DEBS:-$HOME/.cache/playwright-debs}"
HEADER="Missing system dependencies"

# Playwright에게 빠진 패키지를 묻는다(설치하지 않는다). 출력 원문은 로그에 남긴다.
ask() {
  # 종료 코드 대신 출력으로 판단한다(형식을 모르면 예전 길로 가므로, 여기서 멈출 까닭이 없다).
  npx playwright install-deps --dry-run chromium 2>&1 || true
}

# "Missing system dependencies (9):" 다음 줄들의 패키지 이름만 뽑는다.
names() {
  sed -n "/^$HEADER/,\$p" <<<"$1" | tail -n +2 | sed -nE 's/^[[:space:]]+([a-z0-9][a-z0-9.+-]*)[[:space:]]*$/\1/p'
}

fallback() {
  echo "예전 길로 깐다: $1"
  npx playwright install-deps chromium
}

started=$SECONDS
out=$(ask)
if ! grep -q "^$HEADER" <<<"$out"; then
  # 빠진 것이 없다는 뜻일 수도 있지만, 형식이 바뀐 것과 구별할 수 없으니 확실한 쪽으로 간다.
  echo "$out"
  fallback "빠진 패키지 목록을 알아보지 못했다"
  exit 0
fi
missing=$(names "$out")
if [ -z "$missing" ]; then
  echo "$out"
  fallback "목록의 머리말만 있고 이름을 읽지 못했다"
  exit 0
fi
echo "빠진 패키지: $(echo $missing)"

# 빠른 길: 받아 둔 .deb를 dpkg로 바로 깐다(apt-get update·내려받기 없음).
if compgen -G "$DIR/*.deb" >/dev/null; then
  if sudo dpkg -i "$DIR"/*.deb >/tmp/dpkg.log 2>&1; then
    after=$(ask)
    if ! grep -q "^$HEADER" <<<"$after"; then
      echo "캐시한 .deb로 깔았다($((SECONDS - started))초)"
      exit 0
    fi
    echo "캐시한 .deb로 깐 뒤에도 빠진 것이 있다: $(echo $(names "$after"))"
  else
    echo "dpkg가 실패했다(원문):"
    cat /tmp/dpkg.log
    # 반쯤 깔린 패키지를 정리해야 예전 길의 apt-get install이 막히지 않는다.
    sudo apt-get update -qq
    sudo apt-get -f install -y
  fi
fi

fallback "캐시가 없거나 맞지 않는다"

# 다음 실행을 위해 방금 깐 것과 같은 판의 .deb를 받아 둔다(install-deps가 apt-get update를 이미 했다).
rm -rf "$DIR"
mkdir -p "$DIR"
(cd "$DIR" && apt-get download $missing)
echo "다음을 위해 .deb $(ls "$DIR" | wc -l)개를 받아 두었다"

final=$(ask)
if grep -q "^$HEADER" <<<"$final"; then
  echo "$final"
  echo "예전 길로 깐 뒤에도 빠진 패키지가 있다." >&2
  exit 1
fi
echo "시스템 패키지 준비 끝($((SECONDS - started))초)"
