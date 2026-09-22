/**
 * 한 번의 실행을 구분하는 짧은 꼬리표.
 *
 * 테스트 계정 이름은 testId로 만드는데, testId는 실행이 달라도 같은 값이다.
 * 로컬 검증과 GitHub Actions가 같은 데이터베이스 하나를 쓰기 때문에, 둘이
 * 겹치면 같은 테스트가 서로의 계정을 지운다. 실제로 CI에서 팔로우 테스트가
 * 그렇게 깨졌다. 실행마다 다른 꼬리표를 붙여 서로를 건드리지 않게 한다.
 */
export const RUN_TAG =
  process.env.GITHUB_RUN_ID?.slice(-5) ?? Math.random().toString(36).slice(2, 7);
