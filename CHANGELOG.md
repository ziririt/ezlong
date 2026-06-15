# EZLONG.COM — 작업 이력

> 각 세션 마무리마다 업데이트. 알고리즘 변경 시 반드시 복구 명령어 포함.
> git log 기반으로 자동 생성 — `git log --since="YYYY-MM-DD 00:00" --oneline --no-merges`

---

## [2026-06-16] fetch-market-data.py 전면 교체 + CORS 전면 대응 + UTF-8 청크 깨짐 수정

### 알고리즘 변경 ★ (복구 시 최우선 참조)

**fetch-market-data.py — Python calcBuyScore/calcSellScore 신버전으로 전면 교체 (`dae90038c`, `4422cbcc6`)**

배경: GitHub Actions는 `.py`를 실행한다. `.js`만 수정하는 착각이 오랜 기간 지속됐다.
구버전 Python이 팩터 없는 JSON을 생성 → 클라이언트가 팩터 null로 재계산 → TSLA 48점 고착.

팩터 7종 추가 (`dae90038c`):
- `rsi5dAgo` — RSI 5일 전 값 → 모멘텀 보정 ±5pt
- `hist5dAgo` — MACD 히스토그램 5일 전 → 방향성 보정 ±3pt
- `high5d / low5d` — 최근 5일 고가/저가 → 가격 패턴 ±3pt
- `high20dExcl / low20dExcl` — 이전 20일(5일 제외) 고가/저가
- `volRatio` — 오늘 거래량 / 20일 평균 → 거래량 팩터 0~7pt
- `upDays5` — 최근 5일 중 상승일 수 → 방향성 팩터 ±4pt

closes/volumes 날짜 동기화 버그 수정 (`4422cbcc6`):
- Close NaN 행 제거 시 Volume도 같은 행 삭제 누락 → DataFrame 기반 처리로 교체

변경 파일:
- `scripts/fetch-market-data.py` — GitHub Actions 실행 파일 (핵심)
- `atmr-dashboard.html` (line ~2151, ~2253) — 클라이언트 재계산 (이미 신버전이었음)

```bash
# 팩터 7종 추가 버전 참조
git show dae90038c:scripts/fetch-market-data.py

# 날짜 동기화 수정 버전 참조
git show 4422cbcc6:scripts/fetch-market-data.py

# 이 커밋 이전으로 롤백 (팩터 없는 구버전)
git checkout dae90038c^ -- scripts/fetch-market-data.py
```

---

### 3배수 레버리지 메시지 3단계 분리

**compSell 단일 임계값(55점) → 55/65/75 3단계로 분리 (`atmr-dashboard.html`)**

기존: `compSell >= 55`이면 "즉시 팔아라 / 기다릴수록 손실 커진다" 강경 단일 메시지
수정: 매도 압력 수준별로 3단계 차등 대응

. 55점 이상(주의 구간): "현 포지션 유지 무방, 추가 매수 자제"
. 65점 이상(경계 구간): "일부 2배수 교체 검토"
. 75점 이상(위험 수준): "지금 2배수 이하로 낮추세요"

배경: 불장 첫날 급등 시 매도 압력 55점에서 "즉시 팔아라"가 나오는 것은 명백히 과한 메시지.
RSI 80 이상 장기 과열 구간과 단순 주의 구간을 동일하게 취급하는 설계 오류를 수정.

수정 위치 (3곳 모두 완료):
. `lev3Label/lev3Sub` — line ~4041
. `act3/rsn3` — line ~4434
. `el3x.innerHTML` (보유자 섹션) — line ~4520

```bash
# 이 수정 이전 버전으로 롤백
git checkout 9d4047493 -- atmr-dashboard.html
```

---

### 인프라 수정

**CORS 차단 전면 대응 — JSON 기반으로 교체 (`9d4047493`)**
- 문제: Yahoo Finance 직접 fetch가 `ezlong-541a8.web.app` 도메인에서 전면 CORS 차단
- 기존: `cardTargets = [QQQ, VOO, SOXX, TSLA, NVDA, ^VIX]` → `fetchLivePrice` → 전부 실패
- 수정: `updateLivePrices` ① 블록 안에서 `j.symbols[sym]`으로 카드 현재가 직접 채움 (VIX 포함)
- 파일: `atmr-dashboard.html`

**UTF-8 청크 깨짐 수정 (`4422cbcc6`, `9d4047493`)**
- 문제: Node.js `res.on('data', c => { data += c; })` — 한국어 3바이트 문자가 청크 경계에서 잘림
- 증상: AI 브리핑에서 `중립 → 중립` → `중��` 등으로 깨짐
- 수정: `Buffer.concat(chunks).toString('utf8')` 방식으로 전면 교체
- 파일: `scripts/generate-chart-analysis.js`, `scripts/generate-market-cycle.js`

---

## [2026-06-15] 알고리즘 추세 분석 추가 + 글로벌 푸터 가독성 전면 수정

### 알고리즘 변경 ★ (복구 시 최우선 참조)

**calcBuyScore / calcSellScore에 추세 방향 분석 3종 추가**

- RSI 추세 보정 ±5pt: `rsi5dAgo` 기준으로 과매도탈출(+5) / 과매수급등(-5) 판별
  - 핵심: `rsi5dAgo < 40 && rsiDelta > 3` → +5 (현재 rsi 기준 아님 — 이전 버그 수정됨)
- MACD 히스토그램 방향 ±3pt: `hist5dAgo` 대비 개선(+3) / 악화(-2)
- 가격 패턴 ±3pt: Higher Low(+3) / Lower High(-3) — 5일 vs 이전 20일 비교

변경 파일 (두 파일 반드시 동시 관리):
- `scripts/fetch-market-data.js` — 서버 계산
- `atmr-dashboard.html` (line ~2151, ~2253) — 클라이언트 재계산 (이 값이 화면에 표시됨)

```bash
# 이 버전 참조 (알고리즘 추가 직후)
git show 3667f601d:scripts/fetch-market-data.js

# 알고리즘 변경 이전 버전으로 롤백
git checkout 3667f601d^ -- scripts/fetch-market-data.js atmr-dashboard.html

# 현재 알고리즘 커밋
# 3667f601d — fetch-market-data.js + atmr-dashboard.html 동시 수정
```

FAQ 업데이트: atmr-dashboard.html 자주 묻는 질문에 알고리즘 3종 설명 + 이메일 링크 추가

---

### 메인페이지 작업 (대화방: ezlong 메인페이지)

**네이버 프리미엄 콘텐츠 5개 → 10개 확장**
- `f1c5d7446`, `5da344074`, `89c3cdc3c`, `79f124f8c`
- 스크래핑 개수, yml 스케줄 5회, dca-simulator 충돌 해결 포함

**글로벌 푸터·nav 라이트모드 가독성 전면 수정**
- `490e71346` — 글로벌 푸터·nav 14px 미만 폰트 전면 교정
- `dbe6b678a` — index.html 푸터 11px→14px
- `9fa91a637` — mob-toggle 13px→14px
- `e49505e0b`, `0b9fd1c49` — 다크모드 텍스트 #AEAEB2 → #F5F5F7
- `2d7d5aad7` — auto-dca-guide 인라인 푸터 CSS 교정

---

### 스윙 시그널 대시보드 작업 (대화방: 미국주식투자자를 위한 ezlong.com)

**글로벌 푸터 인라인 CSS 8개 파일 통일**
- `6125104b7` — backtest, compound-calculator, market-cycle, portfolio-manager,
  retirement-calculator, risk-diagnostic, tax-account-simulator, atmr-dashboard
- 통일 기준: 폰트 14px, 다크모드 #F5F5F7, 배경 #0A0A0A

**푸터 books 레이아웃 통일**
- `e5e54f2f3` — ez-design.css + atmr-dashboard.html flex-wrap:wrap, gap:20px/10px

**.firebaseignore 드래프트 차단**
- `3ce8534b0` — atmr-dashboard [0-9]*.html, _github-setup/ 배포 제외 추가

---

### 사고방지 시스템 강화 (docs)

**CLAUDE.md 신규 규칙**
- `91925e247` — 공유 함수 동기화 규칙, .firebaseignore 관리, 배포 전 체크리스트
- `a65c24f1c` — 배포 키워드 자동 트리거 (배포/올려/push → 체크리스트 자동 실행)

**EZLONG_GUIDE.md 신규 섹션**
- Section 0-7~0-9: 공유 함수 전수 검색, .firebaseignore 관리, 알고리즘 변경 체크리스트
- Section 13: 공유 로직 관리 대장 (동기화 파일 목록, 파라미터 전달 구조, 신규 지표 추가 체크리스트)

---

### SEO

- `dd88816e5` — sitemap.xml lastmod 전체 2026-06-15 갱신 + robots.txt 최초 git 추가

---

### 이날 배포 커밋 목록 (시간순)

```
f1c5d7446  feat: 네이버 프리미엄 콘텐츠 5개→10개
5da344074  feat: 네이버 콘텐츠 스크래핑 5개→10개
89c3cdc3c  feat: naver 누적병합 + yml pull-rebase
79f124f8c  feat: naver 10개 누적병합 + 스케줄 5회
490e71346  fix: 글로벌 푸터·nav 폰트 14px 미만 전면 수정
dbe6b678a  fix: index.html 푸터 11px→14px
9fa91a637  fix: mob-toggle 13px→14px
e49505e0b  fix: 글로벌 푸터 다크모드 #AEAEB2→#C8C8CC
0b9fd1c49  fix: 글로벌 푸터 다크모드 #F5F5F7로 강화
2d7d5aad7  fix: auto-dca-guide 푸터 CSS 교정
3667f601d  feat: calcBuyScore/SellScore 추세 분석 추가 ★
3ce8534b0  feat: .firebaseignore 드래프트 파일 배포 제외
91925e247  docs: 공유 함수 동기화 규칙 추가
6125104b7  fix: 글로벌 푸터 인라인 CSS 8개 파일 통일
a65c24f1c  docs: 배포 키워드 자동 트리거 규칙 추가
dd88816e5  seo: sitemap lastmod + robots.txt 추가
e5e54f2f3  fix: 푸터 books 레이아웃 통일
6b0f5b4ee  docs: CHANGELOG 2026-06-15 작업 이력 추가 + 마무리 트리거 규칙
```

Firebase 배포: ✅ 완료 (KST 11:56 최종 확인)

**글로벌 푸터 통일 최종 확인 (오후 세션)**
- ez-design.css firebase deploy 재실행 — 이전 배포에서 CSS 미반영된 것 수정
- Cloudflare 캐시 퍼지 완료: `/ez-design.css`, `/ez-footer.js`
- `chart-analysis.html`, `analyst-reports.html` ezlong.com에서 최종 확인 ✅
- 모든 페이지 글로벌 푸터 통일 완전 완료 ✅

안정 태그: `stable-20260615` ← **오늘 버전 기준점. 이후 문제 발생 시 이 태그로 복구**

```bash
# 태그 생성 (아래 명령 터미널에서 실행)
git tag -f "stable-20260615" && git push origin --tags
```

---

**TradingView 차트 하단 여백 버그 수정 (오후 1세션)**

- `fe5244f61` — `atmr-dashboard.html` TradingView 저작권 바 흰 여백 완전 제거
- 원인: 프레임(700px)과 위젯(700px)이 동일 높이 → `overflow:hidden`이 아무것도 클리핑 못함
- 수정: 프레임 `670px` / 위젯 `700px`으로 분리 → 하단 30px 차이로 저작권 바 클리핑
- 모바일도 동일 구조 적용: 프레임 `470px` / 위젯 `500px`
- 핵심 교훈: **`overflow:hidden`은 프레임 < 위젯일 때만 작동. 높이가 같으면 무효.**

---

**한국주식 장중/장마감 오표시 수정 (오후 2세션)**

- `defaf77cf` — `chart-analysis.html` + `scripts/generate-chart-analysis.js` 동시 수정
- 원인: Yahoo Finance v8 API가 `.KS` 종목의 `marketState`를 자주 누락 → `|| 'CLOSED'` 폴백이 항상 발동 → 장 중에도 "장마감" 표시
- 클라이언트 수정: `getKRXMarketStateNow()` 함수 추가. `.KS`/`.KQ` 종목은 브라우저 현재 시각(KST) 기준으로 KRX 장 상태를 직접 계산 (평일 09:00~15:30 KST → 장중, 그 외 → 장마감)
- 서버 수정: `generate-chart-analysis.js`에도 동일 계산 로직 추가 → JSON에도 정확한 값 저장
- 한국주식 라벨: `REGULAR` → `장중` / 미국주식 `REGULAR` → `정규장` 으로 분리
- 한계: 한국 공휴일 미처리 (~14일/년) — 허용 가능 수준
- 부가: `git merge.autoedit no` 전역 설정 → vim 무한 루프 영구 차단

```bash
# 롤백 필요 시 (차트 여백이 오히려 필요한 경우)
git checkout fe5244f61^ -- atmr-dashboard.html
```

---
