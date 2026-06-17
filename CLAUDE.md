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

## Gemini API 모델 제한

- 사용 모델: **`gemini-2.5-flash-lite`** 고정
- `gemini-2.5-flash` 사용 금지 (비용 문제)
- `thinkingConfig` 사용 금지

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
{ interval: 'D', range: '6M' }   // ❌ 금지
{ interval: 'D', range: '12M' }  // ❌ 금지 (어떤 range 값이든 금지)
```

### 올바른 방법

```javascript
// interval만 단독 사용 — range 파라미터 아예 제거
{ interval: 'D' }   // ✅ 일봉 고정
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

전체 규칙·CSS 변수·배포 체크리스트·Git 워크플로우 → **EZLONG_GUIDE.md** 참조
