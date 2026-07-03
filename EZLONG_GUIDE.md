# EZLONG.COM 개발 가이드

> Claude는 ezlong.com 작업 시 **이 파일을 반드시 먼저 읽어야 한다.**  
> 새 페이지 생성, 기존 페이지 수정, 배포 전 체크 — 모든 작업의 기준점이다.

---

## ⚠️ 0. 안전 프로토콜 — 절대 규칙 (2026-06-14 대형사고 이후 추가)

> **배경:** 2026-06-14, HTML 파일·이미지·알고리즘 전체 유실 → 14시간 재구축.  
> 원인: 로컬 미커밋 파일이 `git pull --rebase`에 의해 5월 27일 버전으로 덮어씌워짐.  
> 이 규칙은 절대 생략 불가. 매 세션마다 반드시 준수한다.

### 0-1. 세션 시작 전 백업 먼저 (필수)

Claude가 파일 수정을 시작하기 **전에**, 유저에게 반드시 아래 확인을 요청한다:

```bash
sh ~/Documents/Claude/Projects/미국주식투자자를\ 위한\ ezlong.com/backup-before-session.sh
```

백업 완료 메시지를 확인한 뒤에만 파일 수정을 시작한다.

### 0-2. Claude는 sandbox bash에서 git 명령을 직접 실행하지 않는다

- **허용:** `git log`, `git status`, `git diff` (읽기 전용)
- **금지:** `git add`, `git commit`, `git push`, `git pull`, `git rebase`, `git stash` — 모두 유저가 터미널에서 직접 실행
- **이유:** sandbox bash의 git은 lock file·Bus error·부분 실패가 반복 발생. "Everything up-to-date"가 떠도 실제로 push 안 된 채 Firebase 배포가 실행됨.

### 0-3. git push 순서 — pull-first 철칙

GitHub Actions가 30분마다 `data/*.json`을 자동 커밋하므로 항상 충돌 가능성 있다.

```bash
git pull origin main          # 1. 먼저 최신 받기
git add [수정한 파일만]        # 2. 핵심 파일만 명시적으로 스테이징
git commit -m "..."           # 3. 커밋
git push origin main          # 4. 마지막에 push
firebase deploy --only hosting # 5. push 성공 확인 후에만 배포
```

### 0-4. 이미지·에셋은 추가 즉시 단독 커밋

```bash
git add wallstreet.png logo.png [새이미지]
git commit -m "assets: 이미지 추가"
git push origin main
```

코드 수정과 반드시 분리. 이미지가 커밋·push되지 않으면 Firebase에서 엑박 처리됨.

### 0-5. 3중 백업 시스템 현황

| 레이어 | 방식 | 위치 | 보존 기간 |
|--------|------|------|-----------|
| Layer 0 | 세션 전 수동 스크립트 | `~/Documents/ezlong-backups/session_*/` + iCloud | 10일 (자동 삭제) |
| Layer 1 | macOS launchd 매일 02:00 자동 | `~/Documents/ezlong-backups/session_*/` | 10일 (자동 삭제) |
| Layer 2 | GitHub Actions 매일 00:00 KST | git 태그 `backup/YYYY-MM-DD` + Actions Artifact | 10일 |

**복구 방법:**
```bash
# 특정 날짜 파일 1개 복구
git checkout backup/2026-06-07 -- analyst-reports.html

# 전체 복구: GitHub Actions → 해당 날짜 Artifact 다운로드

# 로컬 백업에서 복구
cp ~/Documents/ezlong-backups/session_20260614_*/analyst-reports.html \
   ~/Documents/Claude/Projects/미국주식투자자를\ 위한\ ezlong.com/
```

### 0-6. 대형 작업 전 git tag (선택이 아닌 필수)

10개 이상 파일 동시 수정 또는 핵심 알고리즘 변경 전:
```bash
git tag -f "stable-$(date +%Y%m%d)" && git push origin --tags
```

### 0-7. 공유 함수 수정 전 전수 검색 필수 (2026-06-15 추가)

**배경:** `calcBuyScore` / `calcSellScore`가 `fetch-market-data.js`(서버)와 `atmr-dashboard.html`(클라이언트) **두 곳에 동시 존재**한다.
서버 JSON의 점수값은 `atmr-dashboard.html`에서 클라이언트 재계산으로 **완전히 덮어쓰인다**.
한 곳만 고치면 화면에 반영되지 않는다 — 이 사실을 모르고 서버 파일만 수정해 화면이 바뀌지 않는 사태를 방지하기 위해 이 규칙을 추가.

**규칙:**
- 어떤 함수든 수정 전 grep으로 전체 코드베이스에서 검색한다:
```bash
grep -rn "function calcBuyScore\|function calcSellScore" . --include="*.html" --include="*.js" | grep -v ".backup/"
```
- 검색 결과의 **모든 파일을 동시에** 수정한다. 누락 파일이 있으면 배포해도 효과 없음.
- 알고리즘 변경 후 **단위 테스트**로 양쪽 결과값이 동일한지 확인한다.

### 0-8. .firebaseignore 관리 — 드래프트 파일 차단 (2026-06-15 추가)

**배경:** 숫자 버전 드래프트 파일(`atmr-dashboard 1.html` 등)이 Firebase에 배포되어 운영 서버에 불필요한 파일이 쌓였다.

**규칙:**
- 새 HTML 파일·폴더 추가 시 운영 불필요 항목은 즉시 `.firebaseignore`에 추가한다.
- 현재 적용 중인 패턴: `atmr-dashboard [0-9]*.html`, `_github-setup/`
- 배포 전 `.firebaseignore` 확인 — 누락된 드래프트 패턴 없는지 점검한다.

### 0-9. 배포 전 알고리즘 변경 체크리스트 (2026-06-15 추가)

알고리즘 수정을 포함하는 배포 시 반드시 이 순서로 진행한다:

```
[ ] 1. 백업 스크립트 실행 완료
[ ] 2. 공유 함수 grep → 동기화 누락 파일 없는지 확인
[ ] 3. .firebaseignore → 드래프트 파일 제외 패턴 확인
[ ] 4. git status → 의도치 않은 파일 포함 여부 확인
[ ] 5. git pull origin main
[ ] 6. git add [수정 파일 명시 — 절대 git add -A 금지]
[ ] 7. git commit → git push origin main
[ ] 8. firebase deploy --only hosting
[ ] 9. https://ezlong-541a8.web.app/ 에서 직접 기능 확인
```

---

## 1. 프로젝트 구조

```
/Users/ziririt/Documents/Claude/Projects/미국주식투자자를 위한 ezlong.com/
├── index.html                  ← 메인 홈
├── ez-design.css               ← 공유 디자인 시스템 (모든 페이지가 참조)
├── ez-nav.js                   ← 글로벌 헤더 공유 스크립트 ★
├── ez-footer.js                ← 글로벌 푸터 공유 스크립트 ★
├── EZLONG_GUIDE.md             ← 이 파일 (개발 가이드)
├── EZLONG_MASTER_PLAN.md       ← 종합 점검·개선 로드맵 (2026-07-02 신설)
├── _template.html              ← 새 페이지 작성용 표준 골격
├── *.html                      ← 각 서비스 페이지
├── en/                         ← 영문 버전 페이지
├── data/                       ← JSON 데이터
├── analyst-pipeline/           ← Supabase 데이터 파이프라인
└── [이미지 파일들]
```

**Firebase Hosting 배포 명령어:**
```bash
/opt/homebrew/bin/firebase deploy --only hosting
```

**Git 저장소:** 프로젝트 폴더 자체 (`~/Documents/Claude/Projects/미국주식투자자를 위한 ezlong.com`) — 구 `~/Desktop/ezlong` 경로는 2026-07-03 확인 결과 더 이상 존재하지 않음  
**원격 저장소:** GitHub (origin/main)  
**배포 URL:** https://ezlong.com

---

## 2. 현재 서비스 페이지 목록 (nav 링크 포함 필수)

| URL | 페이지명 | nav 표시명 (ez-nav.js 기준) |
|---|---|---|
| `/` | 메인 홈 | — |
| `/atmr-dashboard.html` | 스윙 시그널 대시보드 | 스윙 시그널 |
| `/market-vs.html` | 긍정 vs 부정 몇대몇 | 긍정vs부정 |
| `/chart-analysis.html` | AI 차트분석 | AI 차트분석 |
| `/analyst-reports.html` | 핵심기업 목표주가 | 목표주가 |
| `/market-cycle.html` | Market Cycle Monitor | Market Cycle |
| `/dca-simulator.html` | DCA 복리 시뮬레이터 | DCA 시뮬레이터 |
| `/portfolio-manager.html` | 포트폴리오 복리 시뮬레이터 | 포트폴리오 |
| `/tax-account-simulator.html` | 절세 계좌 세후 시뮬레이터 | 절세 계좌 |
| `/compound-calculator.html` | 복리 계산기 | 복리 계산기 |
| `/retirement-calculator.html` | 은퇴 목표 역산 계산기 | 은퇴 계산기 |
| `/backtest.html` | 몬테카를로 포트폴리오 시뮬레이터 | 백테스트 |
| `/risk-diagnostic.html` | 투자 행동 자가진단 | 투자성향 진단 |
| `/stocks.html` | 심플 주가 정보 | 심플 주가 |
| `/stock-personality-quiz.html` | MBTI 투자유형 진단 | 투자유형 진단 |
| `/auto-dca-guide.html` | 자동 적립식 매수 가이드 | 자동화 가이드 |

> 블로그형 롱테일 페이지(2026-07-02 추가, nav 미포함): tesla-monthly-dca-10years, nvda-monthly-dca-5years, aapl-vs-msft-dividend-dca, fire-retirement-4percent-rule, isa-irp-us-stock-tax-comparison
>
> **`/today-chart.html` (2026-07-04 신설, 의도적 비공개 상태):** SOXX·QQQ·SOXL·TQQQ·TSLA·NVDA 6종목을 하루 2회(KST 06:30/22:35) AI가 자동 분석하는 코너. 백엔드(`scripts/fetch-today-chart.py` + `.github/workflows/fetch-today-chart.yml`)는 정상 가동 중이나, 유저가 한동안 혼자 모니터링하고 싶다고 요청해 **ez-nav.js·ez-footer.js·index.html·sitemap.xml에는 의도적으로 링크를 넣지 않았다.** 직접 URL로만 접근 가능. 나중에 "메뉴에 추가해줘" 요청이 오면 그때 4개 파일에 링크를 추가한다 — 이 상태를 오작동이나 누락으로 착각해 임의로 nav에 추가하지 말 것.
>
> ⚠️ 이 표는 낡기 쉽다. **진실의 원천은 `ez-nav.js`의 links 배열**이다. 불일치 발견 시 이 표를 ez-nav.js에 맞춘다.

> **새 페이지를 추가할 때:** 이 표에 행 추가 + `ez-nav.js` · `ez-footer.js` 두 파일에 링크 추가 → git commit → git push (push = 자동 배포)

---

## 3. 글로벌 헤더 — ez-nav.js (2026-06-14 일원화)

> **규칙:** 모든 서비스 페이지는 `<body>` 직후에 아래 한 줄만 넣는다.  
> active 클래스는 `window.location.pathname` 기준으로 **ez-nav.js가 자동 처리**한다.  
> 수동으로 `<nav>` HTML을 작성하지 않는다.

```html
<!-- ── EZLONG 글로벌 헤더 ── -->
<script src="/ez-nav.js"></script>
```

**`<head>` 에 ez-design.css 링크가 반드시 먼저 있어야 한다:**
```html
<link rel="stylesheet" href="ez-design.css">
```

### 헤더 내용 수정 방법

nav 항목 추가/삭제/이름 변경 → **`ez-nav.js` 파일 하나만 수정** → git commit → firebase deploy  
모든 페이지에 자동 반영됨. 개별 HTML 파일은 건드리지 않는다.

```javascript
// ez-nav.js 내 links 배열 (수정 위치) — 2026-06-24 현재 15개
var links = [
  ['/atmr-dashboard.html',        '스윙 시그널',    "스윙 트레이더를 위한 '스윙 시그널'"],
  ['/market-vs.html',             '긍정vs부정',     '긍정 vs 부정 몇대몇 — 하루 5회 시황 분석'],
  ['/stocks.html',                '심플 주가',      '심플 주가 정보'],
  ['/chart-analysis.html',        'AI 차트분석',    'AI 차트 분석'],
  ['/analyst-reports.html',       '월가 목표주가',  '월가 목표주가'],
  ['/market-cycle.html',          '마켓 사이클',    '하락장 변곡점 감시'],
  ['/dca-simulator.html',         'DCA 시뮬레이터', 'DCA 복리 시뮬레이터'],
  ['/portfolio-manager.html',     'AI 포트폴리오',  '투자성향별 AI 포트폴리오'],
  ['/tax-account-simulator.html', '절세 계좌',      '절세 계좌 시뮬레이터'],
  ['/compound-calculator.html',   '복리 계산기',    '복리 계산기'],
  ['/retirement-calculator.html', '은퇴 계산기',    '은퇴목표역산 투자액 시뮬레이터'],
  ['/backtest.html',              '백테스트',       '몬테카를로 포트폴리오 백테스트'],
  ['/risk-diagnostic.html',       '투자성향 진단',  '투자성향 자가진단'],
  ['/stock-personality-quiz.html','투자유형 진단',  'MBTI로 찾는 맞춤 투자 포트폴리오'],
  ['/auto-dca-guide.html',        '자동화 가이드',  '투자 자동화 가이드']
];
```

> 라벨 길이 주의: PC 가로 스크롤 칩 메뉴이므로 항목 수 제한 없음. 모바일은 풀스크린 오버레이로 표시되어 무제한.

---

## 4. 글로벌 푸터 — ez-footer.js (2026-06-14 일원화)

> **규칙:** 모든 서비스 페이지는 `</body>` 직전에 아래 한 줄만 넣는다.  
> 수동으로 `<footer>` HTML을 작성하지 않는다.

```html
<!-- ── EZLONG 글로벌 푸터 ── -->
<script src="/ez-footer.js"></script>
```

### 푸터 내용 수정 방법

책 링크 추가/변경, 서비스 링크 추가/삭제 → **`ez-footer.js` 파일 하나만 수정** → git commit → firebase deploy  
모든 페이지에 자동 반영됨.

### 푸터 구성 (ez-footer.js 기준)

. **브랜드 영역**: EZLONG 로고 + 소개 문구  
. **책 영역**: 도서 2권 (book01.png, book02_1.png) + 구매 링크 (종이책/전자책/오디오북/구독)  
. **서비스 링크**: 12개 서비스 전체 목록  
. **하단 카피라이트**: © 2025–2026 유니아빠 & 유니엄마 · EZLONG

> 푸터 CSS는 `ez-design.css`의 `.ez-footer*` 클래스에 정의돼 있다. 인라인 CSS 추가 금지.

---

## 5. ez-design.css CSS 변수 레퍼런스

> 인라인 CSS 대신 반드시 아래 변수를 사용한다. 하드코딩 금지.

### 색상 — 배경/표면
| 변수 | 라이트 | 다크 | 용도 |
|---|---|---|---|
| `--ez-bg` | #F5F5F7 | #000000 | 페이지 배경 |
| `--ez-surface` | #FFFFFF | #1C1C1E | 카드/패널 배경 |
| `--ez-card` | #FFFFFF | #2C2C2E | 카드 배경 |
| `--ez-card2` | rgba(0,0,0,0.04) | rgba(255,255,255,0.06) | 호버/보조 배경 |

### 색상 — 테두리
| 변수 | 라이트 | 다크 |
|---|---|---|
| `--ez-border` | rgba(0,0,0,0.08) | rgba(255,255,255,0.08) |
| `--ez-border2` | rgba(0,0,0,0.05) | rgba(255,255,255,0.05) |

### 색상 — 텍스트
| 변수 | 라이트 | 다크 | 용도 |
|---|---|---|---|
| `--ez-text` | #1D1D1F | #F5F5F7 | 본문 기본 텍스트 |
| `--ez-text2` | #3C3C3E | #AEAEB2 | 보조 텍스트 |
| `--ez-text3` | #6E6E73 | #8E8E93 | 힌트/캡션 |
| `--ez-hint` | rgba(0,0,0,0.28) | rgba(255,255,255,0.30) | 플레이스홀더 |

### 색상 — 브랜드
| 변수 | 라이트 | 다크 | 용도 |
|---|---|---|---|
| `--ez-blue` | #0071E3 | #0A84FF | 주요 액션/링크 |
| `--ez-blue-dim` | rgba(0,113,227,0.10) | rgba(10,132,255,0.14) | 블루 배경 |
| `--ez-green` | #1A7F37 | #30D158 | 상승/긍정 |
| `--ez-red` | #D92A2A | #FF453A | 하락/경고 |
| `--ez-amber` | #FF9F0A | #FFD60A | 주의/중립 |

### 레이아웃·타이포·기타
| 변수 | 값 | 용도 |
|---|---|---|
| `--ez-max-w` | 1080px | 기본 콘텐츠 최대 폭 |
| `--ez-max-w-wide` | 1440px | 와이드 레이아웃 |
| `--ez-font` | -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo'... | 기본 폰트 |
| `--ez-mono` | 'SF Mono', 'Fira Code', Consolas... | 모노스페이스 |
| `--ez-r` | 12px | 기본 border-radius |
| `--ez-rs` | 8px | 소형 border-radius |
| `--ez-shadow` | ... | 기본 그림자 |
| `--ez-shadow-lg` | ... | 강조 그림자 |

---

## 6. 디자인 규칙

### 반드시 지켜야 할 것
- 모든 페이지는 `<link rel="stylesheet" href="ez-design.css">` (또는 경로 맞게) 포함
- 색상은 CSS 변수 사용, 하드코딩 금지
- 다크모드는 `@media (prefers-color-scheme: dark)` 로 자동 대응 (별도 토글 불필요)
- 모바일 뷰포트: `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">`
- iOS 줌 방지: ez-design.css에 이미 포함됨 (`input font-size: 16px !important`)

### 피해야 할 것 (반복 사고 목록)
- 회색 바탕에 회색 텍스트 → 대비 부족, 금지
- 형광 초록색 (`#00FF00` 계열) → 금지
- 브라운/황토 계열 색상 → 금지
- 인라인으로 헤더/푸터 직접 작성 → 반드시 이 가이드 스니펫 사용
- `en/` 서브폴더에서 루트 경로 사용 (`logo.png`) → `../logo.png` 사용

---

## 7. 이미지 파일 관리 규칙

### 이미지 파일 현황 확인 (수동 목록 폐지 — 2026-07-03)

> 문서에 이미지 목록을 수동 유지하는 방식은 항상 낡는다. 현황은 명령으로 확인한다:
```bash
cd ~/Desktop/ezlong && ls *.png *.jpg *.jpeg *.webp 2>/dev/null
```

### 새 이미지 추가 시 절차 (CRITICAL — 반드시 이 순서대로)
1. 사용자가 파일 업로드 → **즉시** 프로젝트 폴더로 복사 (코드 작성 전)
2. 이 파일 이미지 목록에 추가
3. HTML/CSS에서 참조하는 코드 작성
4. 배포 (`firebase deploy --only hosting`)
5. `curl -I https://ezlong.com/파일명` 으로 HTTP 200 확인
6. 200 확인 후 완료 보고

---

## 8. 배포 전/후 필수 체크리스트

**배포 전**
- [ ] **`git pull origin main` 먼저 실행했는가? ← 가장 중요. 이것 없이 deploy 절대 금지**
- [ ] HTML/CSS에서 참조하는 이미지가 프로젝트 폴더에 실제로 있는가?
- [ ] 새 이미지가 있다면 먼저 단독으로 `git add [이미지] && git commit && git push` 했는가?
- [ ] 새로 추가한 서비스가 있다면 글로벌 헤더/푸터에 링크가 추가됐는가?
- [ ] 다크모드 표시 확인했는가?
- [ ] 모바일 레이아웃 확인했는가?
- [ ] JS 문법 오류 없는가? (브라우저 콘솔 확인)

**배포 후 (반드시)**
- [ ] `firebase deploy` 성공 메시지 확인했는가?
- [ ] 브라우저에서 실제 페이지 열어서 변경 내용 확인했는가? (Cmd+Shift+R 강제 새로고침)
- [ ] **백업 실행:** `sh backup-before-session.sh` ← 배포 완료 후 항상 스냅샷 저장

**이미지 일괄 확인 명령어:**
```bash
cd '/Users/ziririt/Documents/Claude/Projects/미국주식투자자를 위한 ezlong.com'
for f in $(grep -roh "url('[^']*\.\(png\|jpg\|webp\)[^']*')" *.html *.css 2>/dev/null | grep -v http | sed "s/url('//;s/')$//"); do
  [ -f "$f" ] && echo "OK $f" || echo "MISSING $f"
done
```

---

## 9. Git 워크플로우

> ⚠️ **핵심 규칙 — 반드시 읽을 것 (2026-06-01 사고 교훈)**
>
> `firebase deploy --only hosting`은 **로컬 폴더의 모든 파일을 그대로 배포**한다.  
> GitHub Actions가 30분마다 `data/*.json` 등을 원격(remote)에 자동 커밋하므로,  
> 로컬이 remote보다 뒤처진 상태에서 배포하면 **구버전 파일이 운영 서버를 덮어쓴다.**  
> 실제로 2026-06-01에 이 실수로 ezlong.com 메인, 헤더, 푸터가 통째로 깨졌다.

### 올바른 배포 워크플로우 (2026-07-03 전면 개정 — push = 자동 배포)

> ⚠️ **구 절차 폐기:** 이전 버전의 "1차 실행: `git stash && git pull --rebase && git stash pop`"은
> **2026-06-14 대형사고의 원인 명령**이므로 절대 사용하지 않는다. CLAUDE.md 금지 목록과 동일.
>
> **배포 모델 (2026-07-03 라이브 대조로 확정):** main에 push되면 `firebase-hosting.yml`이
> 자동 배포한다. 라이브 = git 추적 파일. **push가 곧 배포다.**
> 수동 `firebase deploy`는 Actions 장애 시 비상용으로만 사용한다 — 로컬의 미추적 파일
> (드래프트·백업 등)이 함께 올라가고, 커밋 없는 수정은 다음 자동 배포가 조용히 되돌리기 때문.

**표준 절차** (`변경한파일1 변경한파일2 ...` 부분만 실제 파일명으로 교체)
```bash
cd ~/Desktop/ezlong && git status                # 0. 상태 확인 — 의도치 않은 파일 없는지
git pull origin main                             # 1. 먼저 최신 받기 (--rebase 금지)
git add 변경한파일1 변경한파일2                    # 2. 수정한 파일만 명시 (git add -A 금지)
git commit -m "feat: 변경 내용 설명"              # 3. 커밋
git push origin main                             # 4. push = 배포. 1~2분 후 라이브 확인
```

> pull에서 충돌이 나면 멈추고 충돌 파일을 확인한다. 충돌 해결 전 push 금지.
> 배포 확인: https://ezlong-541a8.web.app/ 에서 변경 내용 직접 확인 (1~2분 소요).

### 문제 발생 시 복구 방법

**Firebase 롤백 (가장 빠름):**
1. https://console.firebase.google.com → Hosting → Release history
2. 정상 버전 선택 → "Revert to this release"

**git으로 복구 (특정 파일을 원격 최신 버전으로 되돌리기):**
```bash
git fetch origin main
git checkout origin/main -- 파일명.html   # 해당 파일만 원격 버전으로 복원
git add 파일명.html && git commit -m "fix: 원격 버전 복원" && git push origin main
```
> `git pull --rebase`·`git stash` 조합은 사용하지 않는다 (2026-06-14 사고 원인).

**lock 파일 문제 시:**
```bash
rm .git/index.lock
git rebase --abort  # (필요한 경우)
```

### 절대 하면 안 되는 것
- `git reset --hard origin/main` → 작업 폴더 파일 직접 덮어써서 편집 내용 소실
- pull 없이 `firebase deploy` → 구버전 파일이 운영 서버 덮어씀
- `git add -A` 후 deploy → 의도치 않은 파일 변경까지 포함될 수 있음

---

## 10. 새 서비스 페이지 추가 시 체크리스트

1. `_template.html` 복사 → `새파일.html` 생성 (GA 스크립트가 이미 포함되어 있음)
2. **GA 스크립트 확인** — `<head>` 최상단에 반드시 포함:
   ```html
   <!-- Google tag (gtag.js) -->
   <script async src="https://www.googletagmanager.com/gtag/js?id=G-8DY4BGP444"></script>
   <script>
     window.dataLayer = window.dataLayer || [];
     function gtag(){dataLayer.push(arguments);}
     gtag('js', new Date());
     gtag('config', 'G-8DY4BGP444');
   </script>
   ```
   누락 여부 확인:
   ```bash
   grep -l "G-8DY4BGP444" 새파일.html  # 출력 없으면 누락
   ```
3. 새 HTML에 반드시 포함:
   ```html
   <link rel="stylesheet" href="ez-design.css">
   ```
   ```html
   <!-- body 직후 -->
   <!-- ── EZLONG 글로벌 헤더 ── -->
   <script src="/ez-nav.js"></script>
   ```
   ```html
   <!-- /body 직전 -->
   <!-- ── EZLONG 글로벌 푸터 ── -->
   <script src="/ez-footer.js"></script>
   ```
4. **`ez-nav.js`** 의 `links` 배열에 새 항목 추가 (URL, 짧은 라벨)
5. **`ez-footer.js`** 의 서비스 링크 목록에 새 항목 추가
6. 위 2번 서비스 목록 표에 행 추가 (이 가이드 문서)
7. `index.html` 툴 카드 그리드에 카드 추가
8. `sitemap.xml`에 URL 추가
9. SEO/AEO 메타태그 추가: title, description, canonical, OG, Twitter Card, JSON-LD
10. git commit → git push → firebase deploy + URL 확인

> **핵심:** 4·5번만 하면 기존 모든 페이지에 자동 반영. 개별 HTML 파일을 손댈 필요 없다.

> **GA 누락 전체 점검 명령 (신규 페이지 배포 전 실행):**
> ```bash
> for f in *.html; do grep -qL "G-8DY4BGP444" "$f" 2>/dev/null && echo "GA 누락: $f"; done
> ```

---

## 11. LightweightCharts 차트 크기 제어 — 확정 패턴 (2026-06-14)

`chart-analysis.html`은 TradingView의 오픈소스 **LightweightCharts v4.2.0**을 사용한다.
이 라이브러리는 캔버스 기반 렌더링을 하기 때문에, 차트 크기 제어에 고유한 규칙이 있다.

### 11-1. 차트 크기를 CSS로만 제어하면 안 되는 이유

LightweightCharts는 컨테이너 div(`#chart-main` 등)에 **inline style**로 높이를 직접 쓴다.
CSS 룰셋은 inline style에 밀리기 때문에, CSS `height: 380px`와 LightweightCharts의 내부 값이 충돌하면 항상 LightweightCharts가 이긴다.
반대로 CSS에 `!important`를 쓰면 LightweightCharts의 렌더 크기와 CSS 크기가 어긋나서 빈 공간이 생긴다.

### 11-2. 풀스크린 차트 크기 제어 — 확정 패턴

**JS로 높이를 계산해서 `applyOptions`에 넣는 방식은 쓰지 않는다.**
타이밍 문제(`requestAnimationFrame`, `getBoundingClientRect`, `clientHeight` 모두 실패)가 반복됐다.

**올바른 패턴:**

```css
/* CSS flex가 비율을 계산 */
.ca-charts.ca-fullscreen {
  display: flex;
  flex-direction: column;
  height: 100dvh;
}
.ca-charts.ca-fullscreen > .ca-chart-wrap { min-height: 0; }
.ca-charts.ca-fullscreen > .ca-chart-wrap:nth-child(1) { flex: 70; }
.ca-charts.ca-fullscreen > .ca-chart-wrap:nth-child(2) { flex: 15; }
.ca-charts.ca-fullscreen > .ca-chart-wrap:nth-child(3) { flex: 15; }

/* chart div가 flex wrap을 100% 채움 */
.ca-charts.ca-fullscreen #chart-main,
.ca-charts.ca-fullscreen #chart-rsi,
.ca-charts.ca-fullscreen #chart-macd {
  height: 100% !important;
  width: 100% !important;
}
```

```javascript
// 진입: autoSize:true로 LightweightCharts가 CSS 컨테이너를 자동 감지
mainChart.applyOptions({ autoSize: true });
rsiChart .applyOptions({ autoSize: true });
macdChart.applyOptions({ autoSize: true });

// 해제: autoSize 끄고 원래 고정 크기 복원
const _mob = window.innerWidth < 768;
mainChart.applyOptions({ autoSize: false, height: _mob ? 260 : 380 });
rsiChart .applyOptions({ autoSize: false, height: _mob ? 110 : 140 });
macdChart.applyOptions({ autoSize: false, height: _mob ? 110 : 140 });
```

**왜 이게 동작하는가:**
- CSS flex는 동기적으로 비율을 계산해서 각 wrap의 높이를 확정한다.
- `height: 100% !important`로 chart div가 wrap을 꽉 채운다.
- `autoSize: true`를 주면 LightweightCharts가 내부 ResizeObserver로 컨테이너 크기를 감지하고, JS가 개입하지 않아도 알아서 크기를 맞춘다.
- JS의 타이밍 문제(RAF, setTimeout 등) 자체가 사라진다.

### 11-3. 비율 변경 방법

비율을 바꾸고 싶으면 CSS의 `flex` 숫자만 바꾸면 된다. JS 건드릴 필요 없다.

```css
/* 예: 주가창 60%, RSI 20%, MACD 20% 로 바꾸고 싶을 때 */
.ca-charts.ca-fullscreen > .ca-chart-wrap:nth-child(1) { flex: 60; }
.ca-charts.ca-fullscreen > .ca-chart-wrap:nth-child(2) { flex: 20; }
.ca-charts.ca-fullscreen > .ca-chart-wrap:nth-child(3) { flex: 20; }
```

### 11-4. 지시 문구 (풀스크린 비율 변경)

> "chart-analysis.html 풀스크린 차트 비율을 주가창 70%, RSI 15%, MACD 15%로 바꿔줘.
> **CSS flex 방식, autoSize:true 패턴**으로."

이 한 줄이면 Claude가 즉시 올바른 방식으로 처리한다.

---

## 12. LightweightCharts 초기 표시 기간 제한 — 확정 패턴 (2026-06-14)

### 12-1. 시도했다가 실패한 방법 3가지 (절대 다시 쓰지 말 것)

LightweightCharts에서 "차트 초기 로드 시 마지막 N봉만 보여줘"를 구현할 때,
아래 방식은 **모두 동작하지 않는다.** 이유: `fitContent()` 호출 → 타임축 sync 이벤트 발동 → ResizeObserver 초기 콜백 → rightPriceScale 200ms 동기화 등이 연쇄 실행되는 과정에서 설정한 범위가 덮어씌워진다.

**실패 1 — `setVisibleRange(시간값)` + `setTimeout(0)`**
```javascript
// 동작 안 함. ResizeObserver가 먼저 fitContent를 재실행함.
setTimeout(() => {
  mainChart.timeScale().setVisibleRange({ from: fromTime, to: toTime });
}, 0);
```

**실패 2 — `setVisibleRange(시간값)` + `setTimeout(300)`**
```javascript
// 동작 안 함. subscribeVisibleTimeRangeChange sync 루프에 휩쓸림.
setTimeout(() => {
  mainChart.timeScale().setVisibleRange({ from: fromTime, to: toTime });
}, 300);
```

**실패 3 — `setVisibleLogicalRange(인덱스값)` + `setTimeout(300)`**
```javascript
// 동작 안 함. 내부 타이밍과의 충돌은 시간값/인덱스값 무관하게 동일하게 발생.
setTimeout(() => {
  mainChart.timeScale().setVisibleLogicalRange({ from: 380, to: 500 });
}, 300);
```

### 12-2. 올바른 패턴 — 데이터 슬라이스

**차트에 넘기는 `ohlcv`·`ind` 배열 자체를 잘라서 넘긴다.**
`fitContent()`가 잘린 N봉에 자동으로 맞춰지므로 범위 제한 API를 쓸 필요가 없다.

```javascript
function initCharts(ohlcv, ind, analysis) {
  // ... 차트 인스턴스 제거, DOM 요소 조회 ...
  if (!mainEl || !rsiEl || !macdEl) return;

  // ← 여기서 바로 슬라이스 (이후 모든 코드가 잘린 배열을 자동으로 사용)
  {
    const _mob = window.innerWidth < 768;
    const _keep = _mob ? 40 : 120;   // 모바일 40거래일, PC 120거래일
    if (ohlcv.length > _keep) {
      const _from = ohlcv.length - _keep;
      ohlcv = ohlcv.slice(_from);
      const _newInd = {};
      for (const [k, v] of Object.entries(ind)) {
        _newInd[k] = Array.isArray(v) ? v.slice(_from) : v;
      }
      ind = _newInd;
    }
  }

  // 이후 코드는 ohlcv, ind를 그대로 사용 — 변경 불필요
  // fitContent()가 슬라이스된 N봉에 맞게 자동 조정됨
```

**핵심 규칙:**
- `ohlcv`와 `ind` 배열을 동일한 `_from` 인덱스로 슬라이스해야 인덱스 정합이 유지된다.
- `ind` 값 중 배열이 아닌 것(숫자, 객체 등)은 그대로 통과시킨다.
- 서버사이드 pre-compute된 인디케이터 값은 전체 기간 기준으로 정확하게 계산돼 있으므로, 마지막 N개만 잘라도 값은 정확하다.

### 12-3. 지시 문구 (다음에 같은 작업 시)

> "chart-analysis.html 초기 표시 기간을 모바일 X거래일, PC Y거래일로 바꿔줘.
> **데이터 슬라이스 방식**으로."

`initCharts` 함수 진입 직후의 슬라이스 블록에서 `_keep` 값만 바꾸면 된다.

---

## 13. 공유 로직 관리 대장 — 다중 파일 동기화 규칙 (2026-06-15)

### 13-1. 배경 및 핵심 구조

`atmr-dashboard.html`은 서버가 생성한 `data/atmr-data.json`을 fetch해서 그 안의 `buyScore`/`sellScore`를 그냥 쓰지 않는다.
클라이언트 JS에서 **원시 지표값(`rsi`, `macd`, `sma5`, `closes` 등)을 다시 받아 재계산해서 덮어쓴다.**

```
fetch-market-data.js (서버)            atmr-dashboard.html (클라이언트)
  ↓ calcBuyScore() 계산                  ↓ 동일 이름의 calcBuyScore() 재계산
  ↓ JSON에 buyScore 저장                 ↓ JSON의 buyScore 무시하고 자체 계산 값 사용
  ↓ atmr-data.json 생성                  ↓ 화면에 최종 표시
```

**결론:** 서버 JSON의 `buyScore`는 로깅·히스토리 목적으로만 존재. 실제 화면은 클라이언트 재계산 값.

### 13-2. 현재 동기화 대상 파일 목록

| 함수 | 파일 | 위치 (약) | 비고 |
|------|------|-----------|------|
| `calcBuyScore` | `scripts/fetch-market-data.js` | line ~280 | 서버 실행 |
| `calcBuyScore` | `atmr-dashboard.html` | line ~2151 | 클라이언트 실행, 화면에 반영 |
| `calcSellScore` | `scripts/fetch-market-data.js` | line ~310 | 서버 실행 |
| `calcSellScore` | `atmr-dashboard.html` | line ~2253 | 클라이언트 실행, 화면에 반영 |

새 파일이 추가되면 이 목록도 업데이트한다.

### 13-3. 동기화 확인 명령

```bash
# 함수 존재 위치 전체 검색
grep -rn "function calcBuyScore\|function calcSellScore" . \
  --include="*.html" --include="*.js" | grep -v ".backup/"

# 두 파일의 파라미터 시그니처 비교
grep -A2 "function calcBuyScore" scripts/fetch-market-data.js
grep -A2 "function calcBuyScore" atmr-dashboard.html
```

### 13-4. 알고리즘 변경 시 단위 테스트 패턴

```javascript
// 수정 후 Node.js REPL 또는 브라우저 콘솔에서 확인
// 과매도탈출 시나리오: rsi5dAgo=38, rsi=55 → buyScore +5점 기대
const score = calcBuyScore({
  price: 200, sma5: 198, sma200: 180,
  rsi: 55, macd: { histogram: 0.3 },
  high52: 250, low52: 140, vix: 18,
  rsi5dAgo: 38, hist5dAgo: 0.2,
  high5d: 202, low5d: 196,
  high20dExcl: 205, low20dExcl: 190
});
console.log(score); // 기대값: 이전 스냅샷 대비 +5점
```

### 13-5. 파라미터 전달 구조 차이

서버(fetch-market-data.js)와 클라이언트(atmr-dashboard.html)는 파라미터 전달 방식이 약간 다르다:

**서버:**
```javascript
calcBuyScore({ price, sma5, sma200, rsi, macd, high52, low52, vix,
               rsi5dAgo, hist5dAgo, high5d, low5d, high20dExcl, low20dExcl })
// 각 변수를 직접 전달
```

**클라이언트 (`atmr-dashboard.html`):**
```javascript
calcBuyScore({
  price: data.price, sma5: data.sma5, sma200: data.sma200,
  rsi: data.rsi, macd: data.macd, high52: data.high52w,
  low52: data.low52w, vix: data.vix,
  rsi5dAgo: data.rsi5dAgo,       // JSON 필드에서 직접
  hist5dAgo: data.hist5dAgo,     // JSON 필드에서 직접
  high5d: data.high5d, low5d: data.low5d,
  high20dExcl: data.high20dExcl, low20dExcl: data.low20dExcl
})
// data 객체의 프로퍼티를 펼쳐서 전달
```

새 파라미터 추가 시 양쪽 전달 방식 모두 업데이트해야 한다.

### 13-6. 신규 지표 추가 시 체크리스트

새 지표를 `calcBuyScore`에 추가할 때 반드시 확인:

```
[ ] 1. fetch-market-data.js: processSymbol에서 새 지표값 계산
[ ] 2. fetch-market-data.js: obj 객체에 새 필드 추가
[ ] 3. fetch-market-data.js: calcBuyScore 파라미터 추가 + 로직 수정
[ ] 4. fetch-market-data.js: calcSellScore 동일 작업
[ ] 5. atmr-dashboard.html: calcBuyScore 파라미터 추가 + 동일 로직
[ ] 6. atmr-dashboard.html: calcSellScore 동일 작업
[ ] 7. atmr-dashboard.html: calcBuyScore 호출부 (line ~2918)에 새 필드 전달
[ ] 8. atmr-dashboard.html: calcSellScore 호출부 (line ~2919)에 새 필드 전달
[ ] 9. 단위 테스트로 양쪽 동일 결과 확인
```

### 13-7. generate-chart-analysis.js — 이미 선진화된 파일

`scripts/generate-chart-analysis.js`는 이미 `rsi5dAgo`, `volRatio`, 볼린저밴드, Higher Low/Lower High를 독자적으로 구현하고 있다.
이 파일은 AI 차트분석용 별도 파이프라인으로 `atmr-dashboard`와 공유 로직 없음.
중복 구현이 아니며, 무결하다. 건드리기 전 반드시 파일 목적 먼저 확인할 것.
