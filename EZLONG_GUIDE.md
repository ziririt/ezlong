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

---

## 1. 프로젝트 구조

```
/Users/ziririt/Documents/Claude/Projects/미국주식투자자를 위한 ezlong.com/
├── index.html                  ← 메인 홈
├── ez-design.css               ← 공유 디자인 시스템 (모든 페이지가 참조)
├── EZLONG_GUIDE.md             ← 이 파일 (개발 가이드)
├── DEPLOY_CHECKLIST.md         ← 배포 전 이미지 확인 체크리스트
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

**Git 저장소:** `~/Desktop/ezlong` (→ 프로젝트 폴더 심볼릭 링크)  
**원격 저장소:** GitHub (origin/main)  
**배포 URL:** https://ezlong.com

---

## 2. 현재 서비스 페이지 목록 (nav 링크 포함 필수)

| URL | 페이지명 | nav 표시명 |
|---|---|---|
| `/` | 메인 홈 | — |
| `/atmr-dashboard.html` | 스윙 시그널 대시보드 | 스윙 시그널 |
| `/chart-analysis.html` | AI 차트분석 | AI 차트분석 |
| `/analyst-reports.html` | 핵심기업 목표주가 | 핵심기업 목표주가 |
| `/market-cycle.html` | Market Cycle Monitor | Market Cycle |
| `/dca-simulator.html` | DCA 복리 시뮬레이터 | DCA 시뮬레이터 |
| `/portfolio-manager.html` | 포트폴리오 복리 시뮬레이터 | 포트폴리오 복리 |
| `/tax-account-simulator.html` | 절세 계좌 세후 시뮬레이터 | 절세 계좌 |
| `/compound-calculator.html` | 복리 계산기 | 복리 계산기 |
| `/retirement-calculator.html` | 은퇴 목표 역산 계산기 | 은퇴 계산기 |
| `/backtest.html` | 몬테카를로 포트폴리오 시뮬레이터 | 백테스트 |
| `/risk-diagnostic.html` | 투자 행동 자가진단 | 투자성향 테스트 |
| `/auto-dca-guide.html` | 자동 적립식 매수 가이드 | DCA 가이드 |

> **새 페이지를 추가할 때:** 이 표에 행 추가 + 아래 글로벌 헤더/푸터 HTML 스니펫도 반드시 업데이트

---

## 3. 글로벌 헤더 HTML 스니펫 (copy-paste 용)

> **규칙:** 모든 페이지는 이 HTML을 `<body>` 직후에 그대로 넣는다.  
> 현재 페이지에 해당하는 `<a>` 태그에만 `class="ez-nav-svc-link active"` 추가.  
> **레이아웃:** 로고가 위, 서비스 링크가 아래 (2-row, ez-design.css의 `flex-direction: column` 적용)

```html
<nav class="ez-nav" aria-label="글로벌 네비게이션">
  <div class="ez-nav-inner">
    <a href="/" class="ez-nav-logo" aria-label="EZLONG 홈">
      <picture>
        <source srcset="logo-darkmode.png" media="(prefers-color-scheme: dark)">
        <img src="logo.png" alt="EZLONG">
      </picture>
    </a>
    <div class="ez-nav-svc-links">
      <a href="/atmr-dashboard.html"        class="ez-nav-svc-link">스윙 시그널</a>
      <a href="/chart-analysis.html"        class="ez-nav-svc-link">AI 차트분석</a>
      <a href="/analyst-reports.html"       class="ez-nav-svc-link">핵심기업 목표주가</a>
      <a href="/market-cycle.html"          class="ez-nav-svc-link">Market Cycle</a>
      <a href="/dca-simulator.html"         class="ez-nav-svc-link">DCA 시뮬레이터</a>
      <a href="/portfolio-manager.html"     class="ez-nav-svc-link">포트폴리오 복리</a>
      <a href="/tax-account-simulator.html" class="ez-nav-svc-link">절세 계좌</a>
      <a href="/compound-calculator.html"   class="ez-nav-svc-link">복리 계산기</a>
      <a href="/retirement-calculator.html" class="ez-nav-svc-link">은퇴 계산기</a>
      <a href="/backtest.html"              class="ez-nav-svc-link">백테스트</a>
      <a href="/risk-diagnostic.html"       class="ez-nav-svc-link">투자성향 테스트</a>
      <a href="/auto-dca-guide.html"        class="ez-nav-svc-link">DCA 가이드</a>
    </div>
  </div>
</nav>
```

**`en/` 서브폴더 페이지의 경우** — 경로 앞에 `../` 추가:
```html
<a href="../atmr-dashboard.html" class="ez-nav-svc-link">스윙 시그널</a>
<!-- 나머지도 동일하게 ../ 적용 -->
<img src="../logo.png" alt="EZLONG">
<source srcset="../logo-darkmode.png" ...>
```

---

## 4. 글로벌 푸터 HTML 스니펫 (copy-paste 용)

> **규칙:** 모든 페이지는 `</body>` 직전에 이 HTML을 그대로 넣는다.

```html
<footer class="ez-footer" role="contentinfo">
  <div class="ez-footer-inner">
    <div class="ez-footer-top">
      <div class="ez-footer-brand">
        <picture>
          <source srcset="logo-darkmode.png" media="(prefers-color-scheme: dark)">
          <img src="logo.png" alt="EZLONG">
        </picture>
        <p class="ez-footer-brand-desc">쉽고 안전한 장기투자 파트너<br>easy.invest.good@gmail.com</p>
      </div>
      <div class="ez-footer-books">
        <div class="ez-footer-book">
          <a href="https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=385645494&partner=friedns327"
             class="ez-footer-book-cover" target="_blank" rel="noopener">
            <img src="book01.png" alt="절대 실패하지 않는 미국 주식 ETF 투자">
          </a>
          <div class="ez-footer-book-info">
            <span class="ez-footer-book-title">절대 실패하지 않는<br>미국 주식 ETF 투자</span>
            <span class="ez-footer-book-label">종이책</span>
            <div class="ez-footer-book-btns">
              <a href="https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=385645494&partner=friedns327" class="ez-footer-book-btn" target="_blank" rel="noopener">알라딘</a>
              <a href="https://www.yes24.com/product/goods/177260453" class="ez-footer-book-btn" target="_blank" rel="noopener">예스24</a>
              <a href="https://product.kyobobook.co.kr/detail/S000219205812" class="ez-footer-book-btn" target="_blank" rel="noopener">교보문고</a>
            </div>
          </div>
        </div>
        <div class="ez-footer-book">
          <a href="https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=389499456&partner=friedns327"
             class="ez-footer-book-cover" target="_blank" rel="noopener">
            <img src="book02_trans2.png" alt="월급쟁이 투자 자동화">
          </a>
          <div class="ez-footer-book-info">
            <span class="ez-footer-book-title">월급쟁이<br>투자 자동화</span>
            <span class="ez-footer-book-label">전자책</span>
            <div class="ez-footer-book-btns">
              <a href="https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=389499456&partner=friedns327" class="ez-footer-book-btn" target="_blank" rel="noopener">알라딘</a>
              <a href="https://www.yes24.com/product/goods/185275759" class="ez-footer-book-btn" target="_blank" rel="noopener">예스24</a>
              <a href="https://ebook-product.kyobobook.co.kr/dig/epd/ebook/E000012810587" class="ez-footer-book-btn" target="_blank" rel="noopener">교보문고</a>
              <a href="https://ridibooks.com/books/6121000386" class="ez-footer-book-btn" target="_blank" rel="noopener">리디</a>
            </div>
          </div>
        </div>
      </div>
      <div class="ez-footer-links">
        <div class="ez-footer-col">
          <span class="ez-footer-col-title">서비스</span>
          <a href="atmr-dashboard.html">스윙 시그널 대시보드</a>
          <a href="chart-analysis.html">AI 차트분석</a>
          <a href="analyst-reports.html">핵심기업 목표주가</a>
          <a href="market-cycle.html">Market Cycle Monitor</a>
          <a href="dca-simulator.html">DCA 복리 시뮬레이터</a>
          <a href="portfolio-manager.html">포트폴리오 복리 시뮬레이터</a>
          <a href="tax-account-simulator.html">절세 계좌 세후 시뮬레이터</a>
          <a href="compound-calculator.html">복리 계산기</a>
          <a href="retirement-calculator.html">은퇴 목표 역산 계산기</a>
          <a href="backtest.html">몬테카를로 포트폴리오 시뮬레이터</a>
          <a href="risk-diagnostic.html">투자 행동 자가진단</a>
          <a href="auto-dca-guide.html">자동 적립식 매수 가이드</a>
        </div>
      </div>
    </div>
    <div class="ez-footer-bottom">
      © 2025 EZLONG. 이 사이트의 모든 정보는 투자 참고용이며 투자 권유가 아닙니다.<br>
      투자 결과에 대한 책임은 투자자 본인에게 있습니다.
    </div>
  </div>
</footer>
```

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

### 현재 등록된 이미지 파일 (2026-06-01 기준, 21개)
```
baseball-bg.jpg       bg-swing-preview.png  bg-swing.jpg
bg-swing.png          bg-swing.webp         book01.png
book01.webp           book02.png            book02.webp
book02_trans2.png     hero-desktop.jpg      hero-desktop.webp
hero-mobile.jpg       hero-mobile.webp      hero-swing.jpg
logo-darkmode.png     logo-darkmode.webp    logo-preview.png
logo-preview.webp     logo.png              wallstreet.png
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

### 올바른 배포 워크플로우 — 반드시 2단계로 실행

> 파일 편집이 끝난 뒤, 아래 두 덩어리를 순서대로 실행한다.  
> 1차 실행 후 결과를 확인하고 문제가 없으면 2차를 실행한다.

**1차 실행 — 동기화 및 복원**
```bash
cd ~/Desktop/ezlong && git status && git stash && git pull --rebase origin main && git stash pop && git status
```
→ 마지막 `git status`에서 편집한 파일만 modified로 표시되고 conflict가 없으면 2차 진행.

**2차 실행 — 커밋 & 배포** (`변경한파일1 변경한파일2 ...` 부분만 실제 파일명으로 교체)
```bash
cd ~/Desktop/ezlong && git add 변경한파일1 변경한파일2 && git commit -m "feat: 변경 내용 설명" && git pull --rebase origin main && git push origin main && firebase deploy --only hosting
```

> **예시** (write.html, board.html, post.html을 수정한 경우):
> ```bash
> cd ~/Desktop/ezlong && git add write.html board.html post.html && git commit -m "feat: 글 작성 페이지 개선" && git pull --rebase origin main && git push origin main && firebase deploy --only hosting
> ```

### 문제 발생 시 복구 방법

**Firebase 롤백 (가장 빠름):**
1. https://console.firebase.google.com → Hosting → Release history
2. 정상 버전 선택 → "Revert to this release"

**git으로 복구:**
```bash
git stash                          # 로컬 미커밋 변경사항 임시 저장
git pull --rebase origin main      # GitHub 최신 버전으로 복구
/opt/homebrew/bin/firebase deploy --only hosting   # 복구 배포
git stash pop                      # 내 변경사항 복원
```

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

1. `_template.html` 복사 → `새파일.html` 생성
2. 위 2번 서비스 목록 표에 행 추가
3. **글로벌 헤더** 스니펫의 `ez-nav-svc-links`에 새 링크 추가
4. **글로벌 푸터** 스니펫의 서비스 목록에 새 링크 추가
5. 기존 **모든 페이지**의 헤더/푸터에 동일하게 추가 (총 12개+ 파일)
6. `index.html` 툴 카드 그리드에 카드 추가
7. `sitemap.xml`에 URL 추가
8. 배포 + URL 확인
