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

### 3. pull-first 철칙

배포 순서: `git pull` → `git add [파일 명시]` → `git commit` → `git push` → `firebase deploy`
pull 없이 `firebase deploy` 절대 금지.

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

### 7. firebase deploy 누락 — 2026-06-14 교훈

**배경:** git push 후 `firebase deploy`를 실행하지 않아 라이브 서버에 구버전이 수 시간 동안 서빙됨.
유저는 캐시 문제로 오해해 몇 시간을 낭비함. Claude는 "캐시 삭제"를 반복 권유했는데 이것이 완전히 틀린 진단이었음.

**규칙:**
- git push 완료 후 반드시 `firebase deploy --only hosting` 실행을 안내한다.
- 라이브 반영 여부가 의심될 때 **가장 먼저** 확인할 것: `https://ezlong.com/ez-nav.js` 와 `https://ezlong-541a8.web.app/ez-nav.js` **둘 다** fetch해서 버전 비교.
- GitHub Actions 자동 배포는 이 프로젝트에서 신뢰하지 않는다. 항상 수동 `firebase deploy` 필수.

**버전 불일치 진단 트리 (반드시 이 순서로 확인):**

| 상황 | 원인 | 해결 |
|------|------|------|
| ezlong-541a8.web.app = 구버전 | firebase deploy 미실행 | `firebase deploy --only hosting` |
| ezlong-541a8.web.app = 신버전, ezlong.com = 구버전 | Cloudflare 등 CDN 캐시 | Cloudflare 대시보드에서 캐시 Purge |
| 둘 다 신버전인데 브라우저만 구버전 | 브라우저 캐시 | 강력새로고침 (이때만 캐시삭제 권유) |

**"캐시 삭제하라" 권유는 위 트리에서 마지막 단계에서만. 절대 첫 번째 대응으로 하지 말 것.**

### 8. 공유 함수 동기화 규칙 — 핵심 함수가 여러 파일에 존재한다

`calcBuyScore` / `calcSellScore`는 **두 파일에 동시 존재**하며, 하나만 고치면 화면에 반영되지 않는다.

| 함수 | 파일 1 (서버 계산) | 파일 2 (클라이언트 재계산) |
|------|--------------------|---------------------------|
| `calcBuyScore` | `scripts/fetch-market-data.js` | `atmr-dashboard.html` (line ~2151) |
| `calcSellScore` | `scripts/fetch-market-data.js` | `atmr-dashboard.html` (line ~2253) |

**규칙:**
- 두 함수 중 하나라도 수정 시 **반드시 두 파일 모두** 동시에 수정한다.
- 수정 전 grep으로 전체 파일 확인:
```bash
grep -rn "function calcBuyScore\|function calcSellScore" . --include="*.html" --include="*.js" | grep -v ".backup/"
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

상세 규칙·코드 예시 → **EZLONG_GUIDE.md 섹션 6 "라이트모드 가독성 절대 규칙"** 참조.

---

## 글로벌 헤더·푸터 — 핵심 규칙

모든 서비스 페이지:
- `<body>` 직후: `<script src="/ez-nav.js"></script>`
- `</body>` 직전: `<script src="/ez-footer.js"></script>`
- `<head>` 안: `<link rel="stylesheet" href="ez-design.css">`

수정 시 개별 HTML 파일 건드리지 않는다. `ez-nav.js` 또는 `ez-footer.js` 하나만 수정.

---

## Gemini API 모델 설정 (2026-06-26 4차 개정)

- **1차 모델: `gemini-2.5-flash`** — GA 정식 출시, 안정적. thinking 토큰은 parts 루프로 처리
- **폴백 모델: 없음** — v1beta에서 1.5 계열 전부 404 (`gemini-1.5-flash-latest` 포함). 대신 재시도 4회(5s→15s→45s 백오프) 적용
- **HTTP 타임아웃: 180000ms (3분)** — gemini-2.5-flash thinking 토큰이 90초 초과 가능 (2026-06-26 확인). 90s로 부족
- **maxOutputTokens: 8192** — narrative 필드 길이로 인해 4096에서 JSON 잘림 발생 확인 (2026-06-26). 반드시 8192 이상 유지
- `gemini-2.5-flash-lite` 사용 금지 — 프리뷰(불안정), 503 빈발, 매크로 논리 오류 반복 확인됨
- `gemini-2.0-flash` 사용 금지 — Google이 서비스 종료 (2026-06-26 확인)
- `gemini-1.5-flash`, `gemini-1.5-flash-latest` 사용 금지 — v1beta 404 (2026-06-26 확인)
- `thinkingConfig` 파라미터 사용 금지 — v1beta API 400 Bad Request 오류 발생 (2026-06-25 확인)
- thinking 토큰 처리: `_callWithModel` 내부에서 `p.thought` 체크로 건너뜀
- **변경 배경:** gemini-2.0-flash deprecated → gemini-2.5-flash 전환. 1.5계열 v1beta 전멸 → 폴백 제거 후 재시도 강화. thinking 토큰으로 인한 타임아웃 → 180s로 상향 (2026-06-26).

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
- **10개+ 파일은 계획 먼저.** git tag(5항) 직후 Plan 서브에이전트로 의존 순서·사이드이펙트를 뽑아 유저 승인 → 그 다음 수정.

### 재시도 상한선 (전 등급 공통)

- 같은 파일·같은 증상을 **3회** 고쳤는데도 안 되면 더 시도하지 않는다. 멈추고 시도 내역·실패 이유·다음 가설을 정리해 유저에게 보고하고 판단을 기다린다.
- 특히 "캐시 삭제" 같은 진단을 반복하기 전에 이 규칙을 먼저 적용한다. (2026-06-14 캐시 오진 사건 재발 방지)

### STATE.md는 만들지 않는다

루프 상태(진행 중·완료·에스컬레이션)는 **휘발성 Task 리스트**로 추적한다. 영구 기록은 CHANGELOG.md 하나로 단일화. 별도 STATE.md를 만들면 진실의 출처가 둘로 갈라져 사고 원인이 된다.

---

전체 규칙·CSS 변수·배포 체크리스트·Git 워크플로우 → **EZLONG_GUIDE.md** 참조
