# EZLONG.COM — Claude 자동 로드 지침

> 이 파일은 매 세션 시작 시 자동으로 로드된다.
> 전체 개발 가이드는 **EZLONG_GUIDE.md** 를 반드시 먼저 읽을 것.

---

## 절대 규칙 — 사고방지 프로토콜 (2026-06-14 대형사고 교훈)

**배경:** 2026-06-14, HTML·이미지·알고리즘 전체 유실 → 14시간 재구축.
원인: 로컬 미커밋 파일이 `git pull --rebase`에 의해 5월 27일 버전으로 덮어씌워짐.

### 1. 세션 시작 전 백업 먼저 (필수)

파일 수정을 시작하기 **전에** 유저에게 아래 명령 실행을 요청한다:

```bash
sh ~/Developer/ezlong/backup-before-session.sh
```

백업 완료 메시지 확인 후에만 파일 수정 시작.

### 2. git 쓰기 명령의 실행 주체 (2026-07-30 개정 — 44-2 발효)

- **Claude sandbox bash에서의 git 쓰기 명령은 여전히 금지**(add/commit/push/pull/rebase/stash).
- 조회는 `git --no-optional-locks status` / `git --no-optional-locks diff` 로만 한다
  (샌드박스는 락을 만들고 못 지운다 — 이사 후에도 습관 유지). `git log`는 그냥 안전.
- **2026-07-30부터(저장소 ~/Developer 이사 완료, 성동님 확정): Claude가 osascript
  (do shell script) 경유로 pull→add(파일 명시)→commit→push를 직접 실행한다.**
  성동님 터미널 요청은 osascript가 불가능한 환경(클라우드 세션 등)에서만.
- **클라우드 세션 예외 (2026-07-30 이사 패키지, 성동님 확정):** 위 sandbox git 쓰기 금지의
  근거는 iCloud 로컬 클론의 index.lock 충돌(26항)이었다. Anthropic 클라우드 샌드박스는
  iCloud와 무관한 깨끗한 클론이므로 이 금지의 적용 대상이 아니며, **클라우드 세션에서는
  Claude가 샌드박스에서 직접 pull→add(파일 명시)→commit→push 한다.** 가드레일·상세는 28항.
- 가드레일(협상 불가): `git add -A` 금지 / `reset --hard` 금지 / force push 금지 /
  push 전 diff 확인 / 10개+ 파일·핵심 알고리즘 변경은 push 전 성동님 승인 /
  push 후 라이브 검증(web.app 우선, 7항 트리)까지가 배포의 완료 / push 결과 매번 채팅 보고 /
  배포마다 앱 저장소 RELEASES.md에 한 줄 기록 + deploy 태그(44-2 버전표·롤백 체계).

### 3. pull-first 철칙 + push = 자동 배포 (2026-07-03 개정)

배포 순서: `git pull` → `git add [파일 명시]` → `git commit` → `git push` — **push가 곧 배포다.**

- `firebase-hosting.yml`이 main push마다 자동 배포한다. 라이브 = git 추적 파일 (2026-07-03 라이브 대조로 실증).
- **수동 `firebase deploy`는 Actions 장애 시 비상용으로만.** 평소 사용 금지 — 로컬 미추적 잡파일(드래프트·.bak)이 함께 올라가고, 커밋 없는 수정은 다음 자동 배포가 조용히 되돌린다("고쳤는데 사라졌다" 미스터리의 원인).
- 참고: 봇(GITHUB_TOKEN) push는 firebase-hosting.yml을 트리거하지 않는다. 대신 scorecard 워크플로가 하루 5회 자체 deploy 스텝을 실행한다.

### 4. 이미지는 단독 커밋

새 이미지 추가 시 코드 수정과 분리해서 먼저 단독 커밋·push.
이미지가 push되지 않으면 Firebase에서 엑박 처리됨.

### 5. 대형 작업 전 git tag 필수

10개 이상 파일 동시 수정 또는 핵심 알고리즘 변경 전:
```bash
git tag -f "stable-$(date +%Y%m%d)" && git push origin --tags
```

### 6. 절대 하면 안 되는 것

- `git reset --hard origin/main` → 작업 파일 소실
- `git add -A` → 의도치 않은 파일 포함
- pull 없이 `firebase deploy` → 구버전이 운영 서버 덮어씀

### 7. 라이브 반영 확인 절차 — 2026-07-03 전면 개정 (구 "firebase deploy 누락" 항목 대체)

**배경:** 2026-06-14엔 수동 deploy 누락이 문제였으나, 2026-07-03 라이브 대조 결과 현재는
push 시 자동 배포가 지배적 경로임이 확정됐다(3항). 이 항목은 그에 맞춰 개정됐다.

**규칙:**
- 유저 git push 완료 후: "1~2분 뒤 라이브에서 확인" 안내. 수동 deploy 안내 금지.
- 라이브 반영 여부가 의심될 때 **가장 먼저** 확인할 것: `https://ezlong.com/ez-nav.js` 와 `https://ezlong-541a8.web.app/ez-nav.js` **둘 다** fetch해서 버전 비교.

**버전 불일치 진단 트리 (반드시 이 순서로 확인):**

| 상황 | 원인 | 해결 |
|------|------|------|
| ezlong-541a8.web.app = 구버전 | firebase-hosting.yml 실행 실패 또는 미트리거 | GitHub Actions에서 해당 워크플로 로그 확인 → 필요 시 Run workflow 수동 실행. 그래도 안 되면 비상용 수동 `firebase deploy --only hosting` |
| ezlong-541a8.web.app = 신버전, ezlong.com = 구버전 | Cloudflare 등 CDN 캐시 | Cloudflare 대시보드에서 캐시 Purge |
| 둘 다 신버전인데 브라우저만 구버전 | 브라우저 캐시 | 강력새로고침 (이때만 캐시삭제 권유) |

**"캐시 삭제하라" 권유는 위 트리에서 마지막 단계에서만. 절대 첫 번째 대응으로 하지 말 것.**

### 8. 공유 함수 동기화 규칙 — 핵심 함수가 여러 파일에 존재한다

`calcBuyScore` / `calcSellScore`는 **두 파일에 동시 존재**하며, 하나만 고치면 화면에 반영되지 않는다.

| 함수 | 파일 1 (서버 계산, 실제 운영 스크립트) | 파일 2 (클라이언트 재계산) |
|------|--------------------|---------------------------|
| `calc_buy_score` / `calcBuyScore` | `scripts/fetch-market-data.py` | `atmr-dashboard.html` (line ~2226) |
| `calc_sell_score` / `calcSellScore` | `scripts/fetch-market-data.py` | `atmr-dashboard.html` (line ~2382) |

**2026-07-09 정정:** 이전 버전은 파일 1을 `scripts/fetch-market-data.js`로 잘못 기재하고 있었다.
`fetch-market-data.yml` 워크플로가 실제로 실행하는 건 `.py`이며, `.js` 버전은 사용되지 않는
레거시 파일이다(`grep -rn "python.*fetch-market-data\|node.*fetch-market-data" .github/workflows/`로
확인 가능). `.js` 쪽을 고쳐봐야 라이브에 반영되지 않으니 동기화 대상에서 제외한다.

**규칙:**
- 두 함수 중 하나라도 수정 시 **반드시 두 파일 모두**(`.py` + `atmr-dashboard.html`) 동시에 수정한다.
- 수정 전 grep으로 전체 파일 확인:
```bash
grep -rn "def calc_buy_score\|def calc_sell_score\|function calcBuyScore\|function calcSellScore" . --include="*.html" --include="*.py" | grep -v ".backup/"
```
- `atmr-dashboard.html`은 JSON에서 데이터를 받아 클라이언트에서 **재계산하여 덮어쓴다**. 서버 JSON의 점수는 무시된다. 이것이 핵심 구조다.

### 9. .firebaseignore 관리 — 드래프트 파일 배포 차단

`.firebaseignore`에 반드시 포함되어야 할 패턴:
```
atmr-dashboard [0-9]*.html   # 숫자 붙은 드래프트 버전 전부 제외
_github-setup/               # 서버 스크립트 폴더 제외
```

알고리즘 변경 배포 전, 숫자 버전 파일이 `.firebaseignore`에 제외되어 있는지 반드시 확인한다.

### 10. 배포 키워드 자동 트리거 — 유저가 아무 말 안 해도 실행 (핵심)

유저 메시지에 다음 단어 중 하나라도 등장하면 배포 명령을 주기 **전에** 반드시 아래 체크리스트를 먼저 실행한다:

> **트리거 단어:** `배포`, `올려`, `올려줘`, `push`, `firebase`, `deploy`

Claude가 자발적으로 기억하는 것에 의존하지 않고, 유저의 자연스러운 언어가 트리거가 되는 구조다.

### 11. 배포 전 3분 체크리스트 (트리거 단어 감지 시 자동 실행)

```
[ ] 1. 백업 스크립트 실행 완료 확인 (미확인이면 유저에게 먼저 요청)
[ ] 2. 공유 함수 전체 grep — 동기화 누락 파일 없는지
[ ] 3. .firebaseignore — 드래프트 파일 제외 패턴 확인
[ ] 4. git status — 의도치 않은 파일 포함 여부 확인
[ ] 5. git pull 먼저 실행 (유저가 터미널에서)
[ ] 6. git add [파일 명시] — 절대 git add -A 금지
[ ] 7. git commit → git push → firebase deploy --only hosting
[ ] 8. https://ezlong-541a8.web.app/ 에서 직접 기능 확인
```

---

## 라이트모드 가독성 — 절대 금지 목록 (2026-06-14 명문화)

> 100회 이상 같은 지적을 받았다. 아래 항목은 코드 작성 후 즉시 셀프 체크한다.

**금지 1 — 폰트 크기**
HTML DOM 텍스트에 14px 미만 절대 금지. `font-size: 11px / 12px / 13px` 발견 즉시 14px로 올린다.
(예외: TradingView·Chart.js 등 라이브러리가 캔버스에 직접 렌더하는 텍스트만 허용)

**금지 2 — ez-hint 텍스트 사용**
`var(--ez-hint)` = 라이트모드에서 #B7B7B7 (대비비 1.6:1). DOM 텍스트 색으로 절대 금지.
대신 `var(--ez-text2)`(#3C3C3E, 대비비 7.5:1) 사용.

**금지 3 — 노랑/앰버 라이트모드 텍스트**
`#FFD60A`, `var(--ez-amber)(=#FF9F0A)` → 라이트모드 흰 배경에서 대비 불가.
반드시 `IS_DARK ? '#FFD60A' : '#B87900'` 형태로 분기.
risknote 텍스트는 `#92400E` 고정.

**금지 4 — alpha 배지 배경 + 동일 계열 텍스트**
`background:${color}20; color:${color}` 패턴 절대 금지.
배지는 `background:${color}; color:#fff` (solid 배경 + 흰 글자) 사용.

**금지 5 — 회색 배경 위 text3 / 얇은 폰트**
card2 등 회색 배경에 `--ez-text3` 텍스트 금지 → `--ez-text2` 사용.
`font-weight: 300` 금지. 최소 400(시스템 기본).

**렌더 검증 — UI 변경은 눈으로 확정한다 (2026-07-04 추가)**
UI를 수정하면 grep 셀프체크 후, 배포 전(또는 배포 직후) 해당 페이지를 브라우저로 실제 렌더해
라이트/다크 두 모드에서 레이아웃 밀림·대비·여백을 확인한다. 텍스트 검사로는
폰트 크기·색상값만 잡히고, 밀림·겹침·체감 대비는 렌더를 봐야만 잡힌다.

상세 규칙·코드 예시 → **EZLONG_GUIDE.md 섹션 6 "라이트모드 가독성 절대 규칙"** 참조.

---

## 글로벌 헤더·푸터 — 핵심 규칙

모든 서비스 페이지:
- `<body>` 직후: `<script src="/ez-nav.js"></script>`
- `</body>` 직전: `<script src="/ez-footer.js"></script>`
- `<head>` 안: `<link rel="stylesheet" href="ez-design.css">`

수정 시 개별 HTML 파일 건드리지 않는다. `ez-nav.js` 또는 `ez-footer.js` 하나만 수정.

---

## Gemini API 모델 설정 (2026-06-27 5차 개정)

### 파일별 모델 분리 — 비용 절감 (2026-06-27)

| 파일 | 모델 | 이유 |
|------|------|------|
| `scripts/generate-chart-analysis.js` | **`gemini-2.5-flash-lite`** | 차트 패턴 판독은 flash-lite로 충분. flash 대비 ~7배 저렴 |
| `scripts/fetch-market-scorecard.py` | **`gemini-2.5-flash`** | 전체 시황 복합 판단 → 고품질 필요 |

### 공통 설정
- **`thinkingBudget: 0`** — generationConfig 안에 `thinkingConfig: { thinkingBudget: 0 }` 포함 (2026-06-27 적용)
  - gemini-2.5-flash의 thinking 토큰($3.50/1M)을 차단 → 일반 출력($0.30/1M) 요금만 부과
  - 6월 25일 400 에러는 임시 버그였던 것으로 확인. 현재 정상 작동
- **폴백 모델: 없음** — v1beta에서 1.5 계열 전부 404. 재시도 4회(백오프) 적용
- **maxOutputTokens: 8192** — 반드시 유지 (4096에서 JSON 잘림 확인됨)
- `gemini-2.0-flash` 사용 금지 — Google 서비스 종료 (2026-06-26 확인)
- `gemini-1.5-flash`, `gemini-1.5-flash-latest` 사용 금지 — v1beta 404 (2026-06-26 확인)
- thinking 토큰 parts 루프 처리 코드는 유지 (thinkingBudget:0이 무시될 경우 방어)

### 비용 절감 구조 (2026-06-27 적용)
- chart-analysis: flash → flash-lite (7배 절감) + thinkingBudget:0
- scorecard: flash + thinkingBudget:0 (thinking 토큰 차단, ~90% 절감)
- crypto cron: 6회/일 → 3회/일 (50% 절감)
- **예상 일일 비용: 평일 ₩11,950 → ₩1,500 수준**

---

## 세션 마무리 자동 트리거 — CHANGELOG.md 작성

유저 메시지에 다음 단어 중 하나라도 등장하면 **CHANGELOG.md를 자동으로 업데이트**한다:

> **트리거 단어:** `마무리`, `정리해줘`, `작업 정리`, `changelog`, `오늘 정리`

### 실행 순서

1. sandbox bash에서 오늘 커밋 이력 조회:
```bash
git log --since="YYYY-MM-DD 00:00" --oneline --no-merges
```
2. chore(자동 데이터 커밋)·keep-alive 항목 제외하고 실제 작업 커밋만 분류
3. CHANGELOG.md에 새 날짜 섹션 추가 (기존 내용 위에 prepend 방식 아닌 파일 맨 위 `---` 다음에 삽입)
4. 알고리즘 변경이 있으면 반드시 복구 git 명령어 포함
5. 커밋 명령 제시:
```bash
git add CHANGELOG.md
git commit -m "docs: CHANGELOG 2026-MM-DD 작업 이력 추가"
git push
```

### CHANGELOG.md가 없으면

새로 생성한다. 포맷은 기존 CHANGELOG.md 참조.

### 여러 대화방에서 작업했더라도

git log는 모든 커밋을 포함하므로 어느 대화방에서 트리거해도 오늘 전체 작업이 통합된다.

---

## UI 텍스트 말투 원칙 — 분석/진단형 리포트 (2026-06-17 명문화)

> ezlong.com은 **분석/진단 결과 리포트**다. 행동 촉구 리포트가 아니다.

### 금지 표현 — "~하세요" 체 행동 촉구

다음 패턴은 코드 작성 즉시 셀프 체크 후 교체한다:

| 금지 표현 | 대체 표현 |
|-----------|-----------|
| `지금 1차 매수 시작하세요` | `1차 진입 가능 구간` |
| `즉시 전량 청산하세요` | `전량 청산 권고 — 하락 추세 확인` |
| `지금 교체하세요` | `전환 검토 구간` |
| `비중을 줄이세요` | `비중 축소 권고` |
| `포지션 유지하세요` | `포지션 유지 구간` |
| `지금 사지 마세요` | `신규 매수 자제 구간` |
| `현금 비중 높이세요` | `현금 비중 확대 권고` |
| `손절선 점검하세요` | `손절선 재점검 필요` |

### 허용 표현 패턴

- `~가능 구간` — 조건 충족 시 진입 가능함을 알림
- `~권고` — 추천이지 명령이 아님
- `~검토 가능` — 판단은 유저에게 있음
- `~자제` — 하지 말라는 것이 아니라 신중하라는 뜻
- `~대기 구간` — 관망이 적절한 상황 진단

### 예외 — 경고는 강도를 유지해도 됨

"아래 중 하나라도 발생하면 물타기 즉시 중단" 같은 **경고 트리거 문구**는 강도를 유지한다.
단, "즉시 파세요"처럼 행동 자체를 명령하는 형태는 금지.

### 자동 점검 트리거

UI 텍스트를 작성하거나 수정할 때마다 아래 grep 결과가 0이 나와야 한다:
```bash
grep -n "시작하세요\|지금 사지 마세요\|즉시 교체하세요\|즉시 청산하세요\|즉시 낮추세요\|투입하세요" atmr-dashboard.html
```

---

## 12. data/ 폴더 파일 관리 규칙 — 중복 폭발 방지 (2026-06-17 명문화)

**배경:** macOS Finder에서 파일을 복사하면 `(1)`, `(1) 2`, ` 2`, ` 3`... suffix 파일들이 자동 생성되어 수천 개 누적됨. 2026-06-17 정리 시 7,318개 → 230개.

### 절대 금지

- `data/` 폴더를 **Finder에서 직접 복사·붙여넣기** 금지
- `data/` 내 파일을 Finder 드래그로 복사 금지

### 파일 추가 시 반드시 터미널 사용

```bash
cp /경로/파일.json ~/Documents/Claude/Projects/미국주식투자자를\ 위한\ ezlong.com/data/
```

### 정기 점검 명령 (세션 시작 시 선택적 실행)

```bash
ls data/ | grep " " | wc -l   # 0이어야 정상. 0 초과 시 즉시 정리
```

### 중복 파일 발견 시 정리 명령 (Claude sandbox bash에서 실행 가능)

```bash
cd data/ && ls | grep " " | while IFS= read -r f; do rm -f "$f"; done
```

**주의:** 삭제 전 반드시 `.backup/` 폴더 무결성 확인 후 실행. `.backup/`은 절대 건드리지 않는다.

---

## 13. TradingView interval 충돌 금지 — 반복 사고 방지 (2026-06-17 명문화)

**배경:** `interval:'D'` + `range:'6M'` 동시 지정 시 TradingView가 `interval`을 무시하고 6개월에 최적화된 2h 봉을 자동 선택. PC·모바일 모두 2시간봉이 표시되어 차트 가독성 붕괴. 동일 문제 2회 이상 반복 발생.

### 절대 금지

```javascript
// 이 조합 절대 금지 — range가 interval을 덮어씀
{ interval: 'D',  range: '6M' }   // ❌ 금지 — interval:'D' + range
{ interval: 'D',  range: '12M' }  // ❌ 금지 (어떤 range 값이든 금지)
{ interval: '15', range: '1D' }   // ❌ 금지 — 2026-06-18 확인: 이 조합도 TradingView가 1분봉으로 강제 변경
```

### 올바른 방법

```javascript
// interval만 단독 사용 — range 파라미터 아예 제거
{ interval: 'D'  }   // ✅ 일봉 고정
{ interval: '15' }   // ✅ 15분봉 고정 (1D 뷰에서 range 없이 단독 사용)
```

### 추가 방어 — localStorage 클리어 필수

`loadTVChart` 함수 호출 시 반드시 TradingView localStorage 키 클리어:

```javascript
try {
  const toDelete = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.startsWith('tv.') || k.startsWith('chartWidget') || k.includes('tradingview'))) {
      toDelete.push(k);
    }
  }
  toDelete.forEach(k => localStorage.removeItem(k));
} catch(e) {}
```

**우리 앱 localStorage 키 (삭제 대상 아님):**
- `atmr_cache_v7` — 데이터 캐시
- `ezlong_alpha_history_v2` — 알파 히스토리

### 배포 전 자동 점검

```bash
grep -n "interval.*range\|range.*interval" atmr-dashboard.html | grep -v "//\|#"
# 결과 0이어야 정상. interval과 range가 같은 줄에 있으면 충돌 위험.
```

---

## 14. 폰트 14px 미만 절대 금지 — 재발 방지 (2026-06-17 강화)

**배경:** "14px 미만 금지" 규칙이 CSS 클래스에는 적용됐으나 JS 생성 HTML 인라인 스타일에서 반복적으로 위반. 동일 지적 수십 회 반복. 2026-06-17 전체 일괄 수정.

### 자동 점검 grep (코드 작성 후 즉시 실행)

```bash
# 인라인 style 속성 내 위반 검사
grep -n "font-size:1[013]px\|font-size: 1[013]px" atmr-dashboard.html | grep -v "ez-nav\|ez-footer"
# 결과 0이어야 정상
```

### 특히 위반 잦은 패턴 — 이 패턴 발견 즉시 수정

| 금지 패턴 | 교체 방법 |
|-----------|-----------|
| `font-size:13px` (인라인) | 제거 → CSS 클래스 사용 |
| `font-size:11px` (인라인) | 제거 → CSS 클래스 사용 |
| JS 템플릿: `\`...<span style="font-size:13px;...">\`` | `font-size` 제거, `color`만 인라인 허용 |
| `font-family: 'SF Mono', monospace` | 완전 제거 → 시스템 기본 폰트 상속 |

### JS 생성 HTML의 가격/변동률 표시 올바른 패턴

```javascript
// ❌ 금지 — 인라인 font-size가 CSS 클래스를 오버라이드
el.innerHTML = `<span style="font-weight:800;font-size:17px;">$${price}</span>
               <br><span style="font-size:13px;color:${clr};">${pct}%</span>`;

// ✅ 올바름 — CSS 클래스가 폰트 제어, 인라인은 color만
el.textContent = `$${price}`;
const chgEl = el.nextElementSibling;
if (chgEl) {
  chgEl.textContent = pct + '%';
  chgEl.className = chgEl.className.replace(/\s*(up|dn)\b/g, '') + (isUp ? ' up' : ' dn');
}
```

---

## 15. --ez-mono 폰트 가격·수치 표시 사용 금지 (2026-06-17 명문화)

**배경:** `chart-analysis.html`의 티커 가격·등락률·매수점수·타겟가 등 7개 CSS 클래스에 `font-family: var(--ez-mono)`가 박혀있었다. `--ez-mono = 'SF Mono', 'Fira Code', Consolas, 'Courier New', monospace` — 얇고 가독성 없는 코드 전용 폰트. `atmr-dashboard.html`만 수정하고 `chart-analysis.html`은 누락해 2시간 이상 소요.

### 절대 금지

```css
/* 아래 패턴 UI 가격/수치 표시에 절대 금지 */
font-family: var(--ez-mono);   /* ❌ — 'SF Mono', 'Fira Code', Consolas, 'Courier New', monospace */
font-family: 'SF Mono', monospace;   /* ❌ */
font-variant-numeric: tabular-nums;  /* ❌ — 모노스페이스 효과 유발 */
```

### --ez-mono 용도

`--ez-mono`는 **코드 스니펫 표시 전용**이다. 가격, 등락률, 점수, 날짜 등 일반 수치에 쓰지 않는다.

### 올바른 방법

```css
/* font-family 지정 없음 → html { font-family: var(--font) } 상속 */
.ca-ticker-price { font-size: 14px; font-weight: 600; color: var(--ez-text); }
```

### 파일별 배포 전 자동 점검

```bash
# 모든 HTML 파일에서 --ez-mono 가격 표시 오용 검사
grep -rn "font-family.*ez-mono\|font-family.*SF Mono\|font-variant-numeric" *.html | grep -v "//\|/\*"
# 결과 0이어야 정상
```

### 수정 필요 시 여러 파일 동시 확인

`--ez-mono` 관련 수정 시 아래 파일 모두 grep:
- `atmr-dashboard.html`
- `chart-analysis.html`
- 새로 추가된 HTML 파일

---

## 16. GitHub Actions git 커밋 패턴 — 확정 (2026-06-18 2차 개정)

**배경 1:** `git pull --rebase` → `cannot pull with rebase: You have unstaged changes` 에러 반복.  
**배경 2 (더 심각):** `git reset --hard origin/main`으로 교체했더니 **tracked 파일**인 `data/stocks-data.json`을 덮어써서 Python이 방금 생성한 신규 JSON이 사라짐. 이후 `git diff --staged`가 항상 "변경 없음"을 출력해 커밋이 단 한 번도 일어나지 않았다. 스파크라인 5포인트 고착 원인. 수 시간 디버깅 낭비. **절대 재발 금지.**

### 절대 금지

```yaml
- run: git pull --rebase origin main        # ❌ unstaged 파일 있으면 실패
- run: git pull origin main                 # ❌ merge commit 생성 위험
- run: git reset --hard origin/main         # ❌ tracked 파일을 덮어써 신규 JSON 소멸
```

### 확정 패턴 (GitHub Actions 전용) — 2026-06-18 검증 완료

```yaml
- name: Commit & push
  run: |
    git config user.name  "github-actions[bot]"
    git config user.email "github-actions[bot]@users.noreply.github.com"
    git add data/파일명.json           # 파일 명시 — git add -A 절대 금지
    if git diff --staged --quiet; then
      echo "변경 없음 — 커밋 생략"
    else
      KST=$(TZ='Asia/Seoul' date '+%Y-%m-%d %H:%M KST')
      git commit -m "data: 파일명 ${KST}"
      git push origin main || (git fetch origin main && git merge --ff-only origin/main && git push origin main)
    fi
```

### 핵심 원리

- `actions/checkout@v4`가 이미 올바른 origin/main 상태로 체크아웃해준다. 추가 fetch/reset 불필요.
- Python 스크립트가 `data/파일명.json`을 덮어쓰면 working tree가 HEAD와 달라진다.
- `git add` → `git diff --staged` → 다르면 커밋 → push. 이게 전부다.
- 동시 push 충돌 시: `git push` 실패 → `ff-only merge` 재시도. diverge면 step 실패, 다음 cycle에서 재시도. 데이터 손실 없음.

### `git reset --hard`를 쓰면 안 되는 이유 (재확인용)

`data/stocks-data.json`은 **tracked 파일**이다. `git reset --hard origin/main`은 tracked 파일을 origin/main 버전으로 강제 복원한다. Python이 새로 쓴 내용이 모두 사라진다. 이 함정은 untracked 파일에만 쓸 때는 안전하지만, tracked 데이터 파일에는 절대 쓰면 안 된다.

---

## 17. Massive API 보안 규칙 및 이중 JSON 아키텍처 (2026-06-18 명문화)

**배경:** stocks.html에 실시간 주가를 표시하기 위해 Massive API (구 Polygon.io) 도입. API 키를 클라이언트 코드에 절대 노출하지 않는 구조로 확정.

### API 키 보안 — 절대 규칙

```
MASSIVE_API_KEY → GitHub Secret에만 저장
클라이언트 HTML/JS → 절대 포함 금지
```

노출 여부 점검:
```bash
grep -rn "MASSIVE_API_KEY\|massive\.com.*apiKey" *.html *.js | grep -v ".py\|.yml"
# 결과 0이어야 정상
```

### 이중 JSON 아키텍처

| 파일 | 갱신 주기 | 내용 | 실행 주체 |
|------|-----------|------|-----------|
| `data/stocks-data.json` | 1일 1회 (장 마감 후) | 스파크라인 + 종목명 + 섹터 | yfinance GitHub Actions |
| `data/stocks-prices.json` | 10분마다 (장중) | 현재가 + 등락률 + 확장시간 | Massive API GitHub Actions |

- `stocks.html`은 두 JSON을 `Promise.all`로 병렬 fetch
- `pricesData`(Massive) 있으면 price/changePct 덮어씀, 없으면 `stocks-data.json` 값 그대로 사용
- 확장시간: `extPrice`, `extPct`, `extSession` (`'pre'` | `'post'` | null)

### 프리마켓 데이터 소스 확정 (2026-06-18 검증)

**핵심:** Massive API 스냅샷의 `preMarket` 객체는 **항상 None**이다. 스냅샷으로 프리마켓 데이터를 기대하지 말 것.

프리마켓 데이터는 **aggregates 5분봉 엔드포인트**에서만 제공된다:
```
GET /v2/aggs/ticker/{sym}/range/5/minute/{today}/{today}?adjusted=false&sort=asc
```

프리마켓 구조 (`fetch-stocks-prices.py`):
- `is_premarket` = ET 4AM~9:30AM
- 오늘 날짜 5분봉 별도 수집 → 마지막 봉 = 프리마켓 현재가 (15분 지연)
- 기준가 = `prevDay.c` (전일 종가)
- 프리마켓 시간대엔 Yahoo Finance 호출 완전 차단 (`is_premarket` 조건)
- 약 130~140개 종목에서 프리마켓 봉 수집 가능 (나머지는 거래 없음)

### 요금제

- **현재: $29/월 Stocks Starter** — 15분 지연 데이터
- 실시간($199/월)은 추후 업그레이드 예정
- UI 표기: `"15분마다 업데이트"` — "(15분 지연)" 표현 금지

---

## 18. 작업 방식 — 위험 등급제 + 검증 분리 + 재시도 상한선 (2026-06-25 명문화)

**배경:** 오케스트레이터·서브에이전트·하네스·루프 개념을 ezlong에 적용. 핵심은 "도입"이 아니라 **위험에 맞춰 켜고 끄는 규율**이다. 잘 돌던 작은 작업엔 의식(ceremony)을 붙이지 않는다. 우리가 실제로 다쳤던 고위험 작업에만 안전망을 두른다.

### 위험 등급으로 의식 수준을 결정한다

작업이 들어오면 먼저 등급부터 매긴다.

- **0등급 (외과수술):** CSS·문구·단일 파일 한두 줄. 하네스 안 켠다. 고치고 → 해당 규칙 grep 셀프체크 → 보고. (지금까지 방식 그대로. 여기에 의식 붙이면 퇴보.)
- **1등급 (기능·다중 파일):** 새 도구 페이지, 2~5개 파일 연동. Task 리스트로 진행 추적 + 끝에 검증 1회. 서브에이전트는 선택.
- **2등급 (고위험):** 알고리즘 변경(`calcBuyScore`/`calcSellScore`, lev3x 임계값, 물타기 로직), 10개+ 파일 동시 수정, API 키·보안. 아래 풀하네스 적용.

### 2등급 필수 규율

- **검증은 작성자가 아닌 제3자에게.** 코드 수정 완료 후, 변경을 보지 못한 **깨끗한 서브에이전트(Agent 도구)**를 띄워 diff를 감사시킨다. 감사 기준: 8항 이중 동기화, 15·14항 grep 규칙, 라이트모드 절대 금지 목록. 통과 전에는 유저에게 배포를 안내하지 않는다. (자기 검증 편향 차단)
- **검증자에게 의도를 주지 않는다 (2026-07-04 추가).** 감사 프롬프트에는 diff·대상 파일·수용 기준(무엇이 참이어야 하는지)만 제공하고, "왜 이렇게 짰는지"의 설계 의도·근거 서술은 포함하지 않는다. 작성자의 논리를 알고 검토하면 관대해진다.
- **숫자 계산 기능은 독립 재현으로 대조한다 (2026-07-04 추가).** 계산기·시뮬레이터류 신설/수정 시, 검증자는 구현 코드를 참고하지 않고 동일 계산을 처음부터 재현해 결과값을 대조한다. (판단 원장 검증에 쓴 '코드 블록 추출 독립 실행' 방식이 표준 예시)
- **10개+ 파일은 계획 먼저.** git tag(5항) 직후 Plan 서브에이전트로 의존 순서·사이드이펙트를 뽑아 유저 승인 → 그 다음 수정.

### 재시도 상한선 (전 등급 공통)

- 같은 파일·같은 증상을 **3회** 고쳤는데도 안 되면 더 시도하지 않는다. 멈추고 시도 내역·실패 이유·다음 가설을 정리해 유저에게 보고하고 판단을 기다린다.
- 특히 "캐시 삭제" 같은 진단을 반복하기 전에 이 규칙을 먼저 적용한다. (2026-06-14 캐시 오진 사건 재발 방지)

### STATE.md는 만들지 않는다

루프 상태(진행 중·완료·에스컬레이션)는 **휘발성 Task 리스트**로 추적한다. 영구 기록은 CHANGELOG.md 하나로 단일화. 별도 STATE.md를 만들면 진실의 출처가 둘로 갈라져 사고 원인이 된다.

### 프레임 정합성 메모 — Builder·Judge·Manager / Graph vs Loop (2026-07-28 추가)

**배경:** 외부에서 소개된 에이전트 설계 프레임(Builder-Judge-Manager 3역할 분리, 그래프형 워크플로 vs 자유 루프, 관계형 지식그래프)을 검토했다. 결론: **이 프로젝트는 2026-06-25에 이미 같은 결론에 사고로 도달해 있었다.** 아래는 기존 규칙을 프레임 용어로 재확인하고, 실제로 비어 있던 부분만 채운 것이다 — 잘 작동하는 기존 규칙을 갈아엎지 않는다.

| 프레임 개념 | 이 프로젝트의 기존 대응 | 상태 |
|---|---|---|
| Builder(만드는 역할) | Claude의 코드 작성 단계 | 기존 |
| Judge(검사하는 역할) | 2등급 "제3자 서브에이전트 감사" — 의도 비공개, 독립 재계산 대조 | 기존 |
| Judge의 외부 기준(Ground Truth) | grep 규칙(8·14·15항)·독립 재현 계산·라이트모드 금지 목록 | 기존 |
| Manager(다음 행동 결정자) | 유저 승인 없이는 배포 안내 안 함 — 사람이 최종 결정권자 | 기존 |
| Stop Condition(멈추는 조건) | "같은 파일 3회 실패 시 중단·보고" | 기존 |
| 불변 계획 / 역할 분리(계획-실행-검증) | 10개+ 파일 작업 시 "Plan 서브에이전트 → 유저 승인 → 그다음 수정" | 기존, 아래에서 보강 |

**보강 1 — 계획·실행·검증 3계층을 한 세션에서 섞지 않는다.**
2등급 작업에서 계획 수립과 실행과 검증은 서로 다른 역할처럼 다룬다.
- 계획 단계에서 확정한 파일 목록·순서를, 실행 중간에 유저 재확인 없이 바꾸지 않는다. 바뀌면 계획 단계로 되돌아가 다시 승인받는다.
- 검증(Judge) 단계는 실행이 전부 끝난 뒤에만 시작한다. "짜면서 동시에 자체 검증"은 2등급에서 인정하지 않는다 — 자기 논리를 옹호하게 되는 자기검증 편향 때문이며, 2026-07-04 조항("검증자에게 의도를 주지 않는다")과 같은 근거다.

**보강 2 — Stop Condition에 "재시도 횟수" 외에 "스코프 상한"도 포함한다.**
기존 3회 재시도 상한선은 유지하되, 아래도 동일한 무게로 취급한다.
- 한 세션에서 배포 준비 없이 계속 파일만 늘어나 원래 요청 범위를 크게 벗어나면, 끝까지 다 하고 한 번에 보고하지 않고 일단 멈춰서 중간 결과를 먼저 보고한다.
- 세금·법령·수치처럼 틀리면 유저에게 실질적 금전 피해가 갈 수 있는 콘텐츠는, 현재 기준을 웹 검색으로 재확인하지 못했다면 추정치임을 명시하고 확정형으로 서술하지 않는다.

**검토했지만 도입하지 않은 것 — Knowledge Graph / Graph RAG 전면 도입.** ezlong.com의 데이터는 대부분 정형 JSON(시세·지표·판단이력)이며, 비정형 문서 뭉치에서 답을 찾아야 하는 RAG 문제 자체가 없다. 그래프 DB·임베딩 인프라를 새로 놓는 건 이 프로젝트 규모에 맞지 않는 과잉 엔지니어링으로 판단해 보류. 다만 **판단 원장(20항)에 한정해** 관계형 구조를 부분 도입하는 안은 별도로 검토 중 — 상세는 유저와 협의 후 착수.

---

## 19. 실시간 주가 파이프라인 이중 장애 — 재발방지 (2026-07-02 명문화)

**배경:** 심플 주가(stocks.html)에서 NVDA·AAPL·MSFT·GOOGL·TSM·SOXX 등 시총 상위 종목의 가격·등락률·스파크라인이 실제 시세와 전혀 다르게 표시됨. 유저가 아이패드 네이티브 주식 위젯과 비교해 발견. 원인은 두 파이프라인이 동시에 조용히 망가진 것.

### 원인 1 — Massive API 배치 요청 크기 상한

`scripts/fetch-stocks-prices.py`가 `BATCH=200`으로 스냅샷을 한 번에 요청하면, Massive(구 Polygon.io) API가 **에러 없이** 일부 심볼을 응답에서 빠뜨린다. 약 230개 요청 중 60개만 살아남는 식으로, 하필 NVDA·AAPL·MSFT·GOOGL·TSM 같은 대형주가 매번 누락 대상에 걸렸다.

**규칙:**
- `BATCH`는 **60을 넘기지 않는다.** 심볼 리스트가 늘어나도 배치 크기는 고정, 배치 개수만 늘릴 것.
- 1차 요청 후 누락된 심볼은 20개씩 최대 2회 재시도한다(이미 코드에 반영됨).
- 재시도 후에도 남는 심볼은 `stocks-prices.json`의 `missingSymbols` 필드와 GitHub Actions `::warning::` 로그로 노출한다. **"숫자가 실제랑 안 맞다"는 제보가 오면 가장 먼저 이 필드부터 확인할 것** — 로그를 뒤질 필요 없이 바로 원인 파악 가능.
- BRK-B·ANSS·MMC는 배치 크기와 무관하게 Massive 쪽에 원래부터 데이터가 없는 개별 종목이다(재시도해도 항상 실패). 이 3개가 `missingSymbols`에 뜨는 건 정상이며 조치 불필요.

### 원인 2 — yfinance fast_info 조용한 실패

`scripts/fetch-stocks-data.py`(일 1회 갱신)의 `fetch_ticker()`가 `t.fast_info.last_price`/`previous_close`에 의존했는데, 이 값이 예외를 던지지 않고 조용히 비어버리면서 **2026-06-17부터 약 2주간 실질적으로 갱신되지 않았다.** `git log`상으로는 매일 커밋이 있었지만(파일이 한 줄짜리 JSON이라 diff가 항상 "1 line changed"로만 보임), 실제 콘텐츠(`generatedAt`)는 그대로였다.

**규칙:**
- 가격 소스는 `fast_info`가 아니라 **`t.history(period='5d', interval='1d', auto_adjust=False)`를 우선 사용**한다(야후 파이낸스 웹사이트 표시값과 일치). `fast_info`는 히스토리 실패 시 폴백으로만 쓴다.
- 일 1회 갱신 파일(`stocks-data.json`)의 `generatedAt`이 실제로 오늘 날짜인지 **커밋 메시지가 아니라 파일 내용으로** 확인하는 습관을 들일 것. 한 줄짜리 JSON은 커밋 diff 통계(`N line changed`)가 내용 변화량을 말해주지 않는다.

### 두 원인이 겹치는 구조

`stocks.html`은 `stocks-prices.json`(10분 갱신)에 종목이 없으면 `stocks-data.json`(일 1회)으로 폴백한다. 위 두 파일이 **동시에** 문제였던 종목만 골라 2주 전 가격이 노출됐다. 하나만 고쳐서는 재발한다 — 두 파일 모두 점검해야 완전히 해결된다.

### 점검 명령

```bash
# 실시간 파일에 실제로 뭐가 빠졌는지 (missingSymbols 필드)
python3 -c "import json; d=json.load(open('data/stocks-prices.json')); print(d.get('missingSymbols'))"

# 일 1회 파일이 진짜 오늘 갱신됐는지 (커밋 메시지 말고 내용으로)
python3 -c "import json; d=json.load(open('data/stocks-data.json')); print(d.get('generatedAtKST'))"
```

---

## 20. AI 판단 3영업일 연속성 — 판단 원장(judgment ledger) 절대 보호 (2026-07-03 구축)

**배경:** 유저가 수차례 요구 — 스윙시그널·차트분석·TSLA/NVDA·긍정vs부정 모두 최근 3영업일
판단 흐름을 참조해야 한다. 매번 당일 스냅샷만 보고 "기억상실" 판단을 내리는 구조를 이날 수술했다.

**구조 (제거·우회 절대 금지):**

| 파이프라인 | 원장 파일 | 읽기/쓰기 위치 |
|-----------|----------|---------------|
| AI 차트분석 (us/kr/crypto) | `data/judgment-history-{us,kr,crypto}.json` | `generate-chart-analysis.js` — 프롬프트 historySection 주입 + 생성 후 append |
| 긍정vs부정 | `data/judgment-history-scorecard.json` | `fetch-market-scorecard.py` — history_block 주입 + append_ledger |
| 스윙 시그널 | `market-signals.json`의 previousSignals 재활용 | `atmr-dashboard.html` buildTrendLineHtml() — 3영업일 매수신호 흐름 라인 |
| 오늘의 차트 (SOXX/QQQ/SOXL/TQQQ/TSLA/NVDA, 2026-07-04 신설) | `data/judgment-history-today-chart.json` (종목별 dict) | `scripts/fetch-today-chart.py` — ledger_context_block() 주입 + append_ledger() |

**원리:**
- 원장 파일은 그룹별 분리 — 워크플로 동시 실행 시 커밋 충돌 방지.
- "최근 4개의 서로 다른 날짜"(직전 3영업일 + 오늘) 방식 — 파이프라인이 거래일에만 돌므로 휴일 테이블 불필요.
- 원장이 없거나 깨져도 단발 생성으로 폴백. 원장 코드가 본 기능을 죽이는 일은 없다.
- 심볼당 15개(차트) / 20개(스코어카드) prune — 파일 크기 영구 상한.
- 차트분석 JSON에 `continuity` 필드 추가됨 (3일 흐름 서술).

**규칙:**
- 이 파이프라인들을 수정할 때 원장 주입·기록 코드를 제거하거나 건너뛰지 않는다.
- 새 AI 판단 기능을 만들 때도 원장 연동을 기본 포함한다.
- 워크플로 yml에서 `git add data/`가 아닌 파일 명시 방식이면 원장 파일을 add 목록에 반드시 포함한다 (market-scorecard.yml에 반영됨).

**2026-07-28 추가 — 스코어카드 혼조 재료 판별에 category 태그 도입 (difflib 유사도 대체):**
`scripts/fetch-market-scorecard.py`의 혼조 재료(mixed_factors) "같은 주제인지" 판별이
기존엔 `_mixed_factor_similar()`(difflib 문자열 유사도, threshold 0.55)에만 의존했다.
이게 `feedback_scorecard_mixed_factor_staleness.md`에 기록된 반복 사고의 근본 원인 —
리워딩이 조금만 달라도 다른 주제로 오인하거나(재활용 탐지 실패), 우연히 어휘가 겹치면
다른 주제를 같은 주제로 오인했다(오탐).

해결: positive_factors·negative_factors·mixed_factors 각 항목에 `category` 필드를
추가했다. Gemini가 자유 서술하는 `name`과 달리, `category`는 `FACTOR_CATEGORIES`
고정 목록(fed_policy/geopolitics/trade_tariff/macro_data/earnings_bellwether/
vix_risk_sentiment/oil_energy/dollar_fx/rates_treasury/ai_tech_valuation/
supply_chain/company_specific/other) 중 하나만 골라야 하는 폐쇄형 값이라, 표현이
바뀌어도 흔들리지 않는 정확 일치 판별이 가능하다. `_mixed_factor_same_topic()`이
새 1차 기준(category 정확 일치)이고, 정보가 없는 구버전 데이터(2026-07-28 이전 원장·
data.json 항목)는 자동으로 기존 difflib 함수(`_mixed_factor_similar`)로 폴백한다 —
점진 전환, 하위 호환 유지.

판단 원장(`judgment-history-scorecard.json`)에도 `mixed_tags`(name+category 구조화
목록) 필드가 추가됐다. 기존 `k` 압축 텍스트 라인은 그대로 유지(프롬프트 주입용).

**규칙:**
- `category`는 반드시 `FACTOR_CATEGORIES` 고정 목록 값만 허용한다. 새 카테고리가
  필요해 보여도 목록에 추가하려면 먼저 신중히 검토할 것 — 목록이 너무 세분화되면
  같은 주제가 여러 category로 흩어져 정확 일치 판별 자체가 무력화된다.
- `clean_category()` 방어 로직(목록 밖 값 → 'other' 강등)을 제거하지 않는다 — Gemini가
  프롬프트 지시를 어기고 임의 값을 낼 가능성에 대한 안전장치다.
- 이 category 태그 방식은 판단 원장에 한정된 "관계형 구조 부분 도입"이다(18항
  프레임 정합성 메모에서 예고된 범위) — 사이트 전체에 지식그래프·임베딩 인프라를
  놓는 확장은 여전히 보류 상태다.

---

## 21. 심플 주가 "장마감~일봉갱신" 공백 구간 브릿지 (2026-07-08 구축)

**배경:** `stocks.html`은 장 마감 중(정규장 종료~다음 갱신) 개별 종목·지수 가격/등락률을
`stocks-data.json`(일 1회, 평일 07:00 KST 이후 갱신)에서 우선 가져오도록 설계돼 있다.
그런데 정규장은 그보다 최대 2시간 앞선 05:00 KST에 이미 끝난다. 이 05:00~07:30 KST 사이엔
일봉 파일이 "어제" 데이터를 그대로 들고 있어서, 개별 종목·지수 3개(S&P500·나스닥·다우)·
스파클라인이 동시에 하루 전 값을 오늘 것처럼 보여주는 상태가 매 거래일 아침 반복 발생했다
(2026-07-08 확인 — 07:16 KST 유저 확인 시 AAPL이 월요일 종가+등락률 그대로 표시, 지수 3개도
전부 하루 전 값). 07:31~07:33 KST에 일봉 파일이 정상 갱신되며 자동 해소됐지만, 유저가
매일 출근 전 이 공백 시간대에 확인하는 패턴이라 반복 재발했다.

**구조 (제거·우회 절대 금지):**

| 함수/변수 | 역할 | 위치 |
|-----------|------|------|
| `isDailyStale()` | `allData.generatedAtKST` 날짜 ≠ 오늘 KST 날짜 → true | stocks.html (isUSMarketOpen 근처) |
| `bridgeOK` | `isDailyStale() && live.extSession === 'post'` (개별 종목/ETF는 `live.dayClose>0` 추가 체크) | rowHTML / renderIndexCards / renderSemiEtfCards 3곳 |
| 가격 브릿지 | 개별 종목·ETF: `live.dayClose`(확정 정규장 종가) 그대로 사용. 지수 3개: `idxEntry.price × (1 + etfLive.changePct/100)` 근사치 | 동일 3곳 |
| 등락률 브릿지 | `live.changePct`(day.c/prevDay.c 기준, 포스트마켓 잡음 없음) 우선 | `calcChangePct()` + renderIndexCards |

**원리:**
- `extSession === 'post'`는 Massive가 실제 포스트마켓 거래를 확인했을 때만 서게 되므로,
  주말·공휴일 비거래일 스냅샷(day.c===prevDay.c 오염, 2026-07-04 사고 사례)에서는 자연히
  `null`이 되어 브릿지가 발동하지 않는다 — 별도 방어 코드 불필요.
- 브릿지는 `isDailyStale()`이 true인 동안만 켜지고, 일봉 파일이 오늘 걸로 갱신되는 즉시
  자동으로 꺼진다. 코드 개입 불필요.
- 지수 가격 브릿지(ETF 등락률 비율 근사)는 추정치다. 실측 대조(2026-07-08): SPX/DJI는
  실제값과 0.03~0.06% 오차. **2026-07-10 정정:** 당시 NDX에서 관측된 최대 0.7% 오차는
  "QQQ-NDX 추적오차"가 아니었다 — QQQ는 애초에 나스닥 종합지수를 추종하지 않아서였다
  (22항 참조). 이후 프록시를 QQQ→ONEQ(나스닥 종합지수 추종 ETF)로 교체해 NDX도 SPX/DJI와
  동일한 수준의 근사 정확도로 이 브릿지를 다시 사용한다.

**2026-07-10 확장 — 장중에도 지수 가격이 어제 종가에 멈춰있던 문제:** 위 근사식(`idxEntry.price
× (1+pct/100)`)이 원래 `bridgeOK`(공백구간) 상황에만 쓰였는데, 장중(정규장 진행 중)엔
liveIdx.price가 항상 null이라 가격이 하루 종일 idxEntry.price(직전 종가)에 고정되는
별개 버그가 있었다(등락률만 실시간, 가격은 고정 — 유저가 야후 파이낸스와 대조해서 발견).
`pctIsLive` 플래그를 추가해 "장중 ETF 프록시" 경로에서도 동일 근사식을 쓰도록 확장 —
idxEntry.price는 장 진행 중엔 항상 "직전 완결 세션 종가"를 가리키므로(오늘 세션은 일봉
파일에 아직 미반영) 이 근사식이 하루 종일 유효하다는 게 핵심 근거.

**규칙:**
- `isDailyStale()`/`bridgeOK`/`pctIsLive` 로직을 건드릴 땐 rowHTML·renderIndexCards·
  renderSemiEtfCards 3곳 전부 동시에 확인한다 (8항 공유 함수 동기화 원칙과 동일 적용).
- 지수 가격 근사식을 "더 정확하게" 바꾸고 싶어도, Massive가 SPX/NDX/DJI 실제 가격을
  직접 주지 않는 한(v3 indices 엔드포인트 미지원 상태, 17항 참조) 완전 정확한 값은
  얻을 수 없다는 걸 전제로 판단할 것.

---

## 22. NDX(나스닥) 카드 — QQQ는 나스닥 종합지수가 아니다 (2026-07-10 확정)

**배경:** 2026-07-10 01:14 KST, 유저가 심플 주가의 나스닥 카드(+1.46%)와 야후 파이낸스
동시각 수치(+0.94%)가 크게 다르다고 제보. 07-08 세션의 "일봉 갱신 공백" 브릿지(21항)와는
무관 — 당시는 정규장 진행 중(장중)이라 그 브릿지 자체가 발동하지 않는 시간대였다.

**진짜 원인 — 지수 정의 자체가 다름:**
`stocks-data.json`의 NDX는 `^IXIC`(나스닥 종합지수, yfinance)에서 수집된 진짜 값이다
(`scripts/fetch-stocks-data.py`: `'^IXIC': {'symbol':'NDX','name':'Nasdaq'}`). 그런데
`renderIndexCards()`의 ETF 프록시는 NDX에도 `QQQ`를 매핑해 썼는데, **QQQ는 나스닥 종합지수가
아니라 "나스닥 100"(대형 기술주 100개, 티커 관례상 진짜 `^NDX`)을 추종하는 ETF다.** 두
지수는 종목 구성이 완전히 다르고(대형 기술주 100개 vs 종합 3,000개+ 전체), 하루 등락률이
꽤 벌어질 수 있다 — 소형주가 대형 기술주와 다르게 움직이는 날 특히 심하다. 실측(2026-07-10):
QQQ +1.46% vs 나스닥 종합지수 실제 +0.94%, 격차 0.52%p. `^NDX`(진짜 나스닥100) 자체는
이날 29,677 부근으로 `stocks-data.json`의 "NDX" 값(25,870대)과 아예 자릿수가 다르다 —
**"NDX"라는 심볼명이 코드 곳곳에서 "나스닥 종합지수"와 "나스닥 100" 두 가지 의미로 섞여
쓰이고 있었던 것이 혼란의 근본 원인.** SPX/DJI는 이런 문제가 없다 — SPY는 S&P500과,
DIA는 다우30과 사실상 1:1로 정확히 대응하는 ETF라서 프록시로 써도 지수 정의 불일치가 없다.

**1차 조치 (2026-07-10 오전, 이후 폐기):** `renderIndexCards()`에 `isCompositeIdx` 예외를
추가해 NDX를 장중에도 idxEntry(일 1회)만 쓰도록 고정 — 정확성은 확보했지만 장중
6.5시간 동안 안 움직이는 트레이드오프가 생겨 유저가 **즉시 반대**함("이렇게 하지 마라").

**최종 조치 (2026-07-10 재작업, 현재 구조):** `isCompositeIdx` 예외를 완전히 제거하고,
대신 프록시 자체를 **QQQ → ONEQ(Fidelity Nasdaq Composite Index ETF)로 교체**했다.
ONEQ는 실제로 나스닥 종합지수(^IXIC)를 추종하는 ETF(2,000+ 종목 보유, 티커 자체가
"Nasdaq Composite Index ETF")라서, SPY가 S&P500을 추종하듯 NDX에도 SPX/DJI와 동일한
실시간 로직을 그대로 적용할 수 있다 — 특별 예외 코드 자체가 불필요해졌다. 변경 파일:
`scripts/fetch-stocks-prices.py`(ETF_LIST에 ONEQ 추가 + proxy_map QQQ→ONEQ),
`stocks.html`(ETF_MAP의 NDX 값 QQQ→ONEQ). 장중 실시간성과 지수 정의 정확성을 둘 다 확보.

**잔여 리스크:** ONEQ 일평균 거래량은 약 29만 주로 QQQ(수천만 주)보다 훨씬 적다 —
5분봉 중 일부 구간에 거래가 비어 스파클라인이 약간 성길 수 있다. 완전 정확한 대안은
아니지만 QQQ(다른 지수)보다는 훨씬 낫다. 이 파이프라인 변경은 다음 fetch-stocks-prices
주기(최대 10분) 이후에나 실제 데이터로 반영되니, 배포 직후엔 ONEQ 데이터가 없어
일시적으로 이전 폴백 경로(idxEntry)로 동작하다가 자동 전환된다 — 정상.

**규칙:**
- 인덱스 심볼 "NDX"를 다룰 때는 항상 "나스닥 종합지수(^IXIC) 기준"이라는 걸 전제할 것.
  진짜 나스닥100(^NDX)과 절대 혼동하지 않는다 — 둘은 자릿수부터 다르다(2026-07-10 기준
  종합 25,000대 vs 100 29,000대).
- `fetch_index_snapshot()`(Massive v3 indices, `I:NDX` 티커)이 언젠가 실제로 데이터를
  반환하기 시작하면, 그건 진짜 나스닥100 값일 가능성이 높다(Massive/Polygon 공식 확인:
  `I:NDX`=나스닥100) — "NDX" 라벨을 단 이 카드(나스닥 종합지수 취지)에 그대로 흘려보내면
  안 된다. 그 엔드포인트가 살아나면 먼저 이 정합성부터 재확인할 것.
- ETF_MAP·ETF_LIST에서 NDX/ONEQ 관련 코드를 건드릴 땐 `scripts/fetch-stocks-prices.py`와
  `stocks.html` 양쪽 동시 확인 (8항 공유 함수 동기화 원칙과 동일 적용).

**추가 조치 (2026-07-10 오후) — 디테일 페이지 TradingView 차트 심볼도 교체:** 위 내용은
목록·카드의 실시간 가격/등락률(ONEQ 프록시)에 관한 것이고, 지수 카드를 **클릭해서 들어가는
TradingView 상세 차트**는 별개 심볼(`getTVSym()`)을 썼다. 기존엔 `CAPITALCOM:US500/US100/US30`
(Capital.com CFD, 무료 임베드 목적)을 썼는데 두 가지 문제가 있었다: (1) NDX 상세 차트가
US100(나스닥100) CFD라서 목록의 종합지수 값과 애초에 다른 지수를 보여주고 있었다(정의
불일치가 목록뿐 아니라 상세 차트에도 있었던 것). (2) **유저 제보(2026-07-10)** — 지수 3개
상세 차트만 "1D/1분봉" 진입 시 시작 시각이 다른 종목·ETF처럼 전날 22:30 KST(프리마켓 시작)가
아니라 당일 06:00 KST경부터였다. 원인: Capital.com CFD 지수는 선물 기반 24/5 연속 거래(UTC
기준 일~금 밤새 거의 끊김 없이 거래)라 TradingView가 "1D" 자동 범위를 NYSE 정규장 캘린더가
아닌 CFD 자체 세션 리셋 시점 기준으로 잡기 때문으로 추정(웹 검색으로 Capital.com 24/5 CFD
거래 특성 확인). **조치(당시):** `TVC:SPX`/`TVC:IXIC`/`TVC:DJI`(TradingView 자체 무료
인덱스 피드, "SP:SPX/DJ:DJI와 차트 동일, 누구나 이용 가능"으로 웹 검색 확인)로 교체 —
실제 NYSE 연동 지수라 다른 차트와 동일한 세션 캘린더를 따를 것으로 기대. 부가로 NDX를
TVC:IXIC(진짜 종합지수)로 맞춰 상세 차트까지 정의 일치를 시도. `SYMBOL_NAMES['NDX']`도
"Nasdaq 100 Index" → "Nasdaq Composite Index"로 정정(이 라벨 자체는 유지).

**롤백 (2026-07-10, 25항 4차 시도 중 발견):** 배포 후 유저가 SPX 상세차트에서 실제로
확인한 결과, TVC 심볼은 "TradingView에서만 제공되는 심볼입니다" 에러와 함께 로드 자체가
실패하고 완전히 엉뚱한 값(310대 — 실제 7,500대와 무관)으로 대체됐다. 웹 검색의 "누구나
이용 가능"은 tradingview.com 사이트에서 직접 볼 때 얘기였고, 제3자 임베드 위젯(tv.js)의
지원 범위는 달랐다 — **검증 한계가 실제로 발현된 사례.** `CAPITALCOM:US500/US100/US30`로
되돌렸다 — NDX 상세차트는 다시 나스닥100 CFD를 가리키게 되어 "정의 일치" 성과는 상세차트
한정으로 롤백됐지만(목록 카드는 여전히 ONEQ로 정확), 완전히 틀린 데이터보다는 낫다.
상세: 25항 "4차 시도(최종)".

---

## 22-B. 스파클라인 세로 여백 14% — min-max 오토스케일 착시 완화 (2026-07-10 확정)

**배경:** 유저 제보 — SOXX/SOXL 카드 스파클라인이 실제 장초가~장마감 차이(SOXX −1.32%,
SOXL −3.68%)보다 훨씬 드라마틱한 스윙처럼 보인다. 실측(2026-07-10): SOXX 인트라데이
최저~최고 변동폭 2.48%, SOXL 7.2%(3배 레버리지라 실제로 SOXX의 약 3배 — 착시가 아니라
진짜 변동성 차이). 원인은 `buildSparkline`/`buildSparklineSmall`이 그날 데이터의
min~max를 차트 세로 높이(H-pad*2) 전체에 꽉 채우는 오토스케일 방식이라, 변동폭이 크든
작든 항상 그래프 전체 세로 공간을 다 쓰도록 늘려 그리기 때문. 이 사이트 모든 스파클라인
(개별종목·ETF·지수 카드)에 공통된 구조.

**조치:** 두 함수의 `min`/`max`/`range` 계산에 원본 변동폭의 14%를 상/하로 여백을 둬서
선이 카드 상단·하단 끝에 딱 붙지 않도록 완화. 모양(추세)은 그대로 유지하되 시각적 진폭만
살짝 눌러준다. 유저가 검토한 대안(변동폭 하한 고정, 고정 % 축 통일, 수치만 표기)들 중
가장 가벼운 "세로 여백 추가"안 선택 — 다른 대안은 시각 언어 자체를 바꾸는 더 큰 결정이라
보류.

**규칙:** 스파클라인 관련 함수를 또 건드릴 땐 `buildSparkline`·`buildSparklineSmall` 둘 다
동시 확인 (`grep -n "vPad = rawRange" stocks.html` → 2건이어야 정상).

---

## 23. 스파클라인 — 프리마켓 제외, 정규장 시작(09:30 ET)부터만 표시 (2026-07-10 확정)

**배경:** 심플 주가의 인트라데이 스파클라인이 프리마켓(4AM~9:30AM ET)부터 포함돼 있어서,
실제 정규장 흐름과 헷갈린다는 유저 피드백. 프리마켓은 거래량이 얇고 변동성이 왜곡돼
보이는 경우가 많아 시각적 참고용으로 부적합하다는 판단.

**조치:** `scripts/fetch-stocks-prices.py`의 `fetch_intraday_bars()`가 이미 각 5분봉의
타임스탬프(`t`, Unix ms UTC)를 갖고 있으므로, 최종 `prices[sym]['intraday']`에 담기 전
`t >= market_open_ms`(09:30 ET) 조건으로 필터링한다. **포스트마켓은 계속 포함** —
21항 "장마감~일봉갱신 공백 브릿지"가 포스트마켓 봉에 의존하기 때문에 끝단은 자르지 않는다.

**중요 — 반영 시점:** 이건 파이썬 파이프라인 수정이라 배포(push)해도 즉시 반영되지
않는다. 다음 `fetch-stocks-prices.yml` 실행 주기(최대 10분) 이후에 새로 수집되는 데이터부터
프리마켓이 빠진 스파클라인이 나온다. "배포했는데 왜 그대로냐"는 질문이 오면 이 시차부터
확인할 것 — 다른 JS 전용 수정과 달리 캐시 문제가 아니다.

**규칙:**
- 스파클라인 관련 인트라데이 배열을 다시 건드릴 땐, 정규장 시작 이전 봉을 다시 포함시키지
  않는다. 필요하면 `today_intraday`(프리마켓 전용, 확장시간 배지 계산에만 씀)처럼 별도
  필드로 분리해서 넣을 것 — 메인 `intraday` 필드에 섞지 않는다.
- `market_open_ms` 계산(EDT/EST 자동 판단)은 건드리지 않는다 — 이미 DST 대응 포함.

---

## 24. bridgeOK "extSession==='post' 단독 조건"의 장마감 직후 공백 — 시간기준 보강 (2026-07-10 확정)

**배경:** 21항 브릿지(`isDailyStale() && live.extSession==='post'`)는 "일봉 파일이 아직
오늘 걸로 안 바뀐 공백 구간"을 감지하는 데는 성공했지만, 조건을 **Massive의 extSession
분류**(포스트마켓 거래가 실제로 찍혀야 `'post'`로 바뀜)에만 의존했다. 정규장 마감
직후(05:00 KST 전후) extSession이 아직 `null`인 짧은 구간이 실재해서, 그 사이엔 브릿지가
전혀 안 켜지고 **전날(또는 그 이전) 일봉 파일 값을 그대로** 보여줬다. 2026-07-10 05:05
KST 유저 제보 — 나스닥 카드가 +1.30%(실제)가 아니라 +0.20%(7/9 데이터, 부호까지 다름)로
표시. S&P500·다우도 동시에 같은 증상(부호 반전 포함)이었다 — 나스닥만의 문제가 아니라
**전 지수·전 종목 카드 공용 `bridgeOK` 로직의 구조적 공백**이었다.

**조치:** `bridgeOK` 조건에 시간 기준(`!isUSMarketOpen()`)과 "실제 변동 여부"
(`dayClose !== prevClose`) 조합을 `extSession==='post'`의 **대체 경로**로 추가했다:

```javascript
var bridgeOK = isDailyStale() && live && live.dayClose > 0 &&
  (live.extSession === 'post' || (!isUSMarketOpen() && live.dayClose !== live.prevClose));
```

`dayClose !== prevClose` 조건은 2026-07-04 사고(`resolveSparkBaseline` 주석 참조 —
"비거래일 Massive 스냅샷은 day.c와 prevDay.c가 같은 값으로 내려온다")에서 확인된 특성을
방어 조건으로 재사용한 것 — 주말·공휴일에 `!isUSMarketOpen()`만으로 브릿지가 잘못 켜지는
걸 막는다. 실제 거래일엔 dayClose가 prevClose와 다르므로 정상 발동.

**적용 범위:** `rowHTML()`(개별 종목·ETF), `calcChangePct()`(등락률 폴백), `renderIndexCards()`
(지수 3장), `renderSemiEtfCards()`(SOXX/SOXL) — 4곳 전부 동일 패턴으로 동시 수정
(8항 공유 함수 동기화 원칙과 동일 적용).

**검증(2026-07-10, 실측 데이터 대조):** origin/main 라이브 데이터로 시뮬레이션 —
SPX 근사가 7,540.33(유저 참조 스크린샷 실측 7,536.61, 오차 0.05%), NDX 26,173.34(실측
26,206.89, 오차 0.13%), DJI 52,432.15(실측 52,462.35, 오차 0.06%) — 기존 부호 반전
오류 대비 대폭 개선.

**규칙:**
- `bridgeOK` 관련 코드를 또 건드릴 땐 위 4곳을 모두 grep으로 확인
  (`grep -n "bridgeOK" stocks.html`).
- extSession 단독 조건으로 되돌리지 않는다 — 장마감 직후 공백이 재발한다.
- `dayClose !== prevClose` 방어 조건을 제거하지 않는다 — 비거래일 오염 스냅샷 재발 방지용.

---

## 25. TradingView 상세차트 — Baseline→Area 단색 전환 (2026-07-10 확정)

**배경:** 유저가 SOXL 상세차트(1D)를 보고 "그날 +10.08%로 크게 플러스 마감인데 차트는
마이너스처럼 보인다"고 제보. 원인: 당시 쓰던 `style:'10'`(Baseline) 차트의 초록/빨강
분리 기준선이 TradingView 기본값으로 **"화면에 보이는 가격 범위의 50%"**(`baseLevelPercentage`,
퍼센트 기반)이라 전일 종가·금일 시가 같은 특정 가격에 고정되지 않는다. SOXL처럼 프리마켓에
크게 갭업한 뒤 정규장 내내 완만히 밀린 날, 하루 전체가 174.82(전일종가) 대비 크게
플러스인데도 그날 자체 가격대(190~204)의 중간값(~197) 아래로 내려간 후반부가 전부
빨갛게 칠해져 "마이너스 마감처럼" 보이는 착시가 생겼다.

**검토했으나 폐기한 대안:** 유저가 "기준선을 전일 시가/금일 시가로 고정"을 제안했으나,
웹 검색으로 확인한 결과 TradingView의 Baseline 스타일은 임베드 위젯(`tv.js`) 기준으로
퍼센트(`baseLevelPercentage`) 방식만 지원하고, 특정 가격값에 절대 고정하는 기능은
Lightweight Charts라는 **별개의 라이브러리**에만 있다 — 우리가 쓰는 위젯에선 신뢰성 있게
구현할 방법이 없다고 판단해 유저에게 명시적으로 설명 후 폐기.

**조치:** Baseline(`style:'10'`) → Area(`style:'3'`)로 전환하고, 그날 전체 등락 부호
하나로 전체 라인·채우기 색을 단색 지정(초록 또는 빨강) — 야후 파이낸스 등 대부분 증권
앱과 동일한 방식. 등락 부호는 개별 종목·ETF는 목록과 동일한 `calcChangePct()`, 지수 3개는
`allData.indices`의 일봉 changePct를 사용(8항 원칙과 동일하게 기존 계산 재사용, 새로
만들지 않음). 색상값은 `ez-design.css`의 `--ez-green`/`--ez-red`와 라이트/다크 모드별로
동일하게 맞춤(`overrides['mainSeriesProperties.areaStyle.*']`).

**검증 한계 — 반드시 배포 후 육안 확인:** `overrides` 프로퍼티 키(`mainSeriesProperties.
areaStyle.color1/color2/linecolor/transparency`)는 TradingView 공식 문서 기반이지만
브라우저에서 실제 렌더링해야만 정확한 적용 여부를 확인할 수 있다. 최악의 경우 색상
오버라이드만 무시되고 기본 색으로 뜨는 정도이지 차트 자체가 깨지진 않을 것으로 예상.

**규칙:**
- 등락 부호 계산 로직을 또 건드릴 땐 목록 뷰(`calcChangePct`)와 상세차트 색상 결정
  로직이 서로 다른 값을 쓰지 않도록 동시 확인.

**2차 시도 실패 — Area 단색 폐기 (2026-07-10):** 위 Area 단색 전환을 배포했더니 NVDA
사례에서 정반대 문제 발생 — 그날 하루 중 199→204까지 크게 반등했지만 최종 등락이 근소한
마이너스(−0.66%)였던 날, 차트 모양은 뚜렷한 상승인데 "하루 전체 부호 하나"로 칠하는
로직 때문에 전체가 빨갛게 나와 "이게 무슨 차트냐"는 유저 반응. 부가로 투명도 오버라이드도
의도대로 안 먹혀 채우기가 과하게 진하게 나옴. **교훈: 하루 순변동 부호 하나로 전체를
단색 칠하는 방식은, 일중 변동폭이 최종 순변동보다 훨씬 클 때(반등 후 되밀림 등) 모양과
색이 정반대로 보이는 새로운 착시를 만든다 — Area 단색은 만능 해결책이 아니었다.**

**3차 시도 (2026-07-10, 현재 구조) — Baseline 복귀 + 기준선 전일종가 근사:** 유저가
처음에 제안했던 "전일 종가 기준"으로 재요청. `style:'3'`(Area) → `style:'10'`(Baseline)
복귀하고, `baseLevelPercentage`를 우리가 가진 실제 인트라데이 데이터(`intraday`/`dayOpen`/
`dayClose`/`price`/`prevClose`)로 "전일 종가가 그 범위 중 몇 %에 해당하는지" 역산해
근사 배치하는 `calcBaseLevelPct()` 함수 추가. NVDA 실측 시뮬레이션 결과 93.1%(거의
꼭대기) — 실제로 그날 NVDA는 시가(204.46)·오후 반등 고점(204.26)만 잠깐 전일종가(204.12)
위였고 나머지는 전부 아래였으므로, 대부분 빨강+짧은 초록 스파이크가 합리적인 정답이다.
검증 한계는 여전히 남아있다: 우리 `intraday`는 23항에 따라 프리마켓이 빠져 있어
TradingView의 실제 표시 범위(프리마켓 포함)보다 좁을 수 있고, 이 경우 계산된 %가
실제보다 다소 높게(기준선이 위로) 나올 수 있다.

**4차 시도(최종, 2026-07-10) — 캔들스틱으로 전환, 재시도 상한선 도달:** 3차(Baseline+
`baseLevelPercentage` 오버라이드)를 배포했으나 NVDA 재확인 스크린샷에서 기준선이 여전히
화면 중간(기본 50%대)에서 갈리는 게 확인됨 — 오버라이드 자체가 이 임베드 위젯에서
반영되지 않는 것으로 판단(3차 연속 실패, 18항 재시도 상한선 도달). `style:'1'`(캔들스틱)로
최종 전환 — 봉 하나하나가 자기 시가 대비 등락으로 색이 정해지는 TradingView 네이티브
기본 동작이라 오버라이드가 전혀 필요 없어 100% 신뢰 가능. `calcBaseLevelPct()` 함수와
그 호출부는 제거(관련 코드 정리). 대신 1분봉 다수라 선/영역 차트보다 시각적으로 복잡해
보이는 트레이드오프는 감수.

**부수적으로 함께 발견·복구된 문제 — 지수 상세차트 TVC 심볼 로드 실패:** 3차 검증 도중
유저가 SPX 상세차트에서 "TradingView에서만 제공되는 심볼입니다" 에러와 함께 완전히
엉뚱한 값(310대 — 실제 7,500대 지수와 무관)이 표시되는 걸 발견. 22항에서 CAPITALCOM→TVC로
바꿨던 지수 심볼(`TVC:SPX`/`TVC:IXIC`/`TVC:DJI`)이 원인 — 웹 검색상 "TVC 심볼은 누구나
무료로 본다"는 정보는 tradingview.com 사이트 자체에서 볼 때 얘기였고, 제3자 임베드
위젯(tv.js)에서는 로드가 거부됨이 실측으로 확인됨. `CAPITALCOM:US500/US100/US30`로 복구 —
NDX가 다시 나스닥100 CFD를 가리키게 되어(22항의 "정의 일치" 성과는 상세차트 한정으로
롤백됨, 목록 카드는 여전히 ONEQ로 정확) 완전히 틀린 데이터보다는 낫다는 판단.

**교훈:** 이 세션에서만 상세차트 관련 시도가 총 4회(색상 3회 + 심볼 1회) 있었고, 그중
색상 대안 2개(Area 오버라이드, Baseline 퍼센트 오버라이드)와 심볼 대안 1개(TVC)가 모두
"문서상 되어야 하는데 실제로는 안 되는" 패턴으로 실패했다. **브라우저 클라이언트에서만
검증 가능한 TradingView 위젯 커스터마이징(overrides, 대체 심볼)은 문서·웹 검색만으로
신뢰하지 말고, 배포 후 실제 스크린샷으로 반드시 재확인할 것 — 그리고 오버라이드가
필요 없는 네이티브 기본 동작(캔들스틱, 기존에 검증된 CAPITALCOM 심볼)이 항상 가장
안전한 선택지라는 걸 우선순위에 둘 것.**

---

## 26. iCloud 동기화로 인한 git index.lock 반복 재발 — Wi-Fi 일시 차단 우회 (2026-07-14 확정)

**★ 2026-07-30 이사 완료 — 이 항은 대부분 역사적 참고가 됐다.** 두 저장소는 iCloud 밖
정식 위치로 이사했다: 이 저장소는 `~/Developer/ezlong`, 앱 저장소는
`~/Developer/flipzen-weather-app`. 구 폴더(`~/Documents/Claude/Projects/...`,
`~/Documents/투자서 날씨 앱 2`)는 `_retired_iCloud_사본` 접미사로 개명해 2주 보관 후 삭제
예정 — 구 폴더에서 절대 작업하지 말 것. 옛 문서(EZLONG_GUIDE, SAFETY_MANUAL, HANDOVER 등)에
남아있는 옛 경로 표기는 2026-07-30 이전 기록이다. 아래 Wi-Fi 우회 절차는 여전히 iCloud
동기화 범위 안에 있는 다른 폴더(ezlong-backups 등)에서 같은 증상이 나면 그때만 쓴다.

**배경:** 유저의 작업 폴더(`~/Documents/Claude/Projects/...`, `~/Documents/투자서 날씨 앱 2` 등)가
전부 iCloud Drive의 "데스크탑 및 문서 폴더" 동기화 범위 안에 있다. 2026-07-14, 라이브 저장소
(`미국주식투자자를 위한 ezlong.com`, ezlong.git)에서 `git add`/`git commit`/`git merge` 시도마다
`.git/index.lock`이 반복 재생성되며 매번 실패하는 사고 발생. `rm .git/index.lock`으로 지워도
몇십 초 안에 또 생겨서 총 3회 연속 실패했다(Claude sandbox bash 확인 1회 + 유저 터미널 시도 2회).
원인은 git 크래시가 아니라 iCloud 동기화 데몬(bird/cloudd/fileproviderd)이 `.git` 내부 파일
변경을 실시간 감시하다 git의 락 생성과 충돌하는 것으로 확인됐다 — 유저가 iCloud를 아예
끄면 로컬 파일이 통째로 유실될 위험이 있어(디스크에 파일 원본이 없고 클라우드에만 있는
"이 Mac에서 다운로드 유지" 미설정 상태일 수 있음) iCloud 자체를 끄는 건 절대 답이 아니다.

**해결(우회, 설정 변경 없음, 데이터 손실 위험 0):** iCloud 동기화는 인터넷 연결이 있어야만
작동한다는 점을 이용한다. git 커밋 작업 동안만 Wi-Fi를 잠깐 꺼서 iCloud 데몬의 개입을
원천 차단하고, push처럼 네트워크가 필요한 단계만 Wi-Fi를 다시 켠 뒤 실행한다.

**절차 (락이 반복 재발하는 상황에서 적용):**
```
1. Wi-Fi 끄기 (메뉴 막대 또는 시스템 설정 → Wi-Fi)
2. rm <repo>/.git/index.lock   (남아있는 락이 있으면 먼저 제거 — 유저 본인 터미널에서)
3. git merge --ff-only origin/main   (필요시)
4. git add <파일 명시>   ← 절대 git add -A 금지 (기존 원칙과 동일)
5. git commit -m "..."   ← "[main xxxxx] ..." 성공 메시지 확인
6. Wi-Fi 다시 켜기, 연결 확인
7. git push   ← 네트워크 필요한 단계는 반드시 온라인 상태에서
```

**규칙:**
- git add/commit/merge 시도 중 `.git/index.lock`이 지워도 곧바로(1분 이내) 다시 생기는
  패턴이 관찰되면, 크래시 복구(락 파일 삭제 반복)를 3회 넘게 시도하지 않는다(18항 재시도
  상한선과 동일 원칙). 대신 이 항목의 Wi-Fi 우회 절차를 안내한다.
- iCloud 동기화를 끄거나 "이 Mac에서 다운로드 유지" 설정을 건드리라고 유저에게 권하지
  않는다 — 로컬에 파일 실체가 없는 상태일 수 있어 데이터 유실 위험이 있다.
- 이 문제는 ezlong.com 저장소뿐 아니라 iCloud 동기화 범위 안에 있는 모든 로컬 git
  저장소(`투자서 날씨 앱 2` 등)에서 동일하게 재발할 수 있다. 어떤 프로젝트든 커밋/머지
  중 index.lock이 반복 재발하면 이 절차를 그대로 적용한다.
- 장기적 근본 해결책은 자주 커밋하는 작업 폴더를 iCloud 동기화 범위 밖(예: `~/Developer`)
  으로 옮기는 것이다. 다만 이는 유저가 원할 때만 진행 — 먼저 나서서 폴더 이동을 제안하지
  않는다.

---

## 27. time/data/background-manifest.json 전용 git 병합 드라이버 (2026-07-25 신설)

`scripts/merge-background-manifest.mjs` + `.gitattributes`(`merge=flipzen-manifest`)로
이 파일 전용 JSON 구조 기반 병합을 등록해뒀다. 이 파일은 30분마다 도는
수집 봇과 `투자서 날씨 앱 2` 저장소의 갤러리 관리툴(gallery-server.js)이
동시에 건드리는 핫스팟이라, 기본 텍스트 3-way 병합이 두 번 실측으로
신뢰 불가능함이 확인됐다(한 번은 conflict 마커 없이 34장을 조용히
유실시킬 뻔함). 상세 배경·검증 내역은 `투자서 날씨 앱 2/CLAUDE.md` 33항
참조. 이 드라이버 파일과 `.gitattributes` 등록을 지우거나 우회하지 말 것 —
지우면 33항에 기록된 사고가 그대로 재발한다.

---

## 28. 클라우드 세션 워크플로우 — 기본 작업 무대 (2026-07-30 이사, 성동님 확정)

**배경:** 2026-07-30부터 ezlong.com 작업의 기본 무대가 Anthropic 클라우드 세션(Cowork)으로
이동했다. 클라우드 샌드박스는 iCloud와 무관한 깨끗한 클론이므로 2항의 "sandbox git 쓰기
금지"(iCloud index.lock이 근거, 26항)의 적용 대상이 아니다.

- **배포:** Claude가 샌드박스에서 `ziririt/ezlong` main에 직접 커밋/push → GitHub Actions →
  Firebase 자동 배포. **유저 터미널 작업 없음.**
- **로컬 맥 폴더는 읽기 전용 백업** — 더 이상 작업 공간이 아니다. 유저가 가끔 `git pull`만.
- **안전 수칙 (협상 불가):**
  - **pull-first:** push 전 반드시 pull/rebase — cron 봇이 수시로 data 커밋을 push하므로
    경합이 상시 존재한다.
  - force push 절대 금지, `git reset --hard` 금지 (tracked 파일 소멸 위험, 16항).
  - `git add`는 파일 명시 — `git add -A` 금지 (기존 가드레일 전부 유지).
  - 배포 후 라이브 HTTP 200 확인 (7항 진단 트리 병용).
- **Cloudflare 캐시:** HTML은 즉시 반영, JS/CSS는 캐시 퍼지 필요. 퍼지는 유저에게
  요청한다 (Cloudflare 로그인 필요).
- **수동 복구 실행 순서 (파이프라인 장애 시):** 시장데이터 → 차트분석 → Firebase.

---

## 29. 이사 패키지 핵심 교훈 통합 (2026-07-30)

기존 항에 없던 것만 추가. 이미 있는 규칙은 해당 항 참조 (Massive 배치 60=19항,
ONEQ=22항, 스파클라인=22-B·23항, 판단원장·혼조 staleness=20항, TradingView=13·25항).

### 인프라

- cron-job.org가 외부에서 GitHub Actions 워크플로우를 트리거한다 (KST 스케줄).
  **watchdog·market-cycle은 workflow_dispatch 전용 — 이 둘만 조용히 멎을 수 있다.**
  파이프라인 점검 시 최우선 확인 대상.
- naver-sync.yml: concurrency 그룹으로 동시 실행 방지, `reset --hard` 금지 패턴 적용됨.
- 저장소에 무관 프로젝트 공존: `time/` 폴더(시계·날씨 앱)는 별개 — git status에 보여도
  무시 (27항 병합 드라이버 참조). codex 등 다른 AI도 같은 저장소를 쓴다.

### 디자인/콘텐츠

- 폰트: `--ez-font` 시스템폰트만, **웹폰트 절대 금지** (Manrope 2회 실패 전례).
  본문 최소 **16px** ("14px 미만 금지"보다 상위 기준). 계산기류·`en/` 페이지는
  타이포그래피 정책 범위 제외.
- LightweightCharts: 풀스크린은 CSS flex+autoSize, 기간 제한은 데이터 슬라이스 방식.

### AI 판단/스코어카드

- 스코어카드 요인 = **원인만** ("VIX 급등", "반도체 약세 심화" 등은 결과이지 원인 아님).
  시장 전체 재료 기준, 개별 기업 금지 (벨웨더 예외).
- 테슬라·머스크: 근거 없는 비방·정치 보도는 부정 재료로 쓰지 않는다. 실적·수치·사실만.
- 세션 인지: `get_us_session` 사용, 세션 용어(프리/정규/포스트) 오용 금지.
- 날짜: `env.today`가 유일 기준. JSON `generatedAtKST`로 현재 날짜를 추론하지 않는다.

### 데이터 표시

- 종목 현재가는 `market-signals.json`의 `symbols` 객체에서만 (Yahoo 직접 fetch는 CORS 차단).
- 레버리지: lev3x 진입 compSell<70, 경계 70, 위험 80 — **7곳 동시 수정 필수.**
  물타기는 배율별 compBuy+compSell+RSI 기준.
- 한국 법정 정년 **60세** (65세 아님) — 연령 구간 콘텐츠 전반 적용.

### 사이트 구조/콘텐츠

- `atmr-dashboard.html`은 인라인 CSS 병용 — 공통 CSS 변경 시 인라인 중복분도 확인.
- 알라딘 제휴 파라미터: `partner=friends327` (2026-07-30 오타 friedns327 일괄 수정 완료).
- 카피라이트 표기: "유니아빠" (유니엄마 제거, 2026-07-20경).
- `en/` 하위 영문판 존재. 4개 AI 동적페이지 이중언어 완료, 8개 도구×5개국어 현지화 완료.
  브라우저 언어 배너 `/lang-banner.js` — 124개 파일에 삽입됨.

### 문체 (유저 선호)

- 배포·명령 안내는 만연체 금지 — 불릿+코드블록 분리. 간결·직설, 불필요한 설명 최소화.

---

## 30. 중요 장면별 체크포인트·말로 하는 롤백 (2026-08-02 신설, 성동님 지시)

**배경:** 성동님(비개발자 오너) 원칙 — "기술적 컨펌을 받는 것은 안전성에 최선이 아니다.
내가 써보고 아니다 싶을 때 원복할 수 있게 준비하라." 사전 승인 절차 대신,
**사후 원복 능력**을 안전장치의 중심에 둔다.

### 체크포인트 태그 — 언제 찍나

의미 있는 기능 묶음을 배포 완료(라이브 확인까지)한 직후, Claude가 자발적으로 찍는다:

```bash
git tag cp-YYYYMMDD-<슬러그>   # 예: cp-20260802-pipeline-fix
git push origin cp-YYYYMMDD-<슬러그>
```

- 대상: 새 코너/기능 완성, UI 대개편, 알고리즘 변경, 성동님이 "이 상태 좋다"고 한 시점.
- 자잘한 0등급 수정마다 찍지 않는다 — "성동님이 되돌아가고 싶어할 만한 장면"만.
- 기존 `stable-*`(대형 작업 전, 5항)·`backup/*`(일일 백업 스크립트) 태그와 공존.
  cp는 "작업 완료 후의 좋은 상태", stable은 "위험 작업 직전 대피소"로 용도가 다르다.

### 롤백 실행법 — 성동님은 말로만 한다

성동님이 "OO 이전으로 되돌려줘", "어제 상태로 원복해줘"라고 말하면 Claude가:

1. `git tag -l 'cp-*'` + CHANGELOG.md로 후보 시점을 찾고, 어느 시점인지 한 줄로 확인
   (모호할 때만 — 명확하면 바로 진행).
2. **forward-fix 방식으로만 되돌린다:** `git checkout <태그> -- <해당 파일들>` 로 그 시점
   파일 상태를 가져와 **새 커밋으로 push.** 히스토리는 보존된다.
3. force push·reset --hard는 롤백에서도 절대 금지 (2항 가드레일 그대로).
4. `data/` 봇 생성 파일·판단 원장은 롤백 대상에서 제외 — 코드/콘텐츠 파일만 되돌린다.
5. 롤백도 배포다 — push 후 라이브 확인(7항)까지 완료하고 보고.

### 성동님 컨펌 최소화 원칙 (2026-08-02 명시)

- 사전 질문·승인 요청은 가급적 하지 않는다. 대신 (a) 자체 검증(grep 셀프체크·블라인드
  감사·독립 재현)을 강화하고 (b) 체크포인트를 남겨 언제든 원복 가능하게 한다.
- 예외(여전히 명시 승인 필요): force push·히스토리 재작성·대량 삭제 등 **되돌릴 수 없는**
  작업. 이건 확인 절차가 아니라 가드레일이다.

---

## 31. 디자인 철학 — Apple + visionOS 글라스 + 테슬라/머스크 제1원리 (2026-08-02 신설, 성동님 지시)

새 페이지·UI 개편 시 따르는 방향. 성동님이 명시한 세 축:

### Apple.com 웹/모바일 디자인 언어

- 넉넉한 여백, 큰 타이포그래피, 절제된 색 사용, 콘텐츠가 주인공(장식 최소).
- 섹션은 크게 끊고, 한 화면에 하나의 메시지. 모바일 우선으로 검증.

### iOS + visionOS 투명 글라스

- 반투명 프로스티드 글라스 패널(`backdrop-filter: blur + saturate`), 깊이감, 부드러운
  라운드(연속 곡률 느낌), 은은한 레이어 분리.
- **단, 가독성 절대 규칙이 항상 우선한다** — 글라스/투명 효과 때문에 대비비·최소
  폰트(본문 16px, 29항)를 깨면 안 된다. 유리 위 텍스트는 배경 블러·오버레이로 대비를
  먼저 확보하고 나서 얹는다. `backdrop-filter` 미지원 브라우저 폴백(불투명 배경) 필수.

### 테슬라 디자인 철학 + "일론 머스크라면 어떻게 했을까"

- 미니멀리즘: 추가보다 **삭제**. 버튼·설명·옵션이 하나 줄어들 수 있는지 먼저 묻는다.
- 제1원리 사고: "원래 그렇게 하니까"를 근거로 삼지 않는다. 요구사항 자체를 의심하고 →
  덜어내고 → 단순화하고 → 그 다음에 자동화한다.
- 판단이 갈릴 때의 기준 질문: "머스크라면 이 요소를 지웠을까, 남겼을까."

### 적용 범위

- 기존 `ez-design.css` 변수 체계와 라이트모드 절대 금지 목록은 그대로 유효 — 이 철학은
  그 위에서의 **방향**이지 기존 가독성 규칙의 대체가 아니다.
- 전면 재디자인을 일괄 단행하지 않는다. 새 페이지·개편하는 페이지부터 점진 적용.

---

## 32. Cloudflare Browser Cache TTL — "기존 헤더 준수"로 확정 (2026-08-04 해결)

**배경:** JS/CSS를 고쳐 배포해도 어떤 방문자에겐 새 파일이, 어떤 방문자에겐 옛 파일이
보이는 증상이 반복됐다(성동님 제보: "어떤 메뉴는 업데이트된 걸로 나오고, 어떤 것은
예전 게 나오네"). 헤더를 실측해 원인을 확정했다 — `firebase.json`이 JS/CSS에
`max-age=600, must-revalidate`를 붙여 보내고 web.app은 그대로 서빙하는데,
**ezlong.com(Cloudflare 경유)만 `max-age=14400`으로 재작성**하고 있었다. Cloudflare의
Browser Cache TTL 기본값(4시간)이 오리진 헤더를 덮어쓴 것. 캐시 Purge로는 해결되지
않는다 — 이미 브라우저에 내려간 4시간짜리 사본은 Purge 대상이 아니기 때문.

**조치 (성동님 실행, 2026-08-04 17:10경):** Cloudflare 대시보드 → Caching →
Configuration → **Browser Cache TTL → "Respect Existing Headers"(기존 헤더 준수)**.

**검증 (2026-08-04 17:14, 성동님 브라우저에서 실측):**
- `/ez-design.css` · `/ez-nav.js` · `/ez-footer.js` → `max-age=600, must-revalidate`
  (기존 14400 → 600, 오리진 헤더 그대로 통과)
- `/index.html` → `no-cache, max-age=0, must-revalidate` (cf-cache-status: DYNAMIC)

**규칙:**
- 이제 캐시 정책의 단일 출처는 `firebase.json`의 headers 블록이다. 캐시 수명을 바꾸고
  싶으면 Cloudflare 대시보드가 아니라 `firebase.json`을 고친다.
- 7항 진단 트리에서 "둘 다 신버전인데 브라우저만 구버전" 단계에 도달했을 때, JS/CSS는
  이제 최대 10분이면 자연 갱신된다. 10분을 넘겨도 옛 파일이 보이면 캐시가 아니라 다른
  원인(하드코딩 사본 등)을 먼저 의심할 것 — 2026-08-04 오전에 실제로 겪은 오진 패턴이다.
- 이 설정을 "성능 최적화"를 이유로 다시 긴 TTL로 되돌리지 않는다. 되돌리면 위 증상이
  그대로 재발한다.

---

## 33. apple-design 스킬 — UI 작업 시 상시 참조 (2026-08-04 신설, 성동님 지시)

**배경:** 성동님 확인 — "이 맥용 클로드 앱에 apple-design 스킬이 있는데 지금 세션에서
쓰고 있니? 안 쓰고 있다면 앞으로 써줘." **쓰고 있지 않았다.** 31항(디자인 철학)은 방향을
정해주지만 구체적 수치·판정 기준이 없어서, 그동안 UI 작업을 감과 실측으로만 해왔다.

**규칙:** 아래에 해당하는 작업을 시작하기 **전에** `Skill` 도구로 `apple-design`을 먼저
불러온다. 31항은 방향, 이 스킬은 그 방향의 구체적 기준이다 — 둘은 대체 관계가 아니다.

- 새 UI·페이지 신설, 레이아웃/여백/타이포그래피 개편
- 애니메이션·트랜지션·제스처(드래그·스와이프·시트·스크롤 이동)
- 글라스/반투명 재질, 그림자·깊이 표현
- 폰트 크기·자간·행간 조정

**적용 시 우선순위 충돌 규칙:** 라이트모드 가독성 절대 금지 목록(14px 하한 등)과
29항 본문 16px 하한이 **항상 우선**한다. 스킬의 권고가 이와 충돌하면 우리 규칙을 따른다.

**이 스킬을 안 써서 실제로 틀렸던 사례 (2026-08-04, 같은 날 오후에 발견·정정):**
모바일에서 한 줄에 글자 수를 벌려고 14px 소형 텍스트(`.tool-card-title`·`.tool-card-desc`·
`.nav-tagline`·`.top9-chip`)에 `letter-spacing: -.02em`을 넣었다. **정확히 반대다** —
음수 트래킹은 커질수록 성겨 보이는 큰 표제용이고, 작은 본문은 0~약간 양수여야 읽힌다.
가독성을 지키려고 14px 하한은 사수해놓고 자간으로 그걸 깎아먹고 있었던 셈이다.
정정: 소형 텍스트 자간 0(칩은 +0.01em), 글자 수는 여백으로만 확보.
히어로도 `clamp(23px,7vw,64px)`에 `letter-spacing: -0.03em` 고정값을 쓰고 있었는데,
고정 트래킹은 전 구간 중 한쪽이 반드시 틀린다 — 크기 연동 clamp로 교체했다.

**아직 남은 미준수 항목 (2026-08-04 실측, 별건으로 진행 예정):**
- `prefers-reduced-motion` 대응: 151개 HTML 중 **1개**(그마저 별개 프로젝트인 time 앱).
- `prefers-reduced-transparency` 대응: **0개**. `backdrop-filter`는 95개 파일에서 쓴다 —
  31항이 글라스를 권장하는 만큼 이 대응이 없으면 투명도 저감 사용자에게 대비가 무너진다.
- 눌림 피드백(`:active`): `index.html` **0건** — 메인 16개 타일이 눌러도 반응이 없다.
  스킬 §1 "피드백은 pointer-down에, 즉시" 위반.
- `ez-nav.js`의 `glide()`는 320ms 고정 이징이라 중간에 잡아서 되돌릴 수 없다 —
  스프링(§3·§4)이 맞는 자리다.

---

## 34. 분석글 문체 — 명사형 개조식 (2026-08-04 신설, 2026-08-05 재지시)

**성동님 지시 원문:** "단순 명료하고 가독성 높게, 그룹핑 및 소제목과 그 아래 항목을
닷블릿 리스트로 구조화. 부족한 설명이어서는 안되고, 디테일하게. 문장은 서술어 없이
명사로 효율적으로 끝맺기. 하지만 말이 너무 짧아서 의미 파악 어려울 정도로 짧아서는
안된다. 풍부하지만, 말투를 간결하게 해달라는 것이다."

**적용 범위 — ezlong.com의 모든 분석글. 예외 없음.**
한 화면 안에서 문체가 섞이면 그 자체가 결함이다(2026-08-05 성동님 지적: TOP9 판단
근거는 '~입니다', 바로 아래 AI 차트분석은 '~했다'로 뒤섞여 있었다).

**규칙**
- 종결: 명사형. `~구간` `~확인` `~진단` `~수준` `~우위` `~미충족` `~진행 중`.
- 금지: `~습니다/~입니다` 존대체, `~했다/~한다/~이다/~된다` 해라체, `~하세요` 권유형.
- 짧게 자르라는 뜻이 아니다. 수치·조건·해석을 다 담고 말끝만 명사로 맺는다.
  - 나쁨: `RSI가 38.1까지 상승했고 MACD도 개선세를 보이며 -2.7561로 올라왔다`
  - 좋음: `RSI 34.9→38.1 상승으로 과매도 구간 탈출, MACD 히스토그램 -2.7561로 개선`
- 구조: 소제목(`h`) + 닷블릿 항목(`items`). 평문 한 문단으로 흘리지 않는다.
- 영문(`...En`, `en/`)은 제외 — 명사형 종결은 한국어 장치다. 영어는 완결 문장으로.

**적용 지점 (문체를 만들어내는 원천 4곳 — 여기만 고치면 화면 전체가 따라온다)**
- `scripts/generate-swing-view.py` — 규칙 엔진 본문(STATS, comp_commentary,
  tsla/nvda/mega_view body, market_context) + LLM 데스크 프롬프트 문체 규격.
- `scripts/generate-chart-analysis.js` — Gemini 프롬프트 상단 `[문체 규격]` 블록.
  `continuity` 필드만 주의: 명사형으로 쓰되 주어에 반드시 `판독`/`판정`을 넣는다.
  `N일 연속 관망 유지`로 쓰면 "앞으로 관망하라"는 권고문으로 오독된다.
- `scripts/fetch-market-scorecard.py` — 출력 규칙의 문체 항목.
- `atmr-dashboard.html`의 하드코딩 문구.

**수정 시 필수 검증 — 수치 멀티셋 가드**
문체만 바꾼다면서 숫자를 흘리는 사고가 실제로 두 번 났다(MSFT `20거래일` 누락, TSM
`9종 중 최고` 신규 창작). 재작성 전후 JSON을 필드별로 비교한다:

```python
Counter(re.findall(r'[+−-]?\d+(?:\.\d+)?%?', text))
```

같은 스크립트로 before/after를 각각 생성해 비교할 것 — 상류 데이터가 바뀐 상태의
스냅샷과 비교하면 무관한 차이가 섞여 판독이 안 된다. 불일치 필드 0이어야 통과.

---

## 35. 안드로이드 에뮬레이터 자동 조작 — 스크린샷·디버깅 레시피 (2026-08-05 신설)

**왜 적어두나:** 2026-08-05 새벽에 "언어별 스토어 스크린샷을 알아서 찍어달라"는
요청을 처리하면서 만든 장치다. 매번 다시 만들면 두 시간이 또 든다.

**전제:** 맥에 안드로이드 SDK, 에뮬레이터(`ltel_pixel`) 기동, FlipZen 앱
(`com.ezlong.flipzenweather`) 설치. `MainActivity.kt`가 이미
`WebView.setWebContentsDebuggingEnabled(true)`를 켜두었다 — 이게 전부의 전제다.

**연결 사슬**

```
adb shell pidof com.ezlong.flipzenweather                 # WebView 프로세스 PID
adb forward tcp:9222 localabstract:webview_devtools_remote_<PID>
curl http://127.0.0.1:9222/json                            # webSocketDebuggerUrl 획득
node <script> <wsUrl> ...                                  # CDP로 페이지 조작
```

Node 22+의 전역 `WebSocket`이면 충분하다 — `ws` 패키지 설치 불필요. 단
DevTools의 `/json` HTTP는 node의 기본 `http.get`으로 붙으면 소켓이 끊긴다
(ECONNRESET). `curl`로 받아 ws URL만 노드에 인자로 넘기는 구조가 안전하다.

**핵심 CDP 명령 세 개**

- `Emulation.setGeolocationOverride {latitude, longitude, accuracy}`
  — `adb emu geo fix`는 에뮬레이터 Extended Controls의 기본 위치(마운틴뷰,
  역지오코딩하면 샌프란시스코)에 계속 덮여서 **믿을 수 없다**. 실제로 도쿄·
  베이징·마드리드를 지정했는데 전부 "San Francisco weather"로 찍혔다.
  CDP 오버라이드는 WebView의 geolocation을 직접 갈아끼우므로 확실하다.
- `Emulation.setUserAgentOverride {userAgent, acceptLanguage}`
  — 온도 단위(`FZ_SEASON.temperatureUnit`)는 `navigator.language`의 지역
  서브태그로 정해진다. 에뮬레이터 시스템 언어가 en-US면 도쿄 날씨가 화씨 74°로
  나온다. `acceptLanguage: "ja-JP,ja;q=0.9"`를 줘야 섭씨가 된다.
- `Runtime.evaluate {userGesture: true}`
  — 음악 재생 버튼은 자동재생 정책 때문에 사용자 제스처 없이는 안 먹는다.

**언어 전환은 OS 로케일이 아니라 localStorage로**

`adb shell cmd locale set-app-locales`는 반영이 한 박자 늦고 불안정했다
(ko를 지정했는데 en으로 찍힌 컷이 나왔다). 앱의 로케일 결정 1순위가
`localStorage["flipzen.locale"]`(i18n/index.js `resolveLocale`)이므로 이걸
직접 쓰고 `Page.reload`가 가장 확실하다. **작업 끝에는 반드시 `ko`로
되돌려라** — 안 그러면 성동님 기기가 포르투갈어로 남는다(실제로 남겼고,
"상파울루인데 왜 한글이냐"는 문의를 받았다. 되돌림 자체는 맞았고 캐시된
좌표만 남아 생긴 착시였다).

**버튼 토글은 상태를 보고 눌러라**

`musicToggle`을 무조건 click하면 이미 재생 중이던 회차에서는 **꺼진다**.
`aria-pressed`를 먼저 읽고 꺼져 있을 때만 눌러야 한다. 한 회차에서 트랙명이
"Ready to play"로 찍힌 원인이 이것이었다.

**스크린샷:** `adb -s emulator-5554 exec-out screencap -p > out.png` (1080×2400).
CDP 세션을 열어둔 채로 찍어야 하므로, 노드 스크립트 안에서 `child_process`로
adb를 부르는 구조가 맞다 — 쉘에서 따로 찍으면 오버라이드가 이미 풀려 있다.

**osascript 브릿지 주의**
- `do shell script`는 완료를 기다린다. 1분 넘는 작업은 `nohup ... & disown`으로
  띄우고 로그 파일을 폴링해야 한다. 안 그러면 브릿지 타임아웃으로 통째로 날아간다.
- 스크립트 파일은 base64로 인코딩해 `base64 --decode > 파일`로 심는 것이
  따옴표 지옥을 피하는 유일한 방법이다.
- 맥이 잠들면 브릿지가 끊긴다. 밤샘 작업은 이 전제를 깔고 설계할 것.

---

## 36. 성동님 스윙 철학 — 모든 판단의 기반 (2026-08-05 명문화)

**성동님 지시 원문:** "나의 스윙 철학, 노하우를 잊었니? 그것부터 찾아보고 거기에
맞춰라. 니가 조사한 역대 통계 등의 지식은 **보조적으로** 나의 스윙 철학 기반 위에서
활용해야 한다. 나도 보지 않고 믿지 않는 스윙 분석을 누가 믿겠니."

**이 항을 만든 이유:** 2026-08-05, 판단이 지나치게 보수적이라는 지적을 받고 임계값을
손봤는데, 성동님 철학을 먼저 찾아보지 않고 내 기준으로 새 숫자를 만들었다. 그게 두 번째
지적을 불렀다. **철학은 이미 코드와 사이트 안에 전부 적혀 있었다** — 새로 만들 게
아니라 찾아서 따라야 하는 것이었다. 아래는 그 발굴 결과다. 판단 로직을 건드리기 전에
반드시 이 항을 먼저 읽는다.

### 원칙 (출처: 사이트·코드 원문)

- **매수 타이밍 = 사람들이 가장 두려워할 때.**
  `atmr-dashboard.html`의 S-CORE v3 주석 원문: "스윙 매수의 진짜 타이밍 = 사람들이
  가장 두려워할 때 / 구조: TREND(20%) + MOMENTUM(30%) + FEAR(50%) — **심리 지표가 보스**".
- **지표는 레벨이 아니라 방향으로 읽는다.** S-CORE의 Delta·Regime·recovery 항이 그
  구현이다. 주석 원문: "RSI 35→55(과매도탈출) → 13점(강력 매수) / RSI 70→55(과매수냉각)
  → 91점(강력 매도)". MACD도 같다 — 히스토그램의 방향과 회복폭을 본다.
- **Gear 변속 매매법.** "Gear 3(200일선 위) + RSI 40~60이면 추세 추종 분할 매수 타이밍.
  Gear 3이더라도 RSI 70 이상 과매수라면 추격 매수보다 기존 보유 유지. Gear 2는 소량
  정찰대만, Gear 1은 200일선 회복 확인 후."
- **3-3-4 분할 매매.** 1차 30% "지표 반등 확인 시 투입" / 2차 30% "저항 상향 돌파·추가
  지지 확인" / 3차 40% "추세 완전 확정 후". 한 번에 다 사지 않는다.
- **손절** — 200일선 하향 이탈 등 리스크 오프 신호 시 **기계적 실행, 감정 배제**.
- **익절** — RSI 75~80 도달 시 분할 익절 시작, 1차 30%부터 단계별.
- **틀려도 좋다.** 성동님 원문: "매수했다가 안되면 매도하면 된다." 판단 보류가 안전이
  아니다 — 아무것도 하지 않으면 틀리지 않는다는 이유로 버티는 건 게으름이다.

### 이 철학을 어기는 전형적 실수 (전부 2026-08-05에 실제로 저지른 것)

- **매수 게이트에 RSI 하한을 높게 건다.** `rsi > 55` 같은 조건은 "두려울 때 사라"의
  정반대다. 공포 구간을 통째로 배제한다. 하한은 40, 상한이 70이다.
- **추세 필터를 두 겹 쌓는다.** `gear 3` 위에 `macdLine > 0`을 또 얹으면, 후행 지표가
  선행 판단을 잡아먹어 문이 몇 주씩 안 열린다. MACD는 방향(히스토그램)으로 읽는다.
- **분할 단계를 기억하지 않는다.** 매일 스냅샷만 보고 "1차 진입"을 반복하면, 반등
  4일째에도 1차를 말하다가 과매수에 닿아 "추격 금지"로 끝난다. 분할매수가 영원히 1차에서
  끝나는 구조. 반드시 진행 단계를 판정한다 — `upDays5`·`rsi5dAgo`·`hist5dAgo`가
  `market-signals.json`에 이미 있다(2026-08-05까지 아무도 쓰지 않고 있었다).
- **정의되지 않은 말로 판단을 미룬다.** "확실한 바닥 신호 대기" 같은 문구. 성동님
  원칙에 '확실한 바닥'은 없다. 있는 건 **200일선 회복**과 **과매도 방향 전환** 두
  트리거다. 트리거 이름과 그때 넣을 비중을 같이 쓰지 않으면 그건 판단이 아니다.
- **화면 안에서 서로 모순되는 말을 한다.** BUY 칸이 "진입 가능"인데 SELL 칸이 "신규
  매수 신중"이면 방문자는 아무 판단도 못 얻는다. 매수 가부는 한 곳에서만 판정한다.

### 통계의 위치

백테스트 수치(STATS·MEGA_CFG 등)는 **철학의 근거이지 철학의 대체가 아니다.**
"중간 점수대는 동전던지기"라는 검증 결과는 *사지 말라*가 아니라 *크게 걸지 말라*는
뜻으로 읽는다 — 우위가 없으면 **비중으로** 답한다(3-3-4의 1차 30%). 통계가 철학과
충돌하는 것처럼 보이면 대개 통계를 잘못 해석한 것이다.

---

## 37. 프라이버시 — 개인 지칭 금지 (2026-08-06 신설, 사고 후속)

### 규칙 (협상 불가)

**사이트에 나가는 어떤 문자열에도 오너 개인을 지칭하는 표현을 쓰지 않는다.**
금지 대상 세 가지 — (1) 이름·호칭("성동님" 등), (2) 지시 내용의 직접 언급
("~하라고 하셨으므로", "오너 지시로"), (3) 개인 견해·사생활의 언급.

적용 범위는 화면 문구만이 아니다. `.html`·`.js`·`.css` 는 Firebase가 그대로
서빙하므로 **주석도 View Source 로 전부 읽힌다.** 코드 주석에 "성동님 지적:"
하고 대화 원문을 붙여넣는 습관은 금지다. 설계 근거는 남기되 **출처를 사람이
아니라 증상으로 쓴다** — "운영 피드백", "이슈 제보", 또는 그냥 "증상: …".

예외는 하나뿐이다. **`김성동` 저자 표기** — `meta[name=author]`, JSON-LD
`author.name`, 출간 도서 인용의 저자명은 의도된 공개 정보이므로 그대로 둔다.

### 사고 기록 (2026-08-05~06)

레버리지 카드의 RSI 근거 문구를 만들며 템플릿 리터럴 안에
`'(성동님 최적대 40~60)'` 을 넣었고, 그대로 라이브에 나가 화면에
`RSI 55(성동님 최적대 40~60)` 로 렌더됐다. 원인은 "주석에 쓰던 표현을 문구로
옮기면서 검사하지 않은 것". 1차 점검 때는 `<script>` 블록의 JS 주석만 걷어내고
`<style>` 안 CSS 주석은 안 걷어내서 오탐 20건이 섞여 나왔다 — **주석 제거기는
HTML 주석 / `<style>` CSS 주석 / `<script>` JS 주석 세 가지를 다 처리해야 한다.**

### 가드

`scripts/check-privacy.py` — 주석을 제거한 뒤 남은 렌더 문자열에서 금지 표현을
찾으면 **종료코드 1**. `firebase-hosting.yml` 의 배포 앞 단계에 걸려 있어
걸리면 배포 자체가 중단된다. 주석에만 있는 건은 경고만 출력하고 통과.

새 문구를 만들 때는 커밋 전에 로컬에서 한 번 돌린다.

```
python3 scripts/check-privacy.py
```

## 38. 두 세션 협업 · 브랜드 원본 (2026-08-07 신설)

### 왜 나눠서 하는가

ezlong.com(웹)과 LongTime EasyLife(앱)는 **대화방을 따로 쓴다.** 저장소가
`~/Developer/ezlong` 과 `~/Developer/flipzen-weather-app` 으로 갈려 있어서,
한 세션이 둘을 오가면 어느 쪽 파일을 만지는지 헷갈린다. 2026-08-06 에 세 번
충돌했는데(`time/manifest.webmanifest`, `time/index.html`, swing-view 데이터)
전부 git 이 잡아줬다 — 같은 세션이었다면 충돌 없이 한쪽이 조용히 덮였을 자리다.
컨텍스트 길이도 현실적 이유다. 한 방에 두 프로젝트를 넣으면 요약 압축 주기가
절반이 되고, 압축될 때마다 세부가 깎인다.

### 연결은 파일로 한다

지시를 두 번 받지 않기 위해, 공유되는 것은 **사람이 아니라 파일**을 통한다.

- **`scripts/brand-spiral.py`** — 나선 심볼의 유일한 원본. 앱이 확정하고 웹이
  사본으로 자산을 굽는다. 웹의 파비콘·PWA·스플래시·헤더 로고가 전부 여기서
  나온다. **사본이므로 어긋날 수 있다** → `scripts/check-brand-sync.py` 로
  기하·색 상수를 대조한다. 앱 저장소가 없는 환경에서는 조용히 통과한다.
- **`icons/`** — 앱 저장소에서 그대로 가져온다. 다시 굽지 않는다. 같은 파일을
  쓰면 웹 파비콘과 앱 아이콘이 어긋날 여지 자체가 없다.
- **브랜드 색** — 배경별로 다르다. 도메인 글자 라이트 `#2563EB` / 다크
  `#3B82F6`, 나선 심볼 라이트 `#2563EB` / 다크 `#4FC3F7`. 한 색으로는 양쪽
  대비를 못 버틴다(각각 5.17:1·3.76:1 / 3.68:1·5.28:1).

### 상대 저장소를 건드릴 때

읽기는 자유롭게, **쓰기는 하지 않는다.** 필요한 파일은 복사해 온다. 상대
세션이 작업 중인 파일을 고치면 그쪽이 되돌리고 서로 덮어쓰기가 반복된다.
`time/` 은 앱 세션 관할이다 — 웹 세션은 손대지 않는다(2026-08-06 에 버전 쿼리
일괄 치환이 `time/index.html` 까지 건드려 충돌했다. 그때 `--ours` 로 상대 것을
남긴 게 옳은 처리였다).

### 옛 나선이 남아 있는 파일

`assets/brand/lockup-*.svg` 는 브랜드 패키지 v1.2 복사본이라 **여전히 옛
곡선**이다. 워드마크(글자)만 쓰는 템플릿으로만 남긴다. `build-web-brand.py`
가 렌더 시점에 나선을 반드시 갈아끼우므로 결과물은 안전하다. 락업이 필요하면
**글자는 원본 픽셀 그대로 두고 심볼만 교체**한다 — 자간·굵기를 재조판하면
예전 것과 미세하게 어긋난다.

---

## 39. 캐시 — 검증이 캐시를 오염시킨다 (2026-08-07, 실제 사고)

버전 쿼리(`?v=…`)는 배포가 **끝난 뒤에** 처음 요청해야 한다.

2026-08-06 밤, 새 브랜드 자산을 푸시하고 배포가 도는 동안 `?v=20260807` URL 로
반복해서 확인 요청을 보냈다. 그 요청들이 엣지에 "이 URL = 옛 파일"을 심었고,
배포가 끝난 뒤에도 1시간 동안 옛 로고·파비콘이 내려갔다. 원본(web.app)과
쿼리 없는 URL 은 이미 새 파일이었는데 버전 URL 만 옛것이었다 — 원인이 배포가
아니라 **내 검증 방법**이었다.

- 배포 진행 중 확인은 **원본(`ezlong-541a8.web.app`)** 이나 쿼리 없는 URL 로
- 버전 URL 은 배포 완료 로그를 본 뒤 **한 번만**
- 이미 오염됐으면 기다리지 말고 버전을 새로 발급한다(`v=…b`)

### 곁들여: 깃허브 액션이 죽을 때

같은 날 Firebase 배포가 두 번 연속 실패했다. 원인은 우리 코드가 아니라
`Failed to resolve action download info. Error: Service Unavailable` —
깃허브가 액션 이미지를 못 내려준 것이다. 이럴 때는 맥에서 직접 배포한다.

```
cd ~/Developer/ezlong && git pull --ff-only origin main
firebase deploy --only hosting --project ezlong-541a8
```

맥에 firebase CLI 가 로그인된 상태라 토큰 없이 바로 된다. 액션 복구를
기다리지 말 것 — 그날은 30분 넘게 안 돌아왔다.

## 40. 파이프라인 운영 — 돌고 있다고 믿지 말 것 (2026-08-07)

### 크론을 추가하면 실행 기록으로 확인한다

크론 목록에 줄을 넣는 것과 그게 실제로 도는 것은 다른 일이다. 2026-07-15 에
`fetch-us-chart-analysis` 에 "KST 07:15 아침 갱신" 슬롯을 넣었는데, 워크플로
안의 ET 시간 체크를 같이 안 넓혀서 **3주 동안 매번 건너뛰었다.** 크론만 보면
돌고 있는 것처럼 보인다. 추가한 다음 날 `gh run list` 로 그 시각에 실제 실행이
있었는지, 로그에 "건너뜀"이 찍히지 않았는지 본다.

같은 이유로 **깃허브 예약 실행은 밀리거나 통째로 건너뛴다.** 2026-08-06 에
swing-view 의 22:45·23:45·23:50 KST 슬롯이 전부 안 돌았고 18:00 슬롯이 20:15 에
돌았다. 크론을 늘리는 건 확률을 높이는 것일 뿐 보장이 아니다 — 보장은 감시견이
한다.

### 감시견에 안 들어간 파이프라인은 없는 것과 같다

`scripts/watchdog.js` 가 데이터 파일의 신선도를 재고 오래되면 워크플로를 자동
재실행한다. 감시 대상에 없으면 며칠이 밀려도 아무도 모른다 — 실제로 방문자가
가장 먼저 읽는 스윙 판단(swing-view)이 감시 목록 10개에서 빠져 있었고, 그래서
5시간 묵은 프리마켓 논평이 장중 화면에 걸렸다.

**새 데이터 파이프라인을 만들면 감시견 등록까지가 한 세트다.** 등록하려면 그
산출 파일에 **ISO 시각 필드**가 있어야 한다(`"2026-08-06 20:15 KST"` 같은
사람용 문자열은 Date 파서가 못 읽는다). 생성기에서 `generatedAt`(UTC ISO)을
같이 쓰는 것을 기본으로 한다.

### 비용은 Actions 가 아니라 LLM 호출에 있다

이 저장소는 **공개**라 GitHub Actions 가 무료다. 하루 300회 넘게 돌아도 ₩0.
그래서 "실행 횟수를 줄여 비용을 아낀다"는 접근은 번지수가 틀렸다 — 신선도는
공짜로 올릴 수 있다.

실제 비용은 전부 LLM 호출이고, 최대 항목은 미국 차트분석이다(45종 × 하루 4~6회).
줄일 곳은 **호출 횟수가 아니라 대상 범위**다. 방문자가 실제로 여는 종목은
TOP9·지수·레버리지에 몰려 있고 긴 꼬리는 하루 한 번이면 충분하다 →
`generate-chart-analysis.js us core`(20종) / `us`(45종) 계층 실행.

계층 판정은 **어느 크론이 쐈는지가 아니라 시각**으로 한다. 실행의 상당수가
감시견의 `workflow_dispatch` 라 `github.event.schedule` 이 비어 있다 — 그걸로
나누면 감시견 실행이 전부 전체 분석이 되어 계층화가 무의미해진다.

### 번역은 잊혀도 신호가 없다

한국어를 고치고 en/ja/zh/es/pt 를 잊으면 페이지는 멀쩡히 뜨고 내용만 몇 주
전 것이다. `scripts/check-i18n.py` 가 커밋 시각을 비교해 "없음/뒤처짐"을
알려준다. 배포는 막지 않는다 — 번역이 원본보다 늦는 건 정상이고, 막으면 급한
수정까지 못 나간다. 로그에 남겨 다음 작업 때 본다.

---

## 41. 화면은 독자의 것이다 — 자기 평가·중복 배치 금지 (2026-08-08)

### 자책도 자랑도 쓰지 않는다

2026-08-05 에 "며칠째 같은 보유 판단을 세고 있는 건 신뢰를 죽인다"는 지적을
받고, 판단이 뒤처지면 먼저 인정하는 문장을 규칙 엔진과 데스크 프롬프트에
넣었다. 그게 반대쪽으로 넘어갔다 — "반등 초입에 더 못 실은 건 실책",
"너무 보수적이었음을 인정한다"가 **며칠 연속** 카드에 걸렸다. 내부에서 오간
지적을 그대로 화면에 옮긴 것이고, 독자는 분석을 보러 오지 사과문을 보러
오지 않는다.

- 숫자는 그대로 공개한다. "'보유' 판단 7일째 — 그 사이 +5.8%" 는 남긴다.
  성적을 숨기는 것과 사과하지 않는 것은 다른 문제다.
- 그 뒤 문장은 **지금 시장 상태와 다음 조건**으로 쓴다.
  "추세 진행 구간, 남은 차수는 조건 충족 시 집행."
- 자랑도 같은 무게로 금지한다 — "예측대로", "정확히 맞혔다". 자책이든
  자랑이든 독자에게는 정보가 아니다.

세 겹으로 막는다. 규칙 엔진 문장(`_streak_line`·`self_review`)을 고쳤고,
데스크·차트 프롬프트에 `[자기 평가 금지]` 항을 넣었고, 그래도 새어 나오는
경우를 위해 `scrub_blame()` 이 JSON 쓰기 직전에 해당 **문장만** 걷어낸다
(수치·판단이 든 나머지 문장은 건드리지 않는다). headline 이 통째로 자기
평가였으면 스탠스 라벨로 대체한다 — 카드 제목이 비면 안 되므로.
`check-privacy.py` 의 `SELF_BLAME` 이 배포 때 생성 카피를 훑어 경고한다.

**주말 주의:** swing-view 는 평일에만 돈다. 금요일에 나간 문구는 월요일까지
그대로 걸린다 — 생성 카피의 문제를 발견하면 코드만 고치지 말고 `data/` 의
현재 JSON 도 같이 청소해야 실제로 화면에서 사라진다.

### 주말 — "오늘의 판단"이 성립하지 않는 이틀

미국장은 금요일 마감 후 월요일까지 열리지 않는다. 그런데 카드는 그 사이 내내
금요일에 쓴 글을 '오늘의 스윙 판단'으로 걸고 있었다. 매주 이틀씩 화면이
거짓말을 하는 구간이 구조적으로 있었던 셈이다 — 파이프라인을 주말에 더
돌린다고 풀리는 문제가 아니다. 시장이 닫혀 있으니 새로 쓸 판단 자체가 없다.

국면을 셋으로 나눈다. 판정은 `ez-nav.js` 의 `window.ezWeekPhase()` 하나뿐이고
`chief-strip.js` 와 `atmr-dashboard.html` 이 같이 쓴다(공유 함수 동기화 원칙).

- `session` — 평일. 평소대로 '오늘의 시그널'.
- `weekend` — 금 마감 ~ **보는 사람의 현지** 일요일 오전 09시. 라벨이
  '직전 장 마감 시그널'로 바뀌고, 휴장 중이며 다음 장까지 갱신이 없다고 알린다.
- `ahead` — 현지 일요일 오전 이후 ~ 월요일 개장 전. '새 주 전망'으로 갈아탄다.

경계를 **보는 사람의 현지 시계**로 잡은 이유 — 서울의 일요일 아침과 뉴욕의
일요일 아침은 같은 순간이 아니고, 사람은 각자 자기 일요일 아침에 다음 주를
생각한다. 휴장 여부 자체는 ET 로 판정하고(금 20:00 ET ~ 월 04:00 ET),
그 안에서 '지난주냐 다음 주냐'만 현지 시계로 가른다.

`ahead` 에서 보여줄 글은 따로 굽는다 — `desk_week_ahead()`. 지난주 복기가
아니라 "다음 장에서 무엇이 켜지면 무엇을 한다"의 조건문으로 쓰게 프롬프트를
따로 뒀고, 없는 일정을 지어내지 못하게 명시적으로 막았다. 비용은 **주말당
한 번** — `forDay`(직전 장 기준일)가 같으면 이미 구운 것을 재사용한다.
전망 생성이 실패하면 조용히 `weekend` 표시로 폴백한다.

### 같은 카드를 여기저기 붙이지 않는다

'오늘의 스윙 판단' 스트립은 한때 4개 페이지(스코어카드·심플주가·차트분석·
마켓사이클)에 붙어 있었다. 심플 주가와 마켓 사이클에서는 뺐다 — 그 페이지의
방문자는 시세와 사이클을 보러 온 사람이고, 맨 위 자리를 다른 코너의 요약이
차지하면 정작 그 페이지의 본론이 스크롤 아래로 밀린다. 31항의 "추가보다
삭제" 가 이 자리에 적용된다. 스트립은 판단이 본론인 페이지(스코어카드·
차트분석)에만 둔다.

---

## 42. 포트폴리오 점검 코너 (2026-08-08 신설)

`/model-portfolio.html` — 공격형 AI 시대 26종목. 메뉴에서 '월가 목표주가' 자리를
대체했다(목표주가는 게시판 형식으로 다시 만들 예정이라 페이지 파일 자체는 남겨뒀다.
영문·다국어 메뉴에는 아직 남아 있다 — 대체 페이지가 한국어뿐이라 지우면 5개 언어에
빈 자리가 생긴다).

### 데이터는 한 파일에서만 나온다

`data/model-portfolio.json` 이 유일한 출처다. 페이지는 그리기만 한다. 이 구조라야
갱신 주체가 둘이어도 화면이 어긋나지 않는다.

- **시세·52주 범위·주간 RSI(14)** — `scripts/fetch-model-portfolio.py` 가 매주
  일요일 밤(UTC 일 20:00 / 보조 23:00) 갱신. 기계가 하는 일.
- **비중·테마·편입/편출·조정 권고** — 사람이 월 1회 갱신. 스크립트는 이 필드를
  **절대 건드리지 않는다.** 종목 추가·삭제도 하지 않는다 — 목록 자체가 판단이다.

`w`(비중) 합계가 100이 아니면 스크립트가 파일을 쓰지 않고 실패한다. 기획 쪽
인수인계가 지정한 배포 중단 조건이라 완화하지 않는다.

### 판정은 함수 하나에서만 나온다

`signal()` 이 테마 카드·기술적 점검·전체 표·포지션 맵 네 곳을 다 그린다.
주간 RSI(14)가 있으면 RSI 기준(80/70/30/20), 없으면 52주 밴드(90/75/35/20)로
자동 폴백한다. **부분 주입이 안전한 구조** — 신규 상장주처럼 주봉이 모자란 종목만
밴드로 남는다. 다만 화면 안에서 두 기준이 섞이면 독자가 비교를 못 하므로,
80% 이상 채워졌을 때만 `meta.signalSource` 를 `rsi` 로 올린다.

### 문장은 비유가 아니라 정보로 쓴다

'메모리·HBM' 테마 설명이 "AI의 병목이자 사이클. 확신을 30%가 아닌 14%로
표현한다"였다. 읽으면 그럴듯한데 방문자가 얻는 정보는 없다 — 왜 14%인지가
빠져 있다. 지적 원문: **"너무 시적이다. 이런 표현 금지."**

- 비유가 정보를 **대신하면** 금지다. "반도체가 곡괭이면 여기는 금광이다",
  "이 포트폴리오의 심장" 같은 문장은 자리만 차지한다.
- 같은 자리에 들어갈 것: 그 테마가 무엇이고, 왜 그 비중인가.
  "지금 이익이 사이클 고점에서 나온 숫자일 수 있어 비중을 14%로 제한한다."
- 비유가 **사실을 압축**할 때는 남긴다 — "모든 AI 칩이 지나가는 단일 병목"은
  업계 표준 표현이고 실제 구조를 말한다.

이 원칙은 이 코너에 한정되지 않는다. 34항(명사형 개조식)이 말투의 규칙이라면
이건 내용의 규칙이다 — 수치·조건·이유 중 하나도 담기지 않은 문장은 뺀다.

### 손대면 안 되는 것 (기획 지정)

- 판정 색 계열 — 매수권 그린 / 적정권 연한 그린 / 매도권 레드. 브랜드 색으로
  치환은 하되 계열은 유지한다.
- 판정 라벨의 '권'을 떼지 않는다. 판정 뒤에 퍼센티지를 붙이지 않는다.
- 테마 카드 순서(AI 플랫폼 → AI 반도체 → 메모리 → SOXX → 전력 → 양자 → 우주).
- 전체 종목 표는 소수점 없이 정수, 판정은 배지가 아니라 글자 색만.
- 기본은 항상 **주간(Weekly)**. 일간으로 바꾸지 않는다.

### 차트분석 딥링크는 해시다 — 쿼리스트링은 조용히 무시된다

`chart-analysis.html` 은 `location.hash` 로 종목을 받는다. `?symbol=NVDA` 로
보내면 **에러 없이** 기본 종목(QQQ)이 열린다 — 링크가 헛도는데 아무 신호가
없는 종류의 고장이다. 반드시 `#NVDA` 형태로 보낸다.

심볼 표기도 주의한다. 색인 키는 `data/chart-index.json` 의 키 그대로이고
한국 종목은 `000660.KS` 다(`000660` 이 아니다). 파일명은 그 심볼의 영숫자
아닌 문자를 `_` 로 바꾼 `analysis-000660_KS.json`. 페이지의 `aiSymbol()` /
`aiFile()` 와 파이프라인의 같은 계산이 어긋나면 링크가 헛돈다.

**우리 종목이 전부 차트분석 대상인 것도 아니다.** 26종목 중 8종목이 빠져
있었고 전력·데이터센터 테마는 통째로 비어 있었다. 없는 종목에 그 링크를
걸면 엉뚱한 화면이 열린다 → `h.ai` 플래그로 갈라 TradingView 로 폴백한다.
플래그는 주간 파이프라인이 파일 실재 여부로 채우고, 주 1회라 최대 일주일
늦을 수 있어 **플래그가 꺼진 종목만** 실제 파일을 한 번 두드려 승격한다.

### 앱 웹뷰 외부 링크 — ez-nav.js 로 옮겼다

외부 링크를 기기 브라우저로 여는 처리가 `index.html` 에만 있었다. 새 코너를 만들
때마다 같은 먹통이 재발할 구조라 `ez-nav.js` 로 옮겼다 — 전 페이지가 로드하므로
한 벌이면 전부 덮는다. 한국 종목 차트 링크(TradingView)가 이 경로를 탄다.

---

## 43. 이슈(A Brief History) — 손으로 쓴 것과 기계가 얹은 것 (2026-08-09)

`/brief-history.html`. 화면 용어는 **'이슈'** 다 — 원래 '소사(小史)'였는데 한자
조어라 젊은 층에 안 읽힌다는 운영 피드백으로 2026-08-09 에 바꿨다. 영문
아이브로우 `A BRIEF HISTORY` 와 제목 '그날 무슨 일이 있었나'는 그대로 둔다.

한 파일(`data/brief-history.json`)에 성격이 다른 두 가지가
섞여 있다. `source` 로 구분하고, 서로의 영역을 넘지 않는다.

- **손으로 쓴 이슈** — `external_knowledge` / `own_article`, importance 2·3.
  제목·요약·판단이 들어간 문장이다. **어떤 스크립트도 덮어쓰지 않는다.**
- **기계가 얹은 기록** — `own_archive`, importance 1. 네이버 채널에 올라간 글을
  '그 글이 다루는 장(場)의 날짜'에 매단 것. 본문 없이 제목·링크와, 차트
  데이터에서 직접 계산한 그날 지수 등락만 담는다.

`scripts/merge-naver-archive.py` 가 매 실행마다 `own_archive` 를 통째로 걷어내고
다시 만든다(멱등). 손으로 쓴 카드가 이미 있는 날이면 새 항목을 만들지 않고 그
카드에 `moreArticles` 로 링크만 붙인다 — 같은 날이 카드 두 장으로 갈리지 않게.

### 날짜 매핑 — **발행 시점의 뉴욕 날짜**(거래일로 스냅)

필자는 한국에 있지만 글이 다루는 시계는 뉴욕이다. 콘텐츠 id 앞 12자리가 발행
시각(KST)이므로 그걸 ET 로 옮기면 그날이 곧 그 글이 살고 있던 장이다.
주말·공휴일은 거래일 달력으로 스냅한다.

- 아침 08시대(KST) 시황 → ET 전날 저녁 → 전날 장.
- 새벽 03시대(KST) 분석 → ET 같은 날 오후(장중) → 그날 장.
- 밤 22시대(KST) 글 → ET 같은 날 오전(프리마켓) → 그날 장.

**처음엔 '이미 마감된 가장 최근 정규장'(16:00 ET 기준)으로 잡았다가 틀렸다.**
장중·프리마켓에 쓴 글이 하루 뒤로 밀려서, 8월 8일 새벽에 쓴 테슬라 분석이
8월 7일이 아니라 8월 6일에 얹혔고 8월 7일 장에는 아무것도 안 남았다.
검증된 시황 매핑(3/23·3/25·8/6)은 새 규칙에서도 그대로다 — 실측 대조:
3/24 08:10 발행 글 → 3/23 장, 본문의 `S&P500 +1.15%` 와 계산값 `SPY +1.08%` 일치.

### 제목만 따오지 않는다 — 브리핑을 만든다

`scripts/brief-history-briefings.mjs` 가 그날 글의 **공개 본문**을 읽어
소제목 + 닷블릿으로 압축한다(`summaryGroups`). 손으로 쓴 이슈와 같은 모양이다.

- **유료라 본문을 못 읽는다고 단정했던 것이 틀렸다.** 실측하니 글당
  2,000~4,000자가 공개로 열려 있고, 원문이 이미 명사형 개조식이라 새로 쓰는
  게 아니라 **고르고 줄이는** 일이다. 숫자는 원문 그대로 옮긴다.
- 본문이 400자 미만이거나 형식 검증에 걸리면 그 날은 건너뛴다 —
  지어내느니 제목만 남기는 게 낫다.
- merge 가 매번 `own_archive` 를 새로 만들므로 **반드시 merge 뒤에** 돈다.
  결과는 글 URL 기준으로 캐시해 두고 다시 채운다.
- 카드 제목은 그날 첫 글의 헤드라인, 나머지 글은 '이 날의 다른 글'로 내린다.

### 목록은 20건씩만 서버가 준다

채널·작가 페이지는 무한 스크롤이라 HTML 에는 최근 20건뿐이다. 전량(867건)은
`scripts/naver-archive-cdp.mjs`(헤드리스 크롬 CDP 로 끝까지 스크롤)로 한 번
긁어 `data/naver-archive.json` 에 넣었고, 이후로는 주간 동기화가 새 글만
얹어 누적한다. 페이지네이션 파라미터(page·pageNo·offset…)는 전부 무시된다 —
다시 시도하지 말 것.

### 차트 마커 밀도 — 봉 개수가 아니라 '점 하나에 몇 픽셀'로 잰다

처음엔 '보이는 봉 170개 이하'로 잤는데, 같은 6개월이라도 PC 는 1,100px, 폰은
308px 라서 폰에서만 점이 붙어 띠가 됐다. 기준은 **가용 폭 ÷ 보이는 봉**이다.

- 8px/봉 이상 — 전부(핵심·주요·기록)
- 3.5px/봉 이상 — 이슈만(핵심·주요)
- 그 미만 — 핵심만

폰에서 6개월을 보면 2.5px/봉이라 핵심만 뜨고, 손가락으로 좁혀 들어가면 주요와
기록이 차례로 살아난다. 창 크기·회전도 판정에 영향을 주므로 `ResizeObserver`
로 다시 잰다. 달력·목록에는 밀도와 무관하게 항상 다 나온다.

### 번역판은 굽는다 — 손으로 여섯 벌을 관리하지 않는다

매일 갱신되는 코너라, 번역 페이지를 손으로 두면 기능을 고칠 때마다 여섯 벌을
따라 고쳐야 하고 반드시 한두 벌이 뒤처진다(뒤처져도 신호가 없다).

- `scripts/translate-brief-history.mjs` — 항목 원문 해시로 캐시(`data/.cache/`).
  새로 붙은 것만 번역하므로 첫 실행만 무겁고 그 뒤는 하루 두세 건이다.
- `scripts/build-brief-history-i18n.py` — 한국어 원본에서 `{lang}/brief-history.html`
  을 굽는다. 원본의 세 구간(`BH_SEO_*`·`BH_I18N_*`·`BH_NOSCRIPT_*`)만 갈아끼우고
  레이아웃·CSS·로직은 한 글자도 건드리지 않는다. 문구는
  `scripts/i18n/brief_history_strings.py` 한 곳에 모여 있다.
- **한국어 원본의 화면 문구를 고칠 때는 그 사전도 같이 고친다.** 원본만 고치면
  번역판은 옛 문구로 남는다.

**모델이 목표 언어를 조용히 무시한다.** 첫 실행 실측: 일본어 요청의 67%가
영어로 돌아왔고(중국어 25%), 그대로 저장했으면 일본어 페이지가 영어로 채워진
채 아무도 몰랐을 것이다. `looksTranslated()` 가 가나·한자 존재 여부와 한글
잔존 여부로 걸러내고, **캐시를 읽을 때도 같은 검사를 건다** — 한 번 잘못 담긴
것도 다음 실행에서 저절로 다시 번역된다. 이 검사를 빼지 말 것.

**자동 생성 문구는 번역기에 태우지 않는다.** '이 날의 글 2건' 같은 기계 생성
제목을 번역시켰더니 언어마다 제각각으로 돌아왔다(일본어판에 영어가 섞였다).
숫자를 세는 문장은 데이터가 아니라 사전(`dayLog`)에서 만든다.

**네이버 링크는 한국어에서만.** 유료 구독 한국어 콘텐츠라 다른 언어에서는 눌러도
읽을 수 없다. 문구를 지우는 방식이 아니라 **번역 데이터에 URL 자체를 싣지 않는
방식**이라 새는 자리가 없다. 번역본을 못 읽었을 때의 폴백(한국어 원본으로 대체)
경로에서도 `stripLinks()` 가 링크를 걷어낸다 — 이 함수를 지우지 말 것.

**본문이 JSON 안에 있다.** `robots.txt` 에서 `/data/` 를 막고 있어서, 이 코너의
JSON 만 `Allow` 로 열어뒀다. 안 열면 크롤러가 빈 껍데기만 보고 간다. 같은 이유로
`<noscript>` 요약 블록을 두며, 이것도 언어별로 굽는다.

### 사후 수익률 — 아카이브를 근거 뭉치로 바꾸는 자리

각 카드에 그 날짜로부터 **5·20·60거래일 뒤 QQQ 수익률**을 붙인다. 그리고 지금
목록에 걸린 이벤트들의 20거래일 뒤 평균과 상승 비율을 머리에 한 줄로 요약한다.

- **새 데이터 소스가 없다.** 페이지가 이미 들고 있는 `brief-history-chart.json`
  에서 계산한다. 파이프라인도, 번역도 필요 없다(숫자라서). 차트가 하루 늘어나면
  최근 이벤트가 저절로 수익률을 얻는다.
- **거래일로 센다.** 달력 날짜로 세면 주말·휴장이 섞여 구간마다 실제 장 일수가
  달라지고 서로 비교가 안 된다.
- **없는 값을 0으로 채우지 않는다.** 아직 20일이 안 지난 이벤트는 5일만 보여준다.
  줄 전체가 비면 줄을 만들지 않는다.
- 요약은 표본 10건 미만이면 내보내지 않고, 날짜를 고른 화면(±1일, 3일치)에서는
  아예 비운다 — 세 건짜리 평균은 우연이다.

### 재료 분류와 AI 판단 — 아카이브를 질문 가능한 것으로

- **분류 어휘를 새로 만들지 않는다.** 브리핑의 각 묶음에 `cat` 을 붙이는데, 값은
  스코어카드 파이프라인의 `FACTOR_CATEGORIES`(20항)를 그대로 쓴다. 어휘가
  갈라지면 나중에 두 코너의 집계를 나란히 놓을 수 없다. 목록 밖 값은 `other`.
- **칩을 누르면 이미 있는 요약 한 줄이 다시 계산된다.** 새 집계 화면을 만들지
  않는다 — "연준 재료가 있던 날들의 20거래일 뒤 평균"이 곧 그 한 줄이다.
- **AI 판단은 git 이력에서 복원한다.** 판단 원장은 심볼당 15개로 prune 되어
  지금 파일에는 사흘치뿐이다. 그런데 매일 커밋되므로 **git 이력 자체가 원장의
  원장**이다. `scripts/extract-judgment-timeline.py` 가 커밋을 거슬러 올라가
  날짜별 QQQ 판단을 모은다(2026-08-09 첫 실행에서 32일 복원). 워크플로에서
  돌 때는 얕은 클론이므로 `git fetch --deepen` 이 먼저다.
- 카드는 '그 뒤 수익률' 바로 아래에 '그날 AI 판단'을 놓는다. **맞았다·틀렸다를
  화면이 판정하지 않는다** — 판단과 결과를 나란히 놓기만 하고 읽는 사람이 한다.

### 날짜를 고른 화면은 시간순으로 읽힌다

전후 ±1일 목록은 **날짜 오름차순**이다(D-1 → D → D+1). 예전엔 '고른 날짜와
가까운 순'이라 D, D+1, D-1 이 되어 흐름이 끊겼다. 전체 목록만 최신순이다.

### 폰에서 세로 스와이프는 차트가 가져가지 않는다

`handleScroll.vertTouchDrag: false`. 폰에서는 차트가 화면 대부분을 덮어서, 그
위에서 위아래로 쓸면 페이지가 안 내려가고 차트만 움직였다 — 읽던 사람이 그
자리에 갇힌다. 가로 스와이프(`horzTouchDrag`)와 핀치 줌(`handleScale`)은
그대로 둔다. 세 가지 다 실제 터치 이벤트로 검증했다(세로 → 페이지 323px 스크롤,
가로 → 페이지 고정·차트 이동, 핀치 → 확대). 이 옵션을 `handleScroll: true` 로
되돌리지 말 것.

### 차트 클릭

마커를 손가락으로 정확히 누르기 어려워, 빗나가도 누른 자리의 날짜에서 가장
가까운 소사(31일 이내)로 보낸다. 단 **팬·핀치줌이 클릭으로 오인되면 차트를
만질 때마다 화면이 튀므로**, 8px·0.4초 기준으로 탭일 때만 반응한다
(`watchTapGesture`). 이 가드를 떼지 말 것.

## 44. 오늘 배운 것 — 코너 두 개를 올리고 남은 규칙 (2026-08-09)

### 굽는 파이프라인은 '커밋 대상'까지가 설계다

번역 페이지를 굽는 코드를 잘 짜놓고, 워크플로의 `git add` 에 그 산출물을 안
넣은 채로 배포할 뻔했다. 캐시(`data/.cache/`)가 빠지면 매일 463건×5개 언어를
처음부터 다시 번역하고(약 195회 호출·40분), 생성 페이지가 빠지면 한국어를
고쳐도 번역판이 안 따라온다 — 둘 다 **아무 에러 없이** 조용히 잘못된다.

**새 산출물을 만들면 그 파일이 실제로 커밋되는지 원격에서 확인한다.**
`git ls-tree -r --name-only origin/main | grep <파일>` 한 줄이면 된다.
로컬에 파일이 있는 것과 저장소에 실린 것은 다른 얘기다.

### 밀도·가독성은 폰 폭에서 먼저 잰다

마커 밀도를 '보이는 봉 개수'로 정했다가 폰에서 띠가 됐다. PC 1,100px 와
폰 308px 는 같은 6개월이라도 완전히 다른 화면이다. 화면에 몇 개가 들어가는지를
정하는 규칙은 **가장 좁은 화면을 기준으로 잡고 넓은 쪽에서 완화**한다.
검증 스크린샷도 폰 폭을 먼저 찍는다.

### 모델이 시킨 언어를 조용히 무시한다

번역 첫 실행에서 일본어의 67%가 영어로 돌아왔다. 사람이 안 보면 영원히
모른다. **생성물의 언어·형식은 프롬프트로 부탁하고 코드로 검증한다.**
검증은 캐시 경계에도 걸어야 한다 — 안 그러면 한 번 잘못 담긴 값이 영구히 산다.

### JSON 을 문자열로 이어붙이지 않는다

JSON-LD 를 만들며 `json.dumps(...)[:-1] + ',...'` 로 노드를 끼웠다가 여섯 언어
전부 깨졌다. 객체로 만들고 마지막에 한 번만 직렬화한다. 자체 파싱 검증을
넣어두지 않았으면 그대로 배포됐다.

### 대량 치환은 대칭 diff + 태그

아이콘 버전 토큰을 150개 파일에서 바꿨다. 안전은 두 가지로 확보했다 —
추가·삭제 줄 수가 정확히 대칭인지(3026/3026), 바뀐 줄 중 그 토큰이 없는
줄이 0인지. 그리고 `stable-` 태그를 먼저 찍었다. 이 조합이면 사후 원복이
한 줄이라 사전 승인이 필요 없다(30항).

### 상호작용 뒤에는 좌표를 다시 잰다

드래그 제스처 가드가 안 먹는 줄 알고 네 번을 파헤쳤는데, 원인은 코드가 아니라
테스트였다 — 앞선 클릭으로 레이아웃이 밀렸는데 예전 boundingBox 로 계속
누르고 있었다. **버그를 의심하기 전에 테스트가 같은 자리를 누르고 있는지 본다.**

### 삽질 기록 — 다시 하지 말 것

네이버 목록의 페이지네이션 파라미터(page·pageNo·offset·currentPage·
lastContentsNo)를 여섯 개 시도했는데 전부 무시된다. 무한 스크롤이라 방법은
헤드리스 크롬(CDP)뿐이다(43항). 야후 chart 엔드포인트를 표준 라이브러리로
직접 부르는 것도 쿠키·crumb 없이는 429 다 — 시세는 yfinance 로 통일한다.

## 45. 확인이 필요할 때의 형식 — 숫자만 답하면 되게 (2026-08-09 지시)

**배경:** 확인받을 것이 본문에 섞여 있으면 글이 길수록 놓친다. 실제로 이 세션에서
번역 범위(영문만 vs 6개국어)를 물어놓고 답을 못 받은 채 진행했다.

**규칙 — 확인이 필요하면 반드시 이 형식으로 낸다.**

- 답변 **맨 끝**에 둔다. 본문 중간에 끼워 넣지 않는다.
- 위아래를 구분선(`---`)으로 막아 본문과 분리한다.
- 제목을 단다(무엇을 정하는지 한 줄).
- 선택지는 **코드블록 안에** 번호로 넣는다. 숫자만 답하면 되게.
- 두 갈래면 `[1] 승인 / [2] 재검토`, 안이 여럿이면 `[1] [2] [3]`.
- 각 번호 뒤에 짧은 라벨과 대시 설명. 설명은 한 줄.
- 한 답변에 확인 묶음은 **하나만**. 여러 건이면 한 묶음 안에 번호로 합친다.

**형식:**

```
---

### 확인 — <무엇을 정하는지>

[1] 좋다 — 이 형식으로 고정
[2] 더 크게 — 제목을 더 키우고 선을 두껍게
[3] 다르게 — 원하시는 모양을 말씀해 주십시오

---
```

(위 예시의 코드블록 표기는 실제 출력에서 ``` 로 감싼다.)

**언제 쓰나 / 안 쓰나**
- 쓴다: 되돌리기 어려운 결정, 취향이 갈리는 방향, 범위가 크게 달라지는 갈래.
- 안 쓴다: 30항(컨펌 최소화)에 해당하는 일반 작업. 스스로 판단하고 체크포인트를
  남긴다. 확인 묶음을 남발하면 이 형식의 눈에 띄는 효과가 사라진다.

## 46. 주간 노하우 수집이 이 저장소에도 닿게 (2026-08-09)

매주 도는 "X.com + Claude 공식 노하우 수집" 작업의 지시문이
`docs/클로드-운용-플레이북.md` 한 경로만 가리키는데, 그 파일은 앱 저장소
(`ziririt/flipzen-weather-source`)에만 있었다. 그래서 2026-08-02 이후 수집
결과가 **이 저장소에는 한 줄도 반영되지 않았다** — 앱 쪽 플레이북 2회차 기록에
ezlong 언급이 0건인 것으로 확인.

- 같은 경로에 ezlong 판 플레이북을 만들어 구멍을 막았다. 옛 기록
  (`docs/claude-selflearn-log.md`)은 그대로 두고 앞으로는 새 파일에 쌓는다.
- **기록만 하고 끝내지 않는다.** 행동 규칙으로 승격할 것은 이 `CLAUDE.md` 에
  항을 만들어 넣는다. 플레이북에만 적어두면 다음 세션이 못 본다.
- 두 프로젝트의 회차 기록을 섞지 않는다. 스택도 위험 요소도 다르다.

## 47. 조용히 망가지는 세 가지 (2026-08-09, 전부 실제 사고)

에러가 나면 고치면 된다. 이 항은 **에러가 안 나는 고장**만 모은다.
셋 다 사람이 화면을 보기 전까지 아무도 모르는 종류였다.

### 응답을 문자열로 이어붙일 때 setEncoding 을 빼지 않는다

```js
let buf = '';
res.setEncoding('utf8');          // ← 이 줄이 없으면
res.on('data', (c) => { buf += c; });
```

없으면 청크 경계에 걸친 한글·가나·한자 **한 글자**가 U+FFFD 로 바뀐 채
통과한다. JSON 파싱도 되고 예외도 안 난다. 실제로 브리핑 37일치, 일본어
219자, 중국어 181자가 이 상태로 라이브에 있었다. 새 HTTP 헬퍼를 만들 때
`res.on('data')` 를 쓰면 이 줄이 있는지 먼저 본다.

방어는 세 겹이다 — 응답을 캐시에 담기 전 검사, **캐시를 읽을 때도** 같은
검사(한 번 잘못 담긴 것이 영원히 사는 것을 막는다, 43항 번역 언어 검증과
같은 자리), 그리고 배포 전 `scripts/check-privacy.py` 의 U+FFFD 게이트.

### git 이력에서 복원하는 산출물은 실행마다 줄어들 수 있다

판단 원장 타임라인(`extract-judgment-timeline.py`)이 32일치에서 4일치로
덮였다. 원인은 러너의 얕은 클론 — `--deepen=400` 은 커밋 수 기준인데 이
저장소는 봇 커밋이 하루 수십 개라 며칠밖에 못 되짚는다.

- 되짚기는 커밋 수가 아니라 **기간**으로 끊는다(`--shallow-since`).
- 그보다 중요한 것: **산출을 새로 쓰지 말고 기존 파일에 얹는다.** 실행
  환경에 따라 결과가 달라지는 복원 작업은 "줄어들 수 없게" 만들어야 한다.
  이 병합을 지우면 얕은 실행 한 번이 몇 주치를 지운다.

### 워크플로 합류 폴백이 사람이 쓴 것을 덮고 있었다

`naver-sync` 는 20분 넘게 돈다. 그 사이 세션에서 같은 파일을 밀어넣으면
push 가 막히고 폴백이 도는데, 그게 `git merge -X ours` 였다 — 충돌 난
파일을 **워크플로 것으로 덮는다.** 손으로 쓴 이슈가 사라질 수 있는 자리였다.

이제 `scripts/naver-sync-rebase.sh` 가 받는다. 충돌은 **원격(사람이 쓴 쪽)
우선**으로 합치고, 기계가 만드는 부분은 그 위에서 다시 굽는다 — 생성기가
전부 멱등이고 캐시가 있어 재실행이 싸다. **오래 도는 워크플로의 합류
전략은 "누가 이기나"가 아니라 "무엇이 다시 만들어질 수 있나"로 정한다.**

### 곁들여 — 빈 구간은 변곡점만 채우지 않는다

글이 없던 구간(2022년 1~2월, 2022년 11월~2023년 1월 초)은 변곡점만 고르면
띄엄띄엄 남는다. 사람들이 많이 들여다보는 구간은 **그 구간의 모든 거래일**을
채운다. 근거는 그날 마감 정리 기사에 실린 수치만 옮기고, 확인 못 한 날은
확인된 사실만 남긴다. 화면에 뜨는 등락은 기사가 아니라 차트 데이터에서
계산한다 — 기준이 다를 수 있다. 작성 뒤에는 tone 과 그날 QQQ 방향의
불일치를 기계로 센다(0건이어야 한다). 입력은 `data/seed/gap-briefings.json`,
적용은 `scripts/seed-gap-briefings.py`(멱등).

---

## 48. 성동님 확정 우선순위·모델·브리핑 방침 (2026-08-09 신설, 성동님 확정)

- **우선순위: ① 최고의 기능(최고의 개발) ② 효율과 자동화 ③ 안전한 개발/안정성.** 성동님은 개발자가 아니라 26년차 웹기획자다 — 개발 이슈의 검증은 전적으로 Claude의 몫이며, 개발 판단을 성동님께 질문으로 넘기지 않는다. Claude가 스스로 판단해 최적의 방식으로 자동 업그레이드를 진행하되, 모든 변경은 커밋·태그(체크포인트 항 참조)로 원복 지점을 남긴다. 성동님은 기획자로서 써보고 "원복해"로 품질을 관리한다 — 안정성은 질문이 아니라 셀프 검증 + 원복 가능성으로 확보한다. 기존 가드레일(force push 금지 등)과 위험 등급제는 그대로 유지된다.
- **모델 정책(Max 200 요금제): 낮은 모델로 여러 번 시행착오를 겪기보다 최고 수준 모델로 한 번에 끝낸다** — 그쪽이 비용·시간·성동님 스트레스 모두 낫다. 토큰을 헛되이 쓰지 않되(불필요한 반복·장황한 컨텍스트 방지), 절약이 최우선이 아니다. 최고의 기능과 성능이 우선.
- **브리핑·보고서는 HTML이 기본이다("브리핑은 HTML이 제 맛").** 잘 디자인된 HTML 문서(아티팩트 또는 파일)로 전달하고, 채팅에는 복붙 가능한 닷블릿 요약을 병행한다. 채팅 텍스트에서 표는 계속 금지, HTML 문서 안에서는 자유.

## 49. 주간 위험 진단 코너 · 지표를 화면에 옮길 때의 네 가지 (2026-08-09 신설)

`/weekly-risk.html` — 시장 국면 진단(BFRS)이 쓰는 네 축(과열·취약성·붕괴·회복)을
합치지 않고 따로 재서 **일주일 사이 어디에서 위험이 커졌는지**만 본다. 판정이 아니라
변화가 주인공이다. 데이터는 `data/weekly-risk.json`, 생성기는
`scripts/build-weekly-risk.py`, 갱신은 `weekly-risk.yml`(토 22:00 UTC = 일 07:00 KST,
보조 일 01:00 UTC) + 감시견 등록. 시험 공개 구간이라 메뉴·사이트맵에 없고 `noindex` 다 —
정식 공개는 그 meta 한 줄을 지우는 것으로 끝난다.

**네 축을 합치지 않는다.** 종합 위험 지수 하나를 만들면 "무엇이 나빠졌나"가 사라지고
숫자만 남는다. 이 코너가 존재하는 이유가 그 분해다. 국면 판정은 이미 옆 코너가 한다.

아래 넷은 전부 블라인드 감사에서 실제로 잡힌 것이다. 지표를 화면에 옮기는 작업이면
매번 같은 자리에서 난다.

### 백분위는 '문구가 곧 정의'가 되게 만든다

동점의 절반을 세는 보통의 백분위(`(less + equal/2)/n`)를 쓰고 화면에 "N%가 지금보다
높았다"라고 적으면 **동점이 많은 계열에서 거짓말이 된다.** 붕괴 신호는 42%의 주가
지금과 같은 0 이고, 탄력 회복은 22%의 주가 지금과 같은 100 이다. 22년 통틀어 더
높았던 주가 하나도 없는 값에 '상위 11%'가 찍혔다. 정의를 문구에 맞춰 **'엄격히 더
높았던 주의 비율'** 로 바꾸고, 0 이면 '역대 최고 수준'으로 말한다.

**'상위/하위'를 값 크기로 갈라 쓰지 않는다.** 축마다 좋고 나쁨이 반대라(회복은 높을수록
좋고 붕괴는 낮을수록 좋다) 같은 표현이 어떤 카드에선 칭찬, 어떤 카드에선 경고로 읽힌다.
위치만 말하는 한 가지 표현으로 통일한다.

### 단위가 다른 항목을 한 줄로 세울 때는 눈금을 먼저 맞춘다

붕괴 신호는 0/1 이라 변화폭이 1.0 이고 점수 항목은 0~100 이라 20씩 움직인다. 그대로
정렬하면 **국면을 바꾼 신호가 늘 꼴찌로 밀려 잘린다.** 실제로 200일선을 처음 이탈해
'추세 붕괴'로 넘어간 주에, 그 사건이 순위 6위가 되어 상위 5개 컷에서 빠졌다 — 화면은
"가장 크게 나빠진 곳: 투기 열기"라고 말하고 있었다. 다른 곳에서 쓰는 환산(개수 →
0~100)을 정렬에도 똑같이 쓰고, **켜짐/꺼짐이 바뀐 항목은 컷에서 예외로 둔다.**

### 숫자는 실제 변화, 색만 방향으로 쓴다

부호를 뒤집은 값(riskChg)을 화면에 그대로 찍으면 '현재 78.6 / −32.2' 처럼 값이 떨어진
것처럼 읽힌다. **표시는 실제 변화, 정렬·색·묶음이 위험 방향**을 맡는다. 그리고 그
규칙을 화면 안 '읽는 법'에 한 줄로 적어 둔다 — 안 적으면 색이 값의 부호로 오독된다.

### 결측을 안심되는 값으로 반올림하지 않는다

`Math.round(null)` 은 **0** 이다. 개수형 지표에서 이걸 거르지 않으면 데이터가 빈 주에
"0개 — 신호 하나도 안 켜짐"이라는 **가장 안심되는 문장**이 찍힌다. 없는 값은 `—` 다.
같은 맥락에서, 한 칸의 예외가 화면 전체를 삼키지 않도록 구획별로 감싼다(`guard()`) —
표본 수 한 칸이 비었다고 진단이 통째로 사라지면 안 된다.

### 곁들여 — 옅은 배경 위 글자는 재서 확인한다

같은 계열의 옅은 배경(alpha 0.10) 위에 같은 계열 글자를 얹으면 라이트모드에서 4.2:1
까지 내려간다. 17px 800 은 WCAG 큰 글자 예외(18.66px 굵게)에 못 미친다. 테두리·배경용
색과 **글자용 색을 따로 둔다**(`--wr-risk-ink`). 눈으로 보지 말고 합성 배경 기준으로
대비를 계산해 확인한다.

---

## 50. 신규 페이지 디자인 절차 — frontend-design 플레이북 (2026-08-10 신설, 성동님 지시)

**배경:** Anthropic 공식 `frontend-design` 스킬(코드 전에 미적 방향을 먼저 못 박아
AI 특유의 뻔한 디자인을 없애는 방법론)을 성동님이 공유하며 "신규 페이지 디자인 시
응용할 수 있게 준비하라"고 지시. 원문을 ezlong 규칙 위에 각색해
**`docs/frontend-design-플레이북.md`** 로 저장했다.

**규칙:**
- **신규 페이지·코너를 만들거나 기존 페이지를 크게 개편하기 전에, 그 문서를 먼저
  읽고 절차를 따른다**: 주제 확정 → 미적 방향 1개 선언 → 토큰 4종(색·타입 스케일·
  레이아웃·시그니처 1개) → 자기비평("다른 브리프여도 똑같았을 부분" 제거) → 코드 →
  스크린샷 재비평. 코드부터 시작하지 않는다.
- AI 디자인 3대 디폴트(크림+세리프+테라코타 / 검정+형광 포인트 / 신문 조판풍)로
  관성 흘러가면 그 부분을 다시 정한다.
- 과감함은 **시그니처 한 곳**에만 쓰고 나머지는 조용히. "액세서리 하나 빼기."
- **기존 한계선이 항상 이긴다**: 웹폰트 금지(타이포 개성은 스케일·굵기로),
  16px/14px 하한, 라이트모드 금지 목록, ez-design 변수 체계, 헤더/푸터 필수,
  라이트/다크·폰 폭 렌더 검증. 33항 apple-design 스킬과 병용(방향은 31항,
  세부 기준은 apple-design, 착수 절차는 이 플레이북).

---

## 51. 스코어카드 극단 판정 가드레일 (2026-08-11 신설, 성동님 승인)

**배경:** 2026-08-11, 지수가 사상 최고치 부근 보합(SPY −0.03%)이고 VIX 15.4인 날
긍정 20:부정 80 판정이 다섯 번 연속 유지됐다. 근거 문구('에너지 가격 급등')는
실측(WTI +0.13%)과 어긋났고, 직전 판단 65:35에서 새 충격 없이 20시간 만에 45점이
움직였다. 유일한 긍정 재료가 테슬라 개별 서사였고, 같은 날 긍정 65점을 받던
금리 인하 기대는 소리 없이 사라졌다. 판단 원장의 연속성 참조가 오히려 잘못된
극단값을 서로 베끼며 굳히는 자기강화도 확인됐다.

**구조 (`scripts/fetch-market-scorecard.py`, 제거·완화 금지):**
- **G1 사실 대조** — '급등/급락/폭등/폭락/심화' 같은 강한 표현은 프롬프트에 이미
  넣는 실측 등락률(QQQ·SPY·VIX·WTI)이 뒷받침해야 한다. `_gr_claim_hit()`은 주어와
  표현이 14자 이내로 붙고 **사이에 다른 주어가 없을 때만** 그 주어의 주장으로
  인정한다('유가 급등과 기술주 급락' 교차 오인 방지 — 실제 테스트로 잡은 버그).
- **G2 변화 상한** — 새 충격(|QQQ|≥2% / |SPY|≥1.5% / VIX≥25 / |VIX변화|≥20%)
  없이 직전 판정에서 부정 점수 30점 초과 이동 금지.
- **G3 극단값 앵커** — 평온한 시장(VIX<18 + SPY 고점 3% 이내 + 당일 급락 없음)에서
  부정 상한 65. 대칭으로 공황(VIX≥30 또는 고점 대비 −15%)에서 긍정 상한 65 —
  극단 비관만 막고 극단 낙관을 놔두면 반대 방향 사고가 난다.

**집행 순서:** 위반 발견 → **위반 사유를 프롬프트에 붙여 1회 재판정**(기존 모순
재시도와 같은 경로 — 같은 프롬프트 재전송은 같은 답이 오므로 반드시 사유를 붙인다.
재시도 결과는 위반이 더 적을 때만 채택) → 그래도 남으면 코드 강제: 점수 클램프
(5단위 반올림이 경계 밖이면 경계 안쪽 5단위로, `_redistribute`로 소계=항목합 유지)
+ 문구는 모순된 강한 단어만 완화(급등→상승 등, 명사형 유지).

**원칙:** 파싱 실패·데이터 결측 항목은 해당 검사만 조용히 건너뛴다(검사 불가 ≠
위반) — 가드레일이 본 기능을 죽이는 일은 없다. 임계값(1.5%/30점/65 등)을 조정할
때는 이 항의 사고 사례를 재현 테스트로 돌려 통과를 확인한 뒤 바꾼다.

---

## 52. 검사에 집행권을 준다 — 스코어카드 방향·국면·크기 (2026-08-14 신설, 오너 승인)

**배경 (2026-08-13, 하루치 카드 전체를 뜯어보고 나온 것):**
23:20 카드가 "인플레이션 둔화 기대(예상치 하회 PPI)"를 긍정 40점으로 올려놓고,
그 PPI가 만든 국채금리 하락(4.69→4.66, 상대 −0.64%)을 "안전자산 선호 심리 반영,
경기 둔화 우려 일부 잔존"이라며 **부정 25점 전부**를 그것에 실었다. 원인을 +40으로
세고 그 결과를 −25로 센 이중 계상이고, 그날은 나스닥 +0.95%·SOXX +2.05%·VIX 14.7로
안전자산 선호와 정반대 국면이었다. 슈왑 장중 리포트는 금리 하락의 원인을 명시적으로
PPI라고 적었다.

**가장 뼈아픈 지점 — 이미 잡고 있었는데 내보냈다.** `validate_content` 체크4
("국채금리 하락이 부정 요인에 분류됨")가 실제로 발화했다. 그런데 재판정 후에도
오류가 남으면 "위반이 더 적은 쪽"을 골라 그대로 게시하는 구조라 통과했다.
51항 가드레일(G1~G4)에만 집행권을 주고 그보다 먼저 있던 방향 검사에는 안 준
설계 누락이다. **검사가 감지만 하고 끝나면 없는 것과 같다.**

같은 날 다른 카드들도 같은 병이었다 — 18:20은 유가 하락을 긍정 +5점,
21:50은 같은 유가 하락을 "경기 둔화 우려" 부정 10점. 17:01은 이름이 '고유가'인데
설명은 '유가 하락에도'. 그리고 긍정 75 : 부정 25가 22시간·아홉 장 연속 유지되는
동안 그 25점을 채우는 재료만 AI 규제 → 고유가 → 반도체 약세 → 유가 하락 →
국채금리 하락으로 계속 갈렸다. **숫자를 먼저 정하고 이유를 나중에 찾은 것.**

**구조 (`scripts/fetch-market-scorecard.py`, 제거·완화 금지):**
- `direction_offenders()` — 점수를 실은 재료만 본다. 한 재료가 여러 규칙에 걸려도
  **항목은 하나**로 합친다(사유는 이어 붙인다). 안 그러면 같은 재료가 혼조에 여러 번
  들어가 화면에 반복 노출되고, 재시도 채택의 '위반 건수' 비교가 왜곡된다.
  - **방향** — 국채금리 하락↔부정 / 상승↔긍정, VIX 하락↔부정 / 상승↔긍정,
    유가 상승↔긍정 / 하락↔부정. 유가는 상승만 보고 하락은 검사조차 없었다(대칭 보강).
  - **국면(G5)** — 주가가 오르고 VIX가 잠잠한 날 '안전자산 선호·위험회피' 금지.
    반대로 하락일에 '위험선호·안도 랠리' 금지.
  - **크기(G6)** — 매크로 지표가 그 재료의 **이름**에 있을 때만 크기를 따진다.
    지표별 하한이 다르다: 국채금리 1.0% / 유가 1.5% / 달러인덱스 0.3% / VIX 5.0%.
    하나로 묶으면 VIX는 상시 미탐, 달러는 상시 오탐이 된다.
  - **사실** — 서술한 방향이 실측과 반대인가. G1은 '급등·폭등'만 봐서 밋밋한 '상승'을
    놓쳤다(유가 −1.72%인 날 '에너지 가격 상승 압력').
- `enforce_direction_rules()` — 위반 재료는 점수를 잃고 혼조로 내려간다.
  **걷어낸 점수를 남은 재료에 얹지 않는다** — 재배분하면 10점짜리가 25점으로 부풀어
  "부정 재료가 없으면 부정 점수를 낮춰라"와 정반대가 된다. 양편의 잔여 가중치를
  **한 번에** 계산해 100으로 재정규화한다(편마다 순차 조정하면 두 번째 편이 이미
  부풀려진 값을 읽는다). 어느 쪽도 85를 넘지 않는다 — 90:10은 판정이 아니라 선언이다.
- **고칠 수 없으면 내지 않는다.** 위반 재료가 한쪽 편의 전부라 그 편이 통째로
  비어버리면 카드를 아예 만들지 않고 종료한다(`sys.exit(0)`). 75분 뒤 다음 사이클이
  다시 시도하고, 그 사이 직전 카드가 그대로 남는다. **틀린 카드보다 낡은 카드가 낫다.**
- `score_frozen_violation()` (G7) — 같은 점수가 이어지는데 그 점수를 채우는 재료만
  바뀌면 재판정시킨다. **집행하지 않는다** — 코드가 대신 써줄 정답이 없는 종류다.
  집행 가능한 것만 집행한다.

**집행 순서 (순서가 중요하다):** 재판정(사유 첨부) → 4-2 G1~G4 클램프 →
4-3 방향 집행 → **G2/G3 재클램프.** 재료 하나를 걷어낸 것만으로 총점이 크게
움직여(부정 40→85) 방금 맞춰놓은 변화 상한과 극단값 앵커가 다시 깨진다.

**오탐의 대가가 달라졌다.** 예전엔 검사가 재판정 힌트였지만 이제는 점수 박탈·
카드 폐기로 직결된다. 그래서 아래 예외를 반드시 유지한다 — 전부 블라인드 감사에서
실제로 재현된 오탐이다.
- 양보 구문(`~에도`, `~에도 불구하고`) 뒤의 방향어는 그 재료의 주장이 아니다.
- '완화·해소·위축' 뒤에 붙은 국면어는 그 국면에서 오히려 정상이다
  ("리스크온 날의 '위험회피 심리 완화'").
- 크기·사실 검사의 주어에 맨 '금리'를 넣지 않는다 — '금리 인하 기대'는 정책금리
  얘기지 10년물 실측 변동폭으로 잴 대상이 아니다. 방향 규칙에만 넣는다.
- 방향어에 '강세·약세'를 넣지 않는다 — 주식 서술어라 'VIX 안정에 위험자산 강세'가
  'VIX 상승 주장'으로 뒤집힌다.
- 실측이 정확히 0.00%면 상승·하락 어느 쪽도 판정하지 않는다.

**원칙 (51항과 동일):** 파싱 실패·결측 항목은 그 검사만 조용히 건너뛴다.
임계값을 조정할 때는 이 항의 사고 문구들을 재현 테스트로 돌려 통과를 확인한 뒤 바꾼다.

---

## 53. 한 화면의 두 판단은 주어를 밝힌다 — 1배수 칸 vs 레버리지 칸 (2026-08-14 신설)

**배경 (운영 제보):** 같은 화면에서 1배수 판단은 "새로 살 자리도 팔 자리도 아닌,
버틸 자리 … 여기서 더 사면 분할이 아니라 추격"인데, 바로 아래 3배수 카드는
"보유·신규 진입 모두 가능 — 5조건 전부 충족"이었다. 제보 원문: "2~3배는 사더라도
1배는 사지 마라고 하는 게 맞나? 신호로서 이해가 안 된다."

**원인은 두 카드가 서로 다른 질문에 답하는데 둘 다 주어를 생략한 것.**
1배수는 *보유 상태*를 판정한다(내 1배수 칸이 목표까지 찼는가 — `exposure` vs `target`).
레버리지는 *시장 상태*를 판정한다(지금 지표가 진입을 허용하는가). 둘 다 참일 수 있고
실제로 그날 둘 다 참이었다. 그런데 어느 쪽도 "무엇에 대한 판단인지"를 안 밝히니
독자에게는 정면 모순으로 읽혔다.

**여기서 파생된 진짜 버그 셋 (전부 코드였다):**
- **분기 삼킴.** 본문 분기 조건이 `exposure >= 0.5` 였다. 목표 100%에 현재 60%인 날 —
  아직 채울 칸이 40%p 남은 날에도 "더 사면 추격"이 나갔다. 같은 상태를 `stance_of()`는
  '분할 매수 대기 구간'으로 판정하므로 **한 카드 안에서 제목과 본문이 정반대**였고,
  올바른 분기(`target > expo`)는 도달 자체가 불가능했다.
- **'조건 미충족'의 이중 의미.** 여기서 말하는 조건은 "목표와 현재 비중에 차이가 있는가"
  라는 기계적 조건이지 "시장에 매수 신호가 있는가"가 아니다. 1배수가 꽉 찬 이유가 바로
  추세가 좋아서(Gear 3 → 목표 100%)인데 그걸 '미충족'이라 쓰면 정확히 반대로 읽힌다.
  데스크 LLM이 그대로 받아 "다음 레버리지 카드는 새 매수 조건 점등 이후"라는 헤드라인을
  썼다 — 같은 시각 레버리지 카드는 5조건 전부 충족이었다.
- **부호를 잃은 비교 (1차 수정이 새로 만든 더 위험한 버그).** `target - expo`를 부호 없이
  다뤄 "덜 찬 상태"와 "목표를 초과해 축소 대기 중인 상태"를 같은 칸으로 봤다. 매도압력이
  목표를 1.0→0.6으로 깎은 바로 그날, 즉 **위험을 줄이기 시작한 날에 "차이가 없다"는 거짓
  문장과 함께 독자를 레버리지 칸으로 보냈다.** 블라인드 감사가 몬테카를로로 잡았다
  (10만 거래일 중 6.6%에서 발생). 원 제보보다 손실 방향으로 위험한 회귀였다.

**구조 (제거 금지):**
- `comp_commentary()`의 보유 구간 문단은 `gap = target - expo`를 **부호 그대로** 셋으로
  가른다: `gap >= min_gap`(채울 자리 남음) / `gap <= -min_gap`(목표 초과, 축소 대기) /
  그 사이(목표 도달).
- **레버리지 안내는 `target >= 0.95`일 때만 붙인다.** 모델이 원하는 목표 자체가 만재인
  경우에만이다. 매도압력 경고로 목표가 깎여 내려온 상태(target 0.6)에서 현재 비중이
  그보다 높다고 "다 찼으니 레버리지로"라고 하면 안 된다.
- 모든 문장은 주어를 밝힌다 — "1배수 칸은 …". 주어 없는 시장 선언 금지.
- `atmr-dashboard.html`의 `tierBridgeNote` — 레버리지 카드(2·3배수)에만 붙이고 1배수
  카드에는 안 붙인다. `compGear === 3`일 때만 붙인다(청산·축소 권고 카드에 레버리지 한도
  안내를 얹으면 없애려던 모순을 새로 만든다). `target <= 0`(위험 회피 우선) /
  목표 초과 / 만재 / 여유 네 갈래로 나눠 쓰고, 데이터가 없으면 조용히 빈 문자열.
- `comp.target` · `comp.exposure`를 swing-view.json에 내보낸다 — 레버리지 카드가 1배수 칸의
  충전 상태를 말할 수 있게. 없으면 브리지 문장이 통째로 빠진다(폴백 안전).
- 데스크 프롬프트에 두 조항: 칸을 구분해서 쓸 것, 비중이 찬 것과 신호가 꺼진 것은 다를 것.

**검증 방법 (임계값을 만질 때 반드시 재실행):** exposure·target 0~1(0.05 간격) ×
gear 1~3 × buy·sell 임계값 × targetWhy 7종을 전수 격자로 돌려 네 가지를 센다 —
① 축소 구간에서 레버리지 안내가 붙는가 ② 제목과 본문이 반대인가 ③ "차이가 없다"고
써놓고 실제 차이가 최소폭 이상인가 ④ 본문에 찍힌 숫자가 state와 다른가. 전부 0이어야
통과한다(2026-08-14 기준 32만 조합에서 0건).

---

## 54. 판정은 우리가 한다 — 조건 목록을 독자에게 넘기지 않는다 (2026-08-14 신설)

**제보 원문:** "3배 물타기 부분에서도 지금 시점 기준 이 조건에 맞는지 니가 점검해서
단도직입 말해줘야지, 독자에게 조건에 맞는지 보고 들어가라고 하면 안 된다. 내 지침을
어긴 것이다. (…) 도대체 지금까지도 물타기 하지 말라고 해놓고선 그럼 언제 물타란
말이냐? 신중이 지나치다. 타이밍이 중요한데 한 번도 그 타이밍이 없는 결과는 허망하다."

**증상:** 2·3배수 물타기 카드가 "조건을 건다: 매도압력 60점 미만 + 매수 70점 이상 +
RSI 65 이하 + MACD 양전환. 이 4조건 충족 시 소량 추가 가능"이라고만 적고 **오늘
충족 여부를 말하지 않았다.** 그날 실측은 매도압력 46 · 매수 76 · RSI 61 · MACD 라인
+4.68 히스토그램 +4.55 — **네 조건 전부 충족**이었다. 판정할 수 있었는데 체크리스트를
독자 손에 쥐여 준 것이다.

**원인:** 동적 갱신 대상이 `tier2-new-g3` · `tier2-fire-g3` · `tier3-new-g3` ·
`tier3-fire-g3` 넷뿐이었다. 물타기 칸은 id 조차 없어 **정적 HTML 그대로** 나갔다.
1배수 물타기만 별도 forEach 로 갱신됐고, 그마저 문자열 제목 비교 방식이라 취약했다.

**두 번째 원인 — 흩어진 RSI 상한.** 카드마다 60·65·70이 제각각이었다. 그래서 같은 날
신규는 허용, 물타기는 판정 없음, 불타기는 "기준 미달"이 동시에 나왔다. 세 숫자 어디에도
근거가 없다. 스윙 원칙의 숫자는 하나다 — **최적 매수대 40~60, 추격 금지선 70.**

**구조 (제거 금지):**
- `avgDownVerdict(tier)` 하나가 1·2·3배수 물타기를 전부 판정한다. 세 벌로 나누면
  반드시 하나가 뒤처진다(8항). `tier1-avg-g3` · `tier2-avg-g3` · `tier3-avg-g3`.
- 출력은 **오늘 충족/미충족을 먼저 단정**하고, 실측 수치를 그대로 붙이고, 미충족이면
  걸린 항목을 이름으로 말한다. "조건 충족 시 가능" 같은 조건문으로 끝내지 않는다.
- **RSI 상한 70 통일.** 최적대(40~60)를 벗어난 구간은 **금지가 아니라 절반**으로 답한다.
  근거는 스윙 철학(36항)의 "우위가 없다는 건 사지 말라가 아니라 크게 걸지 말라는 뜻" —
  문을 닫으면 "그럼 언제 사란 말이냐"가 되고, 실제로 그렇게 됐다.
- 배율 차이는 **문턱이 아니라 한도와 매도압력 상한**으로 준다. 매도압력 상한
  1배 65 / 2배 62 / 3배 60(단조), 한도 30% / 20% / 15%, 최적대 밖이면 그 절반.
  3배수만 MACD 방향 확인을 추가로 요구한다.
- 허용 판정에는 반드시 **중단 조건**을 함께 적는다.

**말투:** 이 작업 중 '~하세요' 금지 표현이 7곳 남아 있던 것을 함께 정리했다
("지금 더 사지 마세요" → "추가 매수 자제 구간" 등). 카드 문구를 만질 때
`grep -n "사지 마세요\|줄이세요\|지켜보세요" atmr-dashboard.html` 로 0건을 확인한다.

**원칙 한 줄:** 화면이 판정하지 않고 조건만 나열하면, 그건 분석이 아니라 면피다.

---

## 55. 근거에 이름을 붙인다 — 익명 신호·익명 전문가 금지 (2026-08-14 신설)

**제보 원문:** "'과거 5번만 나타난 시장 경고 신호 발생, 일부 전문가 비관론'으로 나오는데,
조금 더 자세히. 혹시 Shiller CAPE 비율인가? 그럼 그 정도는 얘기해줘야지. 단순히
시장경고라고만 하면 어쩌냐?"

**실제로 그 신호는 실러 CAPE(경기조정 주가수익비율) 41배였다.** 장기 평균 17.8배의
두 배가 넘고, 과거 같은 수준은 1929년 8~9월 · 1997~2001년 · 2017~2018년 ·
2019~2020년 · 2020~2022년 다섯 번이다. 이름 한 줄만 적었어도 독자가 스스로 판단할 수
있는 재료였는데 '경고 신호'로 뭉갰다. 게다가 그 재료 하나가 부정 25점 전부였다.

**규칙:** 점수를 실은 재료는 근거에 이름이 있어야 한다.
- 신호·지표를 근거로 들면 **지표 이름과 수치**를 적는다. "경고 신호"가 아니라
  "실러 CAPE 41배(장기 평균 17.8배)".
- 사람 말을 근거로 들면 **그 사람이나 기관 이름**을 적는다. "일부 전문가",
  "일각에서", "분석가들"은 근거가 아니다. 같은 날 다른 카드가 "Michael Burry의 QQQ
  풋 포지션 확대"라고 이름을 적은 것이 옳은 형태다.

**구조:** `anonymous_evidence()`가 `direction_offenders()` 결과에 합류해 **같은 집행
경로**를 탄다(52항) — 재판정 프롬프트에 사유가 붙고, 그래도 남으면 점수를 잃고 혼조로
내려가며, 그 재료가 한쪽 편의 전부면 카드를 내지 않는다. 판정은 두 갈래다.
- `_VAGUE_SIGNAL`(경고 신호·위험 신호·기술적 신호 등)이 있는데 `_IND_ANCHOR`
  (CAPE·실러·힌덴부르크·장단기 금리차·풋콜·VIX·배수·%·포인트 등)가 없으면 위반.
- `_VAGUE_VOICE`(일부 전문가·일각에서·분석가들 등)가 있는데 `_SRC_ANCHOR`
  (라틴 고유명사 3자 이상, 또는 골드만·모건스탠리·연준·버핏 등 알려진 기관·인물)가
  없으면 위반.

**주의 — 앵커 목록은 넓게 유지한다.** 좁히면 정상 재료가 걷어차이고, 이 검사는
집행권이 있어 오탐의 대가가 크다(52항의 교훈). 지표나 기관을 새로 만나면 목록에
더하는 쪽으로 대응하고, 판정 로직을 조이지 않는다.

---

## 56. 가로로 흔들리는 페이지 — 문서 가로 스크롤을 만들지 않는다 (2026-08-14)

**제보:** "AI 차트분석 페이지가 가끔 좌우로 움직인다. 세로 스크롤하다 보면 흔들거린다.
가끔. 지금은 또 괜찮아."

**간헐적이라 재현이 어려운 종류다.** 정적 상태로 폭을 재면 초과가 0px 이라 아무것도
안 잡힌다. 원인은 순간적으로만 생긴다 — 이 페이지는 차트 캔버스 크기를 라이브러리가
직접 계산하는데, 폰에서 주소창이 접혔다 펴지며 뷰포트가 바뀌면 재측정 사이에 캔버스가
컨테이너보다 잠깐 넓어질 수 있다. 그 찰나 문서에 가로 스크롤이 생기고, iOS 는 가로
고무줄 스크롤을 허용해 화면이 좌우로 밀린다. 손을 떼면 돌아오니 "지금은 또 괜찮아"가 된다.

**조치 — 원인을 쫓지 말고 결과가 불가능하게 만든다.**
- `html, body { overflow-x: clip }` — **hidden 이 아니라 clip.** hidden 은 스크롤
  컨테이너를 만들어 sticky 헤더를 죽인다. clip 은 안 만든다.
- `html { overscroll-behavior-x: none }` — 고무줄 자체를 끈다.
- `.ca-chart-wrap { overflow: hidden }` + 캔버스 `max-width: 100%` — 넘칠 자리를 없앤다.
- 전체 창 모드(`position: fixed` + `100vw`)는 `body:has(.ca-fullscreen)` 로 예외.

**검증 방법 (간헐 버그를 재현 없이 확인하는 법):** 페이지에 **일부러 3000px 짜리
요소를 붙여 보고** `documentElement.scrollWidth <= clientWidth` 가 유지되는지 본다.
유지되면 어떤 요소가 언제 넘치든 문서는 밀리지 않는다 — 원인을 특정하지 않고도
증상을 봉인한 것이다. 폰 폭·PC 폭 · 라이트/다크 각각 확인하고, sticky 요소가 살아
있는지도 같이 센다(clip 을 hidden 으로 잘못 쓰면 여기서 걸린다).

**같이 정리 — 스트립 배치(41항 적용).** 이 페이지의 '오늘의 스윙 판단' 스트립을 뺐다.
차트 판독을 보러 온 사람의 첫 화면을 다른 코너의 요약이 차지하고 있었다. 스트립은
이제 긍정vs부정·스윙 대시보드 두 곳에만 남는다. 번역판 5개에는 원래 없었지만
가로 흔들림 방지 CSS 는 같이 넣었다(같은 증상이 언어와 무관하므로).

---

## 57. TimesFM 예측 범위 — 용어·적용 경계·실험실 (2026-08-16 신설)

**용어:** 화면 용어는 **'예측 범위'**다. '대역(帶域)'은 어렵다는 운영 피드백으로 교체
(43항의 '소사→이슈'와 같은 계열 — 한자 조어는 화면에 쓰지 않는다). 설명 문구도
확률 수치로 직관화: "진한 띠 안에 들어올 확률 40%, 옅은 띠 안에 들어올 확률 80%".

**적용 경계 (2026-08-16 확정, 판단 존중 확인):** 차트분석에만 적용. 원칙은
"기능을 위한 기능 금지 — 결과가 좋아야 좋은 것".
- 적용: 차트분석 카드(값 예측이 아니라 흔들림의 크기).
- 적용 2호 (2026-08-16 승격 확정): 마켓 사이클의 "이번 달 계기판" 보조 위젯 —
  본 판정과 별도 상자, 판정 배지·색 어휘 금지(좋다/나쁘다가 아니라 흔들림의 크기만),
  데이터 없으면 상자째 숨김. 본 판정 로직에는 미연결.
- 적용 3호 (2026-08-16 승격 확정): 스윙 판단·TSLA·NVDA·TOP9 카드의 "TimesFM 1주 —
  모델이 보는 상승 확률" 참고 줄. 저장된 분위수(q10~q90)의 누적분포를 기준 종가
  위치에서 선형 보간해 P(1주 뒤 가격 > 기준 종가)를 계산. 분위수 밖은 90%/10%에서
  자른다(꼬리는 모델도 모른다). **판단 엔진에는 미연결** — "규칙 판단과 무관한 참고
  지표" 문구를 줄 안에 박는다. 심볼 매핑 주의: 스윙뷰의 GOOG ↔ 예측 파일의 GOOGL.
  파이프라인 심볼은 12개(TOP9 완전 커버를 위해 TSM·AVGO 추가).
- 보류: 포트폴리오 점검(범위 적중률 채점 후 재판단).
- 부적합: 긍정vs부정(가격은 결과 재료 — 자체 규칙에 걸린다),
  장기 시뮬레이터 4종(모델 지평 최대 64거래일 — 20년 시뮬에 넣으면 장식).

**실험실 페이지:** `/labs-timesfm.html` (noindex, 메뉴 없음, weekly-risk 와 같은 시험
공개 방식). 위 판정을 말이 아니라 **실데이터 시안으로** 보여준다 — 각 코너에 붙였을
때의 모습을 점선 프레임 안에 그대로 렌더하고, 부적합 사유도 화면으로 시연한다
(긍정vs부정 시안에는 자체 규칙 위반 도장이 실제로 찍혀 있다). 배경: 안 쓰기로 한
판단은 존중하되 "쓰면 어떻게 되는지 눈으로 확인하고 싶다"는 운영 요청.

**채점 체계:** data/timesfm-forecast.json 이 매일 커밋되므로 git 이력이 곧 예측
원장이다. 약 한 달 축적 후 "q10~q90 범위 안에 실제 종가가 들어온 비율"을 채점한다 —
80% 부근이면 정직한 범위, 크게 벗어나면 카드 철회. 보류 항목의 승격 여부도 이
채점이 근거다. 베타 딱지는 채점 전까지 유지.

---

## 58. 주말을 '휴장'이라고 부르지 않는다 (2026-08-17 신설, 성동님 지시)

**지시 원문:** "스윙 시그널 등 주식시장을 언급할 때, 앞으로 다시는 주말 휴장을
'휴장'이라고 특별히 부르지 마라. 사람들은 토/일요일 주식시장을 하지 않는 것을
'휴장'이라고 하지 않는다. 그러므로 '휴장'이라고 하면 평일에 주식시장 하지 않는 것으로
오해를 한다. 당연히 금요일 장이 끝나면 다음 장은 월요일이라고 생각한다. 그러므로
따로 주말 휴장을 언급하지 않아도 된다."

**왜 맞는 지적인가.** 이름을 붙인다는 건 "알릴 값이 있다"는 신호다. 토·일에 미국장이
안 열리는 건 독자가 이미 아는 사실이라 알릴 값이 0인데, 거기에 '휴장'이라는 이름을
붙이면 없던 정보가 생긴 것처럼 읽힌다. 그리고 그 이름은 실제로는 다른 사건 — 평일
공휴일 휴장 — 을 가리키는 말이라, 오독까지 만든다. 55항("근거에 이름을 붙인다")의
뒷면이다: **알릴 값이 있는 것에만 이름을 붙인다.**

**규칙**
- 화면 문구·생성문에서 주말을 가리켜 '휴장', '주말 휴장', '휴장 중', '휴장일'로 쓰지
  않는다. 주말이라는 사실 자체를 굳이 언급할 필요도 없다.
- 시점을 밝혀야 할 때는 사실만 쓴다 — "직전 장(금요일) 마감 기준", "직전 장
  {날짜}(미국장) 마감", "다음 장 개장 전까지 갱신 없음".
- **평일 공휴일 휴장은 예외로 살린다.** 추수감사절·크리스마스·독립기념일 등은 독자가
  모르면 손해라 알릴 값이 있다 — 이때는 '휴장'이 맞는 말이다.

**적용된 곳 (2026-08-17)**
- 화면: `atmr-dashboard.html` 주말 안내 상자(앞머리 "미국장 휴장 중 —" 제거),
  `chief-strip.js` 메타 줄(→ "직전 장 {날짜}(미국장) 마감").
- 생성 프롬프트: `fetch-market-scorecard.py` 세션 라벨(`주말 휴장` →
  `주말(금요일 정규장 마감 후)`, `휴장(정규장 마감 후 야간)` → `정규장 마감 후(야간)`)
  과 세션 블록 규칙, `generate-swing-view.py` 데스크 프롬프트 2곳(일일·새 주 전망).
  **라벨을 먼저 고치는 게 핵심이다** — 코드에 있는 말이 프롬프트를 타고 생성문에
  그대로 옮겨붙는다.
- 검사: `validate_content()` 체크 8 — '주말 휴장'은 세션 무관 재판정 사유,
  세션이 `weekend`일 때 '휴장'이 나오면 재판정 사유. 단 문장에 공휴일 단어
  (`_HOLIDAY_WORDS`)가 있으면 통과.
- 집행: `scrub_weekend_closure_word()` — 재판정으로도 안 고쳐진 잔여분을 게시 직전에
  결정적으로 치환한다(4-4 단계). 공휴일 문장은 손대지 않는다. 52항과 같은 원칙 —
  감지하고도 게시하지 않는다.

---

## 59. 광고 게이트 — 앱 화면·유료 이용자에게는 광고를 부르지 않는다 (2026-08-17 신설)

**배경.** ezlong.com 은 두 경로로 소비된다. 브라우저 방문자, 그리고 Long Time, Easy Life
앱의 웹뷰. 앱은 애드몹을 쓰고 유료·구독 이용자에게는 그 광고를 끈다. 그러니 같은 사람이
앱 안에서 ezlong 페이지로 넘어왔을 때 우리 애드센스가 뜨면 **돈 낸 사람이 광고를 보는**
셈이다. 게다가 앱이 구글의 WebView API for Ads 등록을 하지 않은 상태에서 앱 웹뷰에
애드센스를 띄우면 무효 트래픽으로 잡혀 계정이 정지될 수 있다.

**구조.** 판정은 `ez-ads.js` 한 곳에서만 한다. 숨기지 않는다 — `display:none` 으로 가리는
것은 애드센스 정책 위반이고, 앱 화면에서 스크립트가 한 번이라도 뜨면 이미 늦다.
순서가 전부다: **판정 → 통과한 경우에만 스크립트 삽입 → 슬롯 활성화.**

- 스위치는 `ez-nav.js` 의 `window.EZ_ADS_LIVE` **한 곳뿐**이다. 이 값이 `ez-ads.js` 를
  내려받을지도 정하므로, 스위치를 두 곳에 두면 반드시 한쪽이 뒤처진다.
- 정책 완화 지점도 한 곳 — `ez-ads.js` 의 `WEBVIEW_ADS_REGISTERED`. 앱이 등록을
  마쳤다고 알려오면 이 값만 켠다. 그때부터 앱 안 **무료** 이용자에게만 열린다.
- 운영자 미리보기: 아무 페이지에 `?ads=preview`(끄기는 `?ads=off`). 그 브라우저에만
  30일 저장된다. 미리보기 중에도 애드센스 스크립트는 **절대 안 부르고** 점선 자리와
  판정 칩만 그린다. 실험실 페이지 `/labs-ads.html`(noindex)에서 판정을 실시간으로 본다.

**앱 화면 판별은 세 겹으로 본다.** 앱 담당이 준 계약은 localStorage `ezlong:inApp` 하나지만,
그 열쇠는 앱이 `/time/` 을 연 적이 있어야 생긴다. 딥링크 진입이나 저장소 초기화로
**열쇠 없는 앱 화면**이 만들어지고, 거기 광고가 뜨는 순간이 가장 위험하다. 그래서
`ez-nav.js` 가 이미 쓰던 판정(`embed=app`·세션 표시·네이티브 브릿지)을 함께 본다 —
`window.ezInAppWebview` 로 내보내 둘이 같은 함수를 쓴다(공유 함수 동기화 원칙).
셋 중 하나라도 걸리면 앱으로 본다. **애매하면 끈다 — 틀린 광고보다 빈 자리가 낫다.**
유료 미러 `ezlong:premium` 도 같은 방향이다. `"0"`(무료)이 확실할 때만 허용하고,
값이 없거나 이상하면 유료로 취급한다. 이 두 열쇠는 앱이 쓰고 **루트 사이트는 읽기만**
한다 — 쓰거나 지우지 않는다.

**실측으로 드러난 것과 그 처리 (2026-08-17).** 게이트를 만들다 확인했다. 아래 11개
페이지가 게시자 ID `ca-pub-2336764115275414` 로 애드센스 로더를 **아무 조건 없이**
부르고 있었다 — 앱 화면 안에서도 그대로 로드되던 상태다.
`index` / `atmr-dashboard`(한국어·영문) / `atmr-dashboard_legacy` / `board` / `post` /
`dca-simulator` / `compound-calculator` / `retirement-calculator` / `portfolio-manager` /
`tax-account-simulator`. 광고 단위(`<ins>`)는 0개였다.
**오너 판단으로 11개 전부에서 제거했다.** 지금 이 사이트가 애드센스를 부를 수 있는
경로는 `ez-ads.js` 하나뿐이고, 그 스위치는 꺼져 있다. `/ads.txt` 는 게시했다
(`google.com, pub-2336764115275414, DIRECT, f08c47fec0942fa0`).

**다시 켜는 절차는 두 줄이다.** ① 광고를 둘 페이지 머리에
`<meta name="ez-ads" content="on">` ② `ez-nav.js` 의 `EZ_ADS_LIVE = true`.
표시가 없는 페이지에는 스위치를 켜도 아무것도 붙지 않는다 — 지면이 조용히 번지는
사고를 구조가 막는다. 로더와 `goLive()` 양쪽에서 같은 표시를 확인한다.
참고: 애드센스 코드가 오래 비어 있으면 구글이 사이트를 '검토 필요'로 되돌릴 수 있고,
다시 켤 때 재심사가 붙을 수 있다. 정상 절차이며 `ads.txt` 가 소유 근거로 남는다.

**지면 원칙.** `/time/` 경로에는 절대 넣지 않는다(앱 심사 직결, 별도 관리 영역).
시계·스탠바이류 화면형, 404·빈 결과, 팝업·오버레이도 제외. 페이지당 1~2개로 시작한다.
자리 높이를 미리 잡아 본문이 밀리지 않게 하되(CLS), 광고를 안 부르는 화면에서는
자리째 접는다 — 빈 회색 상자는 독자에게 아무 값이 없다.

---

## 60. 방향 없는 재료는 채움재다 — 관망·이름 배신·금리 용어 (2026-08-17 신설, 오너 지적)

**발단.** 성동님 질문 — "'Fed 금리 인상 관망 심리 / 골드만삭스 등 Fed 금리 인상 베팅
과도 평가, 시장 금리 인상 리스크 완화' 이게 과연 긍정 재료 맞니?" 이어서 — "'베팅 과도
평가'는 부정적인 소식이고, '시장 금리 인상 리스크 완화'는 좀 이상한 조합이다."
**둘 다 맞다.** 한 재료 안에 서로 다른 결함이 네 개 겹쳐 있었다.

### 결함 1 — 관망은 재료가 아니다

관망은 시장이 방향을 못 정했다는 뜻이라 **부호가 없다.** 부호가 없으니 그때그때 빈 칸으로
간다. 저장된 카드 10장을 훑으니 같은 'Fed 관망'이 이렇게 굴러다녔다.

- 8/16 23:20 — **부정 25점** ('Fed의 관망세 유지')
- 8/17 08:20 — **부정 10점** ('Fed 금리 인상 관망 지속')
- 8/17 16:31 — **긍정 25점** ('Fed 금리 인상 관망')
- 8/17 18:20 — **긍정 25점** ('Fed 금리 인상 관망 심리')

새 사실이 생겨 부호가 뒤집힌 게 아니다. **점수를 먼저 정하고 빈 칸을 메울 무언가가
필요했을 뿐이다** — 51항 G7(점수는 고정, 이유만 교체)의 다른 얼굴이다.
관망의 **이유**는 재료가 될 수 있어도 관망 자체는 배경이다.

### 결함 2 — 이름이 내용을 배신한다

독자는 재료 **이름**을 먼저 읽고 그게 어느 칸에 있는지 본다. 긍정 칸에 '금리 인상'이라고
적혀 있으면 카드는 한눈에 거짓말을 한다. 내용이 "인상 기대 후퇴"라면 이름도
'금리 인상 기대 후퇴'로 **끝까지** 써야 한다. 55항("근거에 이름을 붙인다")의 연장선 —
이름은 내용과 같은 쪽을 가리켜야 한다.

### 결함 3 — 조사를 지워 방향이 두 갈래가 됐다

"골드만삭스 등 Fed 금리 인상 베팅 과도 평가"는 두 가지로 읽힌다.
(가) 골드만이 "시장의 인상 베팅이 과도하다"고 봤다 → 인상 가능성 낮다 → **긍정**
(나) 골드만 등이 인상에 과도하게 베팅하고 있다 → 인상 온다 → **부정**
성동님은 (나)로 읽으셨다. 정반대 두 뜻인데 문장이 어느 쪽인지 말하지 않으니 당연하다.
**34항의 명사형 개조식은 분석 본문의 문체이지, 방향이 걸린 근거 문장에서 조사를 지워도
된다는 뜻이 아니다.** 주체·대상·방향을 조사까지 붙여 끝까지 쓴다.

### 결함 4 — 금리 용어를 섞었다

정책금리(Fed)는 **인상·인하**하고, 시장금리(국채)는 **상승·하락**한다. '시장 금리 인상'은
존재하지 않는 사건이다. 그 결과 같은 카드가 긍정에서는 "시장 금리 인상 리스크 완화",
부정에서는 "미10년 국채금리 상승"이라고 했다 — 시장금리가 오른다고도 하고 안 오른다고도
한 셈이다. 덧붙여 국채금리는 **수준도 % 변화도 %**라, "국채금리 1.19% 상승"이라 쓰면
금리가 1.19%인 것으로 읽힌다(실제 4.70%). 수준과 변화를 함께 적는다.

### 코드

- **집행**(점수 박탈 → 혼조 강등, 52항 경로): `no_direction_offenders()`(관망류가 이름),
  `name_betrays_content()`(긍정 칸 매파 이름 / 부정 칸 비둘기 이름),
  `rate_term_offenders()`(시장금리에 인상·인하). 셋 다 `direction_offenders()` 에 합류.
- **재판정 사유**: `rate_on_both_sides()`(금리가 양쪽에 구분 없이),
  `collapsed_clause_violation()`(조사 없는 명사 나열).
- **결정적 교정**: `fix_yield_number()` — 글의 숫자가 실측 변화율과 일치할 때만 수준을
  붙여 '4.70%(+1.19%)' 형태로 바꾼다. 다른 숫자면 손대지 않는다.
- `direction_offenders()` 말미에 **재료 단위 병합**을 넣었다. 뒤에 붙는 검사들이 각자
  항목을 만들어 같은 재료가 혼조 칸에 두 번 들어가던 잠복 결함도 같이 닫았다.
- 프롬프트에 네 블록 추가(무방향 금지 / 이름은 내용과 같은 쪽 / 금리 용어·표기 /
  조사 지우지 말 것). **검사보다 프롬프트가 먼저다** — 안 만들면 걸릴 일도 없다.

### 데이터 처리

집행 위반이 걸린 카드 4장(8/16 23:20, 8/17 08:20·16:31·18:20)을 삭제하고 판정 이력
20건→16건으로 맞췄다. 소급해서 점수를 다시 쓰는 방법도 있었지만 **게시된 판정을 나중에
조용히 고치는 쪽이 더 나쁘다** — 52항 때와 같은 처리(틀린 카드는 지운다)를 따랐다.

---

## 61. 여러 장을 나란히 놓아야 보이는 병 — 카드 교차 감사 (2026-08-17 신설, 성동님 지시)

**발단.** 60항을 고친 뒤 성동님 말씀 — "이렇게 한번씩 에러를 분출하는구나. 언제쯤
완벽해질까?" 정직한 답은 '완벽해지지 않는다'였다. 카드는 하루 여덟 번 새 문장으로
만들어지고, 규칙은 이미 본 실패만 막는다. 새 문장은 새 방식으로 틀린다.
그래서 목표를 바꿨다 — **완벽이 아니라 '누가 먼저 발견하느냐'**. 이어진 지시:
"그 훑는 일을 코드가 하게 만들어다오."

**문제의 정체.** 검사 열다섯 개가 전부 **카드 한 장을 만드는 순간**에만 돈다.
그 순간에는 안 보이고 여러 장을 나란히 놓아야 보이는 병이 따로 있다. 8/17 사고가
정확히 그랬다 — 한 장씩 보면 넷 다 그럴듯한데, 넷을 겹쳐 놓아야 같은 'Fed 관망'이
부정 25 → 부정 10 → 긍정 25 → 긍정 25로 편을 갈아탄 게 보인다.
그날 그걸 찾은 건 코드가 아니라 사람이었다.

**원장은 git 이력이다.** `data/market-scorecard-data.json` 은 최근 10장만 들고 있지만
커밋 이력에는 게시된 모든 카드가 남아 있다(2026-06-24부터 479커밋). 57항에서 TimesFM
예측을 git 이력으로 채점하기로 한 것과 같은 발상 — **이미 있는 기록을 원장으로 쓴다.**
덕분에 60항에서 지운 카드까지 감사에는 그대로 보인다(실제로 그 넷을 다시 잡아냈다).
워크플로에 `fetch-depth: 0` 이 필수인 이유가 이것이다.

**검사 여섯 (`scripts/audit-scorecard-history.py`)**

- **C1 편 갈아타기** — 같은 주제가 36시간 안에 긍정↔부정을 오갔는가. 창 전체에서
  양쪽에 등장한 것만으로는 신호가 아니다(지정학은 사흘에 걸쳐 나아지다 나빠질 수 있다).
  **반나절 만에 바뀌는 것**이 신호다 — 그 사이 새 사실이 생겼을 리 없으니까.
- **C2 점수 고정** — 같은 총점이 7장 넘게 이어지는데 재료 구성만 계속 갈리는가
  (51항 G7의 장기판. G7은 생성 시점에 직전 몇 장만 본다).
- **C3 재탕** — 같은 재료 이름이 사흘 넘게 다섯 번 이상.
- **C4 총점 쏠림** — 특정 총점이 창의 45% 이상. 판정이 아니라 습관이라는 뜻.
- **C5 규칙 소급** — 현행 규칙을 카드에 다시 적용. **규칙 도입 이후** 카드가 걸리면
  경고(검사에 구멍이 있다는 뜻), 이전 카드가 걸리면 참고. 기준 시각은 코드의
  `RULES_SINCE` — 규칙을 크게 손볼 때 함께 올린다.
- **C6 주제 편식** — 한 카테고리가 창의 90% 이상 등장.

**주제 동일성은 문자열이 아니라 category 태그 + 낱말**로 본다. 2026-07-28에 넣어둔
고정 category(`fed_policy` 등)로 1차, 이름에서 상투어를 걷어낸 낱말 겹침으로 2차.
`AI`·`기업`·`실적` 처럼 카테고리 이름이나 다름없는 낱말은 상투어로 버린다 —
'AI CapEx 과열 우려'와 'AI 서버 수요 강세'는 둘 다 AI 얘기지만 다른 사건이다.

**이 감사는 아무것도 고치지 않는다.** 발견만 하고 `data/scorecard-audit.json` 에 남긴다.
지나간 판정을 소급해 조용히 바꾸는 쪽이 더 나쁘다(60항). 여기서 나온 패턴은
**다음 규칙의 재료**로 쓴다. 즉 이 파일은 검사가 아니라 **검사를 만드는 입력**이다.

**리포트는 짧아야 읽힌다.** 검사마다 상한을 두고(C1 4건, C2 3건 …) 중요한 것부터
싣는다. 첫 판은 상한이 없어 31건이 쏟아졌고, 그러면 아무도 안 읽는다.

**운영.** `.github/workflows/scorecard-audit.yml` 매일 KST 07:00.
화면은 `/labs-audit.html`(noindex, 메뉴 없음) — 주의 건수와 근거를 그대로 펼친다.

---

## 62. 정책금리 기대와 장기 시장금리가 따로 놀 때 (2026-08-19 신설, 성동님 제보)

**발단.** 성동님이 장중 화면과 야후 파이낸스 기사를 함께 주셨다. 화면은 반도체 학살
(SOXX -5.70%, MU -7.46%, SK하이닉스 -8.73%, ARM -6.94%, LRCX -6.19%, 나스닥 -1.12%)인데
카드는 **긍정 65 : 부정 35**였다. 기사 요지: 9월 인상 확률은 7월 말 거의 100%에서 약
3분의 1로 내려앉았는데, **30년물 국채금리는 5.09% → 5.31%로 2007년 이후 최고**다.
연준이 2024-09-18부터 기준금리를 1.75%p 내리는 동안 10년물은 약 1%p, 30년물은 약
1.3%p 올랐다 — 짐 비앙코가 말하는 '채권 자경단'이 연준의 궂은일을 대신하는 국면.

**왜 카드가 틀리나.** 우리 파이프라인은 **10년물만** 보고 있었다. 장기물을 안 보면
'진짜 금리 이야기'를 통째로 놓친다. 게다가 인상 기대 후퇴는 그 자체로는 긍정이라,
그것만 떼어 크게 실으면 카드가 시장과 정반대를 가리킨다.
**성장주·반도체를 누르는 것은 정책금리 기대가 아니라 할인율로 실제 쓰이는 장기금리다.**

**고친 것 넷**

- `MACRO_TICKERS` 에 `^TYX`(미30년 국채금리) 추가. 스냅샷에 `yield30_pct`·`yield30_level`.
  이제 프롬프트와 검사가 장기물을 본다.
- `policy_vs_market_rate()` — 정책금리 완화 기대를 긍정으로 실었는데 장기금리가
  1% 이상 오르고 있고, 그 사실을 같은 재료 안에 안 적었으면 **재판정**(체크 11).
  집행(점수 박탈)은 하지 않는다. 그 재료가 거짓은 아니고, **사실의 절반만 적은 것**이라서다.
  같은 재료 안에 '장기금리는 상승'을 밝히면 통과시킨다. 30년물이 없으면 10년물로 본다.
- 프롬프트에 같은 규칙 한 블록. 좋은 예시 문장을 그대로 박아뒀다.
- **결과 재료 필터 구멍**: 부정 35점이 '반도체 섹터 전반 약세'였다 — 원인이 아니라 결과다.
  기존 목록은 '약세 심화'만 막고 있어서 '전반 약세'로 옷을 갈아입었다.
  `'전반 약세'·'전반 강세'·'섹터 약세'·'섹터 강세'·'섹터 전반'` 추가.

**같은 날 드러난 더 큰 구멍 — 섹터 학살이 지수에 안 보인다.**
그 시각 카드를 다시 돌려보니 모델은 부정을 **35 → 70 으로 올리려 했다.** 시장을 제대로
읽은 것이다. 그런데 51항 G2(변화 상한: 새 충격 없이 30점 초과 이동 금지)가
**"새 충격 없음"** 이라며 막았다. `_gr_shock()` 이 QQQ·SPY·VIX 셋만 봤기 때문이다.

- QQQ -1.59% (문턱 2.0% 미달) · SPY -0.54% (문턱 1.5% 미달) · VIX 15.65 (+3.03%, 문턱 미달)
- 그런데 **SOXX -6.03%, MU -7.46%, SK하이닉스 -8.73%, ARM -6.94%, LRCX -6.19%**

지수만 보면 조용한 날이다. 화면은 학살이었다. 급락을 막으려고 만든 안전장치가
**진짜 급락을 막는** 쪽으로 뒤집힌 것 — 안전장치는 반드시 이 방향으로 배신한다.
`_gr_shock()` 에 SOXX 추가(문턱 4.0% — QQQ 2.0%를 SOXX 변동성 대략 두 배로 환산).

**남는 교훈 둘.**
1. 60항은 '이름이 내용을 배신하는' 문제, 이번은 **'사실의 절반만 적어 방향이 뒤집히는'**
   문제다. 둘 다 문장은 참인데 카드는 거짓이 된다. 반쪽 사실도 틀린 사실만큼 위험하다.
2. **가드레일도 정기적으로 의심해야 한다.** 51~52항의 안전장치들은 '과잉 반응'을 막으려고
   만들었는데, 그 문턱이 시장의 실제 모양과 안 맞으면 **정당한 반응까지 막는다.**
   61항 교차 감사에 '가드레일이 막은 판정' 로그를 넣는 것이 다음 후보다.

---

## 63. 결과가 아니라 원인을 — 코너의 정의를 코드에 못박다 (2026-08-25 신설, 성동님 재강조)

**지시 요지(원문 기반):** "이 코너의 의미는 주가 등락의 **원인 재료**, 향후 12시간
주가의 향방을 예상해볼 수 있는 현재 시점의 원인 재료를 분석하는 것이다. 주가가 등락한
결과는 이미 누구나 알고 있다. 현상을 묘사하지 말고 원인 분석을 해라. 노이즈가 아닌
정보 분석을. 반도체 주가가 빠진 건 결과잖아 — 그걸 부정 재료라고 말하면 순환오류거나
동어반복이다." **여러 번 강조된 지시다. 이 항이 이 코너의 헌법이다.**

**같은 카드(8/25 05:37)에서 걸린 결함 넷 — 전부 검사·집행으로 전환:**

1. **점수 칸-혼조 칸 분열.** 긍정 35점 'AI 투자 심리 유지 :: Nvidia 실적 발표 대기 속…'
   과 혼조 'Nvidia 실적 발표 대기'가 공존. 같은 주제의 판정은 하나여야 한다.
   → 체크 1 확장: 티커·사명이 점수 칸과 혼조 칸에 동시 등장하면 재판정.
   부수 발견: 검사 티커 목록에 'nvda'만 있고 'Nvidia'가 없어 못 잡고 있었다 —
   **검사는 카드가 실제로 쓰는 표기를 봐야 한다.** 영문 사명 표기 추가.
2. **심리·수급은 가격의 다른 이름이다.** '심리 유지', '관심 지속', '매수세 유입'은
   상태 묘사지 원인이 아니다. 독자의 질문은 "심리가 왜 유지되는가"다.
   → FACTOR_RESULT_ONLY에 심리·수급 상태어 14종 추가.
3. **요약의 순환 서술.** "반도체 섹터 약세로 부정 우위 지속" — 결과를 우위의 이유로
   썼다. → 체크 12: `(약세|하락|급락…)(로|으로) (긍정|부정) 우위` 패턴 재판정.
4. **혼조 재료의 한쪽 방향 주장.** 혼조 칸의 '미 국채금리 하락' 설명이 "성장주에
   긍정적"으로 끝났다(미세 변동이라 강등된 재료). 혼조는 양면이라는 뜻인데 설명이
   한쪽만 말하면 독자는 분류를 의심한다. → 체크 13: 혼조 desc가 긍정적/부정적으로
   끝나며 양면 표지(이나·지만·혼조·제한적…)가 없으면 재판정. 집행 강등 시에는
   코드가 방향 꼬리를 떼고 "방향 대비 크기·근거가 약해 판정 제외"를 붙인다.

**분류 판단 기준(성동님 질문에 대한 답):** '미 국채금리 하락 -0.72%'가 혼조에 있는 것
자체는 규칙의 의도가 맞다 — 오차 범위 움직임이라 점수를 실을 크기가 아니다(60항 G6).
잘못은 위치가 아니라 **설명**이었다 — 이유 없이 "긍정적"이라는 주장만 남아 있었다.
Nvidia 건은 분류 자체가 잘못 — 실적 발표 '대기'는 방향이 없으니 혼조가 맞고, 그걸
'심리 유지'로 이름만 바꿔 긍정 점수를 실은 쪽이 위반이다.

**프롬프트 맨 위에 '이 코너의 정의' 블록 신설** — 향후 12시간 원인 재료 / 왜에 답하라 /
심리·수급 금지 / 한 주제 한 판정 / 혼조는 양면 서술 / 요약도 원인으로.

---

## 64. 빼기보다 혼조 — 분석이 어려운 큰 축은 카드에서 지우지 않는다 (2026-08-25, 성동님 지시)

**지시 원문 요지:** "미 국채금리가 살짝 하락했지만 이것으로 충분히 긍정 재료라고 할
만하지 않다. 아직 금리 인상 흐름에 연준이 있으므로, 나라면 이걸 혼조라고 하겠다.
주식시장을 짓누르는 가장 큰 악재이니까. **분석 곤란하다고 아예 빼는 것은 오히려
문제다. 그런 것을 애매/혼조로 분류하면 되잖니.**"

**배경.** 63항 배포 후 첫 카드에서 미세 변동에 걸린 '미 국채금리 하락'이 재시도
과정에서 **통째로 사라졌다.** 재판정 사유가 "점수를 실을 크기가 아니다"로 끝나니
모델이 '빼라'로 읽은 것이다. 그런데 금리는 지금 시장의 가장 큰 축이다 — 카드에
금리가 없으면 독자는 그 축이 사라졌다고 오해한다. **강등의 목적지는 삭제가 아니라
혼조다.**

**세 겹 장치**

- 프롬프트: "빼기보다 혼조" 블록 — 큰 축(특히 금리)은 애매하면 혼조로 싣고,
  혼조 설명에는 양면(당일 움직임 + 그것을 누르는 배경)을 다 쓴다.
- 재판정 사유 문구 수정: 미세 변동 사유 끝에 "지우지 말고 혼조로 옮겨 배경을
  설명하라"를 명시 — 사유 문구는 모델에게 지시문이다. 문구가 절반이면 행동도 절반.
- 코드 보증 `ensure_rates_visible()` (4-7 단계): 그래도 카드 어디에도 금리가 없으면
  실측치만으로 혼조 재료를 만들어 넣는다("미10년 4.70%(-0.72%) · 미30년 5.28% …
  방향 판단 유보"). **판단은 지어내지 않는다** — 숫자와 유보만 쓴다. 국면 서술
  (인상기·인하기)은 코드에 박지 않는다 — 하드코딩된 국면은 언젠가 반드시 거짓말이
  된다. 그건 매 카드에서 모델의 몫이다.

**일반 원칙으로.** 앞으로 어떤 검사든 재료를 걷어낼 때 그 주제가 시장의 주요 축이면
목적지는 삭제가 아니라 혼조다. "분석 곤란"은 빼는 이유가 아니라 혼조로 분류하는
이유다.

---

## 65. 단문으로 써라 — 한 문장에 주장 하나 (2026-08-25, 성동님 지시)

**지시 원문 요지:** "말이 너무 어지럽다. 복문을 쓰지 말고 단문을 써라. 한눈에 알아보고
이해할 수 있게 해라. 니 말 해석을 하는 데 신경 쓰지 않게 해라. 쉽고 단순명료하게."

**계기.** 64항 보충 재료의 문안 — "당일 움직임은 판단을 실을 크기가 아니나, 금리 수준
자체가 성장주 할인율을 좌우하는 핵심 변수 — 방향 판단 유보". 한 문장에 세 가지를
욱여넣어 두 번 읽어야 했다. 성동님이 제시한 구조가 답이다:
**원리 → 사실(숫자) → 판정, 각각 한 문장씩.**
고친 문안: "금리는 성장주 할인율을 좌우하는 핵심 변수. 오늘 미10년 4.70%(-0.72%) ·
미30년 5.23%(-0.85%). 움직임이 작아 방향 판단은 유보."

**규칙**
- 한 문장에는 주장 하나. '~이나/~지만'으로 두 주장을 잇지 말고 끊는다.
- 순서는 원리 → 사실 → 판정. 근거 숫자는 사실 문장에 붙인다.
- 판정 기준: 한눈에 읽히면 통과, 두 번 읽게 하면 실패.
- 34항(명사형 개조식)의 하위 규칙이다 — 개조식 항목 안에서도 복문을 쓰지 않는다.

**적용 위치:** 스코어카드 프롬프트, 스윙 데스크 프롬프트 2곳(일일·새 주 전망),
`ensure_rates_visible()` 템플릿. 코드가 문장을 만들 때도 이 구조를 따른다.

---

## 66. 심층 보고서 — "아… 이런 이야기였구나" (2026-08-25 신설, 성동님 지시)

**지시 요지:** 긍정/부정 테이블 아래에 '보고서 형식으로 보기' 버튼. 누르면 A4 한 장
분량의 심층 보고서가 펼쳐진다. "현재의 분석이 너무 요약적이라서 무슨 말인지 잘 모를 때,
이 보고서를 보면 '아… 이런 이야기였구나'를 알 수 있을 정도로. 전후 사정을 알 수 있을
정도로. 너무 분량이 많으면 안 된다."

**구조**

- 생성: `desk_deep_report()` — 카드가 **확정된 뒤**(집행·교정 4-7까지 끝난 뒤) 별도
  Gemini 호출. 같이 만들면 집행이 재료를 바꿨을 때 보고서가 낡은 카드를 설명하게 된다.
  실패해도 카드는 나간다(파이프라인 불사불패).
- 다섯 부분 고정: overview(오늘 판 정리) / positive / negative / mixed / watch(향후
  12시간 체크포인트). 총 1,200~1,700자, 400자 미만·2,600자 초과는 폐기.
- 보고서에도 문장 규칙이 그대로 적용된다: 단문(65항), 근거에 이름(55항), 원인 분석
  (63항), 주말 '휴장' 금지(58항)·금리 수치 표기(60항)는 생성 후 코드로 스크럽.
- **판정 불변 원칙**: 보고서는 카드를 설명만 한다. 점수·판정을 바꾸거나 새 판정을
  만들지 않는다 — 프롬프트에 명시.
- 백필: 매 사이클, 보고서 없는 기존 카드를 최대 2장까지 채운다. 도입 이전 카드와
  생성 실패 카드를 다음 사이클이 자연 치유한다.
- 화면: `market-vs.html` 요인 2열 아래 버튼 → 접이식 문서(행간 1.75, 섹션별 좌측
  색띠). report 필드가 없으면 버튼 자체가 없다. 언어판 번역은 보류(57항 TimesFM
  카드와 같은 방침 — 형태 확정 후).

**운용 비용:** 호출당 입력 약 4천 토큰 + 출력 약 1,500토큰. Gemini 2.5 Flash 단가
기준 회당 약 $0.005, 하루 8~10회 ≈ 월 $1.5 안팎(환율 따라 약 2천 원대). 기존 카드
생성 호출과 비슷한 규모가 하나 더 도는 셈이다.

---

전체 규칙·CSS 변수·배포 체크리스트·Git 워크플로우 → **EZLONG_GUIDE.md** 참조
