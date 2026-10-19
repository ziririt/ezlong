# AGENTS.md: 클라우드 코딩 에이전트용 안내 (Cursor · Grok 등)

> 이 파일은 Claude 가 아닌 에이전트(지금은 3번 주자 supergrok, Cursor 클라우드 에이전트로
> 실행)가 이 저장소에서 일할 때 지키는 규칙이다. 2026-10-19 신설.
> **본체는 `CLAUDE.md` 다.** 이 파일과 충돌하면 `CLAUDE.md` 가 이긴다.
> 이 파일은 그 본체를 대신하지 않는다. 클라우드 에이전트에게만 다른 점을 적는다.

---

## 0. 가장 중요한 한 줄: main 에 직접 push 하지 않는다

**이 저장소는 `main` 에 push 되는 순간 GitHub Actions 가 ezlong.com 에 자동 배포한다.**
리뷰도 미리보기도 없이 바로 라이브다. 그러므로:

- 작업은 **새 브랜치**에서 한다. 이름은 `agent/<YYYYMMDD>-<짧은-슬러그>`
  (Cursor 가 `cursor/...` 브랜치를 자동으로 만들면 그대로 써도 된다).
- 끝나면 **Pull Request 를 연다.** PR 을 **스스로 머지하지 않는다.**
  머지는 오너가 화면을 확인한 뒤 하거나, Claude 세션이 검토한 뒤 한다.
- 미완성이어도 브랜치에 커밋해 올리고 Draft PR 로 둔다. 작업물을 저장소 밖에 두지 않는다.
- `firebase deploy` 를 실행하지 않는다. 배포는 main 의 Actions 만 한다.

---

## 1. 시작할 때 읽는 순서

1. `CLAUDE.md` 전문. 0~18절이 상시 규칙이다. 특히 1절(가드레일) · 5절(가독성) · 7절(문체) · 8절(프라이버시).
2. `HANDOFF.md` 의 맨 앞 상자와 `2-3c` 절. 지금 무엇이 돌고 있고 최근에 무엇을 바꿨는지가 있다.
3. `docs/PENDING.md`. 오너 확인을 기다리는 항목이다. 이 항목들을 혼자 결정하지 않는다.
4. 만지는 코너가 있으면 `docs/RULES-REF.md` 에서 그 항을 찾아 읽는다(색인은 `CLAUDE.md` 19절).

`CLAUDE.md` 가 맥 전용으로 적어 둔 절차는 이 환경에 해당하지 않는다:
`backup-before-session.sh`, `_ops` 잠금(`lock.sh`), `OPS_RUNNER`, `osascript`, 패치를 맥에서
`git am` 하는 7-2절 경로. 클라우드 에이전트는 깨끗한 클론에서 브랜치와 PR 로만 일한다.
`_ops` 저장소가 보이더라도 **읽기만 하고 쓰지 않는다.**

---

## 2. git: 금지 목록 (협상 불가)

- `git add -A`, `git add .` 금지. 파일을 하나씩 명시한다.
- `git reset --hard` 금지.
- force push 금지. `rebase`, `commit --amend`, 히스토리 재작성 금지.
  브랜치가 뒤처지면 `git merge origin/main` 으로 따라간다.
- main 직접 push 금지(0절).
- 남이 올린 브랜치·커밋을 지우거나 덮지 않는다. 앞 주자가 일하는 중일 수 있다.
- **어떤 열쇠도 커밋하지 않는다.** `.env`, `serviceAccountKey*.json`, `*-firebase-adminsdk-*.json`,
  `*credentials*.json`, `.firebase/**`, `*.pem`, `*.p12`, `*.p8`, `*.jks`.
  API 키는 GitHub Secrets 에만 있다. 클라이언트 코드(HTML·JS)에 키를 넣지 않는다.
- 찾은 토큰·키 값을 로그나 PR 본문에 그대로 출력하지 않는다.

### 커밋 메시지 끝 줄

`CLAUDE.md` 1절의 규칙을 따르되, 세션 URL 이 없으므로 출처를 이렇게 적는다:

```
Claude-Session: supergrok
```

Cursor 가 자기 `Co-authored-by` 줄을 붙이면 그대로 둔다. 다른 회사 주소를 지어내 붙이지 않는다.
빈칸으로 두지 않는다.

---

## 3. 손대지 않는 곳

- `data/` 의 봇 생성 파일. 15분~하루 간격으로 봇이 main 에 직접 커밋한다.
  손으로 고치면 다음 봇 실행이 덮거나 충돌한다. 화면 문제는 생성 스크립트에서 고친다.
- `.github/workflows/` 는 오너나 Claude 세션의 명시적 요청이 있을 때만 고친다.
  예약·감시견(`scripts/watchdog.js`)·배포가 서로 얽혀 있다(`HANDOFF.md` 2-3c).
- `time/` (앱 세션 관할), `skybluenote/` (별개 프로젝트), `icons/` (앱 저장소 원본).
- `[보류 2026-10-19: 심플 주가]` 표시가 붙은 주석. 복구할 때만 `docs/RESTORE-stocks.md` 순서대로 푼다.
- 판단 알고리즘(`calcBuyScore` / `calcSellScore`, `calc_buy_score` / `calc_sell_score`, lev3x 임계값,
  물타기 로직)은 `CLAUDE.md` 4절의 2등급이다. 계획을 PR 본문에 먼저 쓰고, 코드는 승인 뒤에 쓴다.
- **부수 효과가 있는 스크립트를 실행하지 않는다.** `scripts/fetch-*`, `scripts/watchdog.js`,
  외부 API 를 부르거나 파일을 쓰는 생성기. 읽기 전용 검사(5절)만 돌린다.
  확인이 필요하면 `--dry` 옵션이 있는지 먼저 본다.

---

## 4. 화면에 나가는 것의 규칙 (요약. 원문은 CLAUDE.md 5·7·8절)

- **폰트:** HTML DOM 텍스트 14px 미만 금지, 본문 16px 이상. 소수점(12.5px)도 위반.
  웹폰트 금지. `var(--ez-hint)` 를 텍스트 색으로 쓰지 않는다. `font-weight:300` 금지.
- **문장 부호:** 긴 대시(U+2014)와 엔 대시(U+2013)를 어디에도 쓰지 않는다. 구분은 콜론 `:`, 목록은 `- `.
- **문체:** 분석글은 명사형 개조식(`~구간` `~확인` `~수준`). `~습니다` `~하세요` 금지.
  행동 촉구가 아니라 진단(`지금 매수하세요` 가 아니라 `1차 진입 가능 구간`). 한 문장에 주장 하나.
- **날짜:** 시장 문맥에 `오늘·어제·내일` 금지. `10월 16일(금, 뉴욕)` 처럼 절대 날짜와 시장을 적는다.
  주말을 '휴장'이라 부르지 않는다.
- **통계:** 승률·확률 문장은 기저율과 같이 쓴다(`기저율 62% 대비 63%`).
- **프라이버시:** 사이트에 나가는 어떤 문자열(HTML 주석 포함)에도 오너 개인을 지칭하지 않는다.
  예외는 `김성동` 저자 표기 하나. 주석의 출처는 사람이 아니라 증상으로 쓴다.
- **공용 파일:** 헤더·푸터는 `ez-nav.js` · `ez-footer.js` 만 고친다. 개별 HTML 을 고치지 않는다.
- **번역본:** `en/ ja/ zh/ es/ pt/` 는 손으로 만든 사본이다. 한국어를 고치면 다섯 벌도 같이 본다.
- **사이트맵:** ezlong.com 주제(미국 주식 도구·글)만 싣는다. 새 페이지는 `_template.html` 과
  `EZLONG_GUIDE.md` 를 먼저 읽고 만든다.

---

## 5. PR 을 열기 전에 돌릴 검사

```bash
python3 scripts/check-privacy.py      # 개인 지칭·자책 문구·캐시 버전 누락
python3 scripts/check-sitemap.py      # 사이트맵: noindex·없는 파일·얇은 페이지
python3 scripts/check-i18n.py         # 번역본 날짜 뒤처짐
python3 scripts/ez_text.py --selftest # 문장 부호 규칙
```

넷 다 표준 라이브러리만 쓴다. 하나라도 실패하면 PR 을 열지 않고 고친다.
계산 로직을 고쳤으면 `node scripts/ez-finance-selftest.js` · `node scripts/tax-selftest.js` 도 돌린다.

### PR 본문에 쓰는 것

- 무엇을 왜 바꿨는지(화면 기준으로: 어느 페이지의 어느 자리가 어떻게 달라지나).
- 건드린 파일 목록과, 같은 사실을 말하는 다른 자리를 몇 군데 확인했는지(`CLAUDE.md` 4절 끝).
- 위 검사 결과.
- 오너가 확인해야 할 것이 있으면 맨 끝에 번호 택일로(`CLAUDE.md` 2절 형식).

---

## 6. 인계

일이 끝나거나 멈추면 `HANDOFF.md` 2-3c 절에 한두 줄을 보태 같은 PR 에 넣는다.
오너 확인이 필요한 항목은 `docs/PENDING.md` 에 적는다(채팅이나 PR 댓글만으로 두지 않는다).
