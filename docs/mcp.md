# AI 연결(MCP)

외부 AI(Claude Code 같은 MCP 도구)가 사용자의 모도리에 할 일·일정을 **한 번에 여러 개** 만들고 읽는 서버 문이다.
모도리가 AI를 돌리는 것이 아니라, 사용자가 고른 AI가 사용자의 접근 토큰으로 들어온다(CLAUDE.md 규칙 7의 2026-11-15 결정,
`docs/decisions.md` "AI 연결(MCP)").

## 연결하기

1. 마이페이지 > 설정 > **AI 연결**에서 접근 토큰을 만든다(읽기만 / 읽기·쓰기, 유효 기간 30·90·365일). 값은 만들 때 한 번만 보인다.
2. AI 도구에 서버 주소와 토큰을 넣는다. Claude Code:

   ```bash
   claude mcp add --transport http modori https://modori.site/mcp --header "Authorization: Bearer mdr_…"
   ```

   다른 도구는 "Streamable HTTP" 서버에 `Authorization: Bearer <토큰>` 머리글을 넣을 수 있어야 한다.
3. AI에게 "다음 주 시험 일정이랑 준비할 일 만들어 줘"처럼 말한다.

**안 되는 것**: Claude 웹·앱의 "커넥터"처럼 로그인 창으로 연결하는 방식(OAuth 2.1)은 아직 없다.

## 도구

| 도구 | 토큰 | 하는 일 |
|---|---|---|
| `get_overview` | 읽기 | 오늘 날짜(사용자 시간대), 카테고리(id·이름·색·팔로워에게 보이는지), 상한 |
| `list_todos` | 읽기 | 기간(최대 62일, 300개)의 할 일. `includeMemo`를 켜야 메모가 나간다 |
| `list_events` | 읽기 | 기간에 걸친 일정 |
| `create_todos` | 쓰기 | 할 일 최대 20개. 카테고리는 id나 이름. 전부 되거나 하나도 안 된다. `batchId`를 돌려준다 |
| `complete_todos` | 쓰기 | id 최대 50개를 끝냄/안 끝냄으로. 이미 그 상태인 것은 건드리지 않는다 |
| `move_todos` | 쓰기 | id 최대 50개를 다른 날로. 루틴이 만든 할 일은 서버 액션처럼 그날 루틴이 다시 안 생기게 건너뛴 날로 남긴다 |
| `create_events` | 쓰기 | 일정 최대 10개. 기본 **비공개**(`isPublic`을 켜야 팔로워에게 보인다). 메모는 늘 비공개 |
| `undo_batch` | 쓰기 | `batchId`로 그 만들기 요청이 만든 것을 24시간 안에 지운다. 그새 끝낸 할 일은 남긴다 |

읽기 토큰으로 연결하면 쓰는 도구는 목록에 나오지 않고, 불러도 "없는 도구"다.
**일부러 없는 것**: 임의의 할 일·일정을 지우거나 고치는 도구, 카테고리·루틴·친구·반응·프로필을 건드리는 도구.

## 지키는 규칙

서버 액션(`app/(tabs)/actions.ts`, `app/(tabs)/events/actions.ts`)과 같다. **`lib/mcp/tools.ts`에 다시 적은 것이라, 규칙을 바꿀 때 두 곳을 같이 고친다.**

- 할 일 하루 50개, 일정 하루 5개(여러 날 일정은 날마다 센다)·전체 1000개, 날짜는 오늘에서 ±366일, 일정 길이 366일 이하
- 일정 시각: 끝 시각은 시작 시각이 있어야 하고, 같은 날이면 시작보다 빠를 수 없다
- 카테고리는 본인 것이고 보관하지 않은 것만. 모든 질의에 `userId`를 건다(남의 id는 "없음"으로 답한다)
- AI가 만든 메모는 팔로워에게 보이지 않는다(`memoPublic=false`)
- 친구에게 가는 "끝냈어요" 알림은 한 번에 5개까지(`after()`로 응답 뒤에)

## 인증과 한도

- `lib/mcp/auth.ts`: `Authorization: Bearer mdr_…`(`mdr_` + 43자)만 본다. 쿠키·세션은 보지 않는다. 모양이 틀리면 DB를 부르지 않고 401. 없는·지운·만료된 토큰은 모두 같은 401.
- 토큰 값은 저장하지 않고 SHA-256 해시(`ApiToken.tokenHash`)만 둔다. 마지막 사용 시각은 10분에 한 번만 적는다.
- 속도: 토큰마다 요청 60개 버스트 + 초당 1개. 바꾸는 도구는 별도로 10개 버스트 + 6초에 1개. 요청 본문은 64KB까지.
- `GET`·`DELETE /mcp`는 405(세션·SSE를 쓰지 않는다).
- 가입(닉네임)을 끝내지 않은 계정의 토큰은 403.

## 위험과 한계

- **프롬프트 주입**: AI가 다른 곳에서 읽은 글에 속아 쓰기 도구를 부를 수 있다. 개수·속도 상한, 되돌리기, 지우기 도구 없음, 읽기 전용 토큰(기본 선택)으로 줄였다. 없애지는 못한다.
- 토큰이 새면 그 사람의 할 일·일정이 읽힌다. 마이페이지에서 지우면 바로 막힌다.
- 실제 클라이언트(Claude Code 등)로의 연결은 배포 뒤 사람이 한 번 확인해야 한다.

## 코드

`app/mcp/route.ts`(전송, 요청마다 새 서버·전송), `lib/mcp/server.ts`(도구 등록), `lib/mcp/tools.ts`(일), `lib/mcp/inputs.ts`(입력 모양·상한),
`lib/mcp/auth.ts`(인증), `lib/api-token.ts`·`lib/api-token-secret.ts`(토큰), 화면 `app/(tabs)/settings/ai/`·`components/api-token-manager.tsx`.
시험: `tests/unit/api-token.test.ts`, `tests/unit/mcp-inputs.test.ts`, `tests/e2e/mcp.spec.ts`.

## 다음 단계(안 한 것)

OAuth 2.1(동적 클라이언트 등록·동의 화면)로 Claude 웹·앱 커넥터 지원. 쓰는 사람이 늘 때 결정한다.
