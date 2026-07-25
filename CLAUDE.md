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
sh ~/Documents/Claude/Projects/미국주식투자자를\ 위한\ ezlong.com/backup-before-session.sh
```

백업 완료 메시지 확인 후에만 파일 수정 시작.

### 2. Claude sandbox bash에서 git 쓰기 명령 금지

- 허용: `git log`, `git status`, `git diff` (읽기 전용)
- **금지: `git add`, `git commit`, `git push`, `git pull`, `git rebase`, `git stash`**
- 모두 유저가 터미널에서 직접 실행한다.

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

전체 규칙·CSS 변수·배포 체크리스트·Git 워크플로우 → **EZLONG_GUIDE.md** 참조
