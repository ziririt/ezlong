# EZLONG.COM — 작업 이력

> 각 세션 마무리마다 업데이트. 알고리즘 변경 시 반드시 복구 명령어 포함.
> git log 기반으로 자동 생성 — `git log --since="YYYY-MM-DD 00:00" --oneline --no-merges`

---

## [2026-06-17] — 최근 흐름 맥락 추가 + isMarketOpen 수정 + data/ 폴더 대청소

### 1. 최근 5거래일 등락률 컨텍스트 전면 주입 (알고리즘 수치 변경 없음)

**배경:** Gemini AI 차트분석이 "월요일 급등+화요일 급락" 같은 최근 흐름을 언급하지 않아 사용자로부터 "이 AI가 시장 상황을 알고 있는 건가?" 반응 발생.

**수정 파일 3개, 커밋: `d281988f2`**

. `scripts/fetch-market-data.py` — `process_symbol()` 반환 dict에 `recentDailyReturns` 배열 추가. `[0]=오늘, [1]=어제, [2]=2일전, ...` 순서.
. `scripts/generate-chart-analysis.js` — `callGemini()` 프롬프트에 `[최근 5거래일 일봉 변동률 — 반드시 이 흐름을 분석에 언급하라]` 섹션 삽입.
. `atmr-dashboard.html` — `#recent-context-wrap` 배너 추가. QQQ·SOXX·TSLA·NVDA 최근 2일전→어제→오늘 흐름을 상단에 표시.

복구 명령:
```bash
git show d281988f2 -- scripts/generate-chart-analysis.js | head -80
git show d281988f2 -- scripts/fetch-market-data.py | head -40
```

---

### 2. marketState 'CLOSED' 하드코딩 버그 수정

**배경:** `generate-chart-analysis.js`에서 Yahoo Finance v8 API `marketState` null 반환 시 무조건 `'CLOSED'`로 fallback → 장 중에도 "장마감" 표시됨.

**수정 파일: `generate-chart-analysis.js`, 커밋: `7473e3f55`**

추가된 함수:
```javascript
function getUSMarketState() {
  const now = new Date();
  const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const et = new Date(etStr);
  const day = et.getDay();
  if (day === 0 || day === 6) return 'CLOSED';
  const totalMin = et.getHours() * 60 + et.getMinutes();
  if (totalMin >= 240 && totalMin < 570)  return 'PRE';
  if (totalMin >= 570 && totalMin < 960)  return 'REGULAR';
  if (totalMin >= 960 && totalMin < 1200) return 'POST';
  return 'CLOSED';
}
```

---

### 3. isMarketOpen 하드코딩 제거 (fetch-market-data.py)

**배경:** `market-signals.json`의 `isMarketOpen` 필드가 항상 `false`로 기록됨.

**수정 파일: `scripts/fetch-market-data.py`, 커밋: `026b4d1d9`**

추가된 함수:
```python
def get_is_us_market_open():
    now_utc = datetime.now(timezone.utc)
    if now_utc.weekday() >= 5: return False
    offset = -4 if 3 <= now_utc.month <= 11 else -5
    et_total_min = ((now_utc.hour + offset) % 24) * 60 + now_utc.minute
    return 570 <= et_total_min < 960  # 9:30 ~ 16:00
```

`'isMarketOpen': False` → `'isMarketOpen': get_is_us_market_open()`

---

### 4. UI 말투 전환 — 스윙전략 정적 HTML 구간 (atmr-dashboard.html)

1배수·2배수·3배수 전략 섹션(line 1705~1929) 잔여 "~하세요" 표현 일괄 진단형 전환. 자동 점검 grep 결과 0줄 확인.

수정 파일: `atmr-dashboard.html`, 커밋: `026b4d1d9`

---

### 5. data/ 폴더 중복 파일 대청소 (git 미추적 로컬 파일)

**원인:** macOS Finder에서 파일 복사 시 자동 생성되는 `(1)`, `(1) 2`, ` 2`, ` 3`... suffix 파일들이 수천 개 누적됨.

**삭제 내역:**
. 공백 포함 중복 파일 7,088개 삭제 (git 미추적 — push 불필요)
. 숫자만 있는 유령 파일 8개 삭제 (PLTR 등 잘못된 파일명)
. 정리 전: 7,318개 → 정리 후: 230개

**안전성 검증:**
. `.backup/20260613_211306/` → 840개 온전
. `.backup/clean_20260613_211324/` → 14개 온전
. 핵심 파일(market-signals.json, analysis-NVDA/TSLA/QQQ.json 등) → 모두 존재 확인

재발방지: CLAUDE.md 규칙 12번 추가 — "data/ 폴더 파일 관리 규칙"

---

### 6. 모바일 "최근 흐름" 가로 넘침 수정 (atmr-dashboard.html)

**배경:** 스마트폰에서 "최근 흐름" 배너가 화면 너비를 초과해 가로로 스크롤되는 현상 발견 (스크린샷 확인). QQQ·SOXX·TSLA 칩들이 한 줄에 고정되어 flex 컨테이너가 넘쳐흐름.

**수정 내용:** `renderRecentContext()` 내 컨테이너 div에 `display:flex; flex-wrap:wrap; align-items:center; gap:4px 0;` 추가. 각 칩은 `white-space:nowrap` 유지하되 줄바꿈 가능하게 전환.

수정 파일: `atmr-dashboard.html`, 커밋: `0893cfaa2`

---

### 7. 전체 자동 업데이트 스케줄 점검 결과 (이상 없음)

. `fetch-market-data.py` — 평일 UTC 13~21시 30분 간격, 마지막 실행 2026-06-16T22:31 UTC ✓
. `generate-chart-analysis.js us` — 장중 매시 :35, QQQ/SPY/SOXX 마지막 업데이트 2026-06-16T20:00 UTC (ET 15:35 장마감 직후) ✓
. FlashAlpha 옵션·크립토·마켓사이클 — 정상 ✓
. `generate-swing-briefing.js` 별도 파일은 6월 14일 대형사고 시 소실. 기능은 `generate-chart-analysis.js us`가 흡수해 정상 서비스 중.
. `isMarketOpen` 픽스(`026b4d1d9`)는 마지막 자동 실행(22:31 UTC)보다 2분 늦게 push됨 — 오늘 US 장 오픈(UTC 13:30) 이후 첫 실행에서 `True` 반환 확인 필요.

---

## [2026-06-16] 3회차 — "~하세요" 행동 촉구 표현 전면 진단/분석형 전환

### UX 말투 원칙 수립 + 전면 적용 (알고리즘 수치 변경 없음)

**핵심 철학 명문화 — "ezlong.com은 분석/진단 리포트이지 행동 촉구 리포트가 아니다"**

배경: "지금 1차 매수 시작하세요", "즉시 전량 청산하세요" 같은 명령형 표현이 투자 결정권을 AI가 가져가는 것처럼 느껴짐. 방문자가 원하는 건 시장을 어떻게 읽는지 파악하는 것이지 지시를 받는 게 아님.

**atmr-dashboard.html 전면 수정 내역**

수정된 구역:
. act1 / act2 / act3 계열 — 배율별 "지금 행동" 라벨 전체 진단형 전환
. el1x / el2x / el3x — 보유자 실시간 동적 텍스트 전환
. masterSignal actionRec 7개 케이스 전체 교체
. buildSwingDesc title — 스윙 신호 제목 표현 전환
. buyBalls / sellBalls 힌트 텍스트 4+3 항목 전환
. dangerHints HOLD 섹션 3개 항목 전환
. lev2Label / lev3Label / lev3Sub — 레버리지 진입 조건 라벨 전환
. msText 동적 신호 텍스트 전환
. 물타기 동적 로직 진단형 전환

금지 → 허용 패턴 변환 예시:
. `지금 1차 매수 시작하세요` → `1차 진입 가능 구간`
. `즉시 전량 청산하세요` → `전량 청산 권고 — 하락 추세 확인`
. `지금 교체하세요` → `전환 검토 구간`
. `비중을 줄이세요` → `비중 축소 권고`
. `지금 사지 마세요` → `신규 매수 자제 구간`

예외 유지 항목: "아래 중 하나라도 발생하면 물타기 즉시 중단" — 경고 트리거 문구이므로 강도 유지

**CLAUDE.md — UI 말투 원칙 섹션 신규 추가**

매 세션 자동 로드되는 개발 지침(CLAUDE.md)에 "UI 텍스트 말투 원칙 — 분석/진단형 리포트" 섹션 추가.
앞으로 매 세션 자동 점검 트리거 grep 포함.

```bash
grep -n "시작하세요\|지금 사지 마세요\|즉시 교체하세요\|즉시 청산하세요\|즉시 낮추세요\|투입하세요" atmr-dashboard.html
# 결과가 0줄이어야 정상
```

수정 파일: `atmr-dashboard.html`, `CLAUDE.md`
커밋: `e244721e4 style: 행동촉구 표현 → 진단/분석형 표현 일괄 전환`

복구 명령 (말투만 변경이므로 알고리즘 복구 불필요):
```bash
git show e244721e4 -- atmr-dashboard.html | head -100   # 변경 내용 확인용
```

---

## [2026-06-16] 2회차 — 레버리지 전략 텍스트 실전화 + 물타기 로직 1/2/3배 통일

### UX·전략 텍스트 개선 (알고리즘 수치 변경 없음)

**1. 레버리지 공통 해제 기준 — "즉시 전부 파세요" → 3단계 단계적 대응으로 전면 재작성**

배경: compSell 65점은 lev3x 부분 진입을 허용하는 구간인데 같은 화면에서 "즉시 전량 매도"를 지시하는 건 논리 모순. 불장 한복판에서 무조건 전량 청산을 강요하는 방식 전면 수정.

변경 내용:
. 65~79점 — 신규 진입 멈추고 오를 때마다 조금씩 분할 익절 시작. 당장 팔 필요 없음
. 80점+ 또는 Gear 3→2 하락 — 레버리지 절반 이상 줄이고 일반 ETF로 전환
. Gear 1 전환(200일선 아래) — 레버리지 전량 정리, 일반 ETF 절반 이하, 현금 확보

수정 위치: `atmr-dashboard.html` line ~1901 공통 레버리지 해제 기준 섹션

**2. 1/2/3배수 물타기 기준 통일 — RSI 35 기준 완전 폐기**

배경: 신규 진입 OK + 불타기 OK인데 물타기만 "RSI 35 이하까지 대기"는 완전한 논리 모순. 비현실적. 배율별로 조건을 강화하는 방식으로 통일.

최종 기준:
. 1배수: compSell 65 미만 + compBuy 65 이상 + RSI 70 미만 → 물타기 가능
. 2배수: compSell 55 미만 + compBuy 70 이상 + RSI 65 이하 → 소량(20% 이내) 검토 (조건 더 엄격)
. 3배수: compSell 55 미만 + compBuy 75 이상 + RSI 60 이하 + MACD 라인 양수 4조건 충족 시만 → 10~15% 예외적 허용, 원칙적으로 비권장. 배율 낮추기 우선

수정 위치: `atmr-dashboard.html` line ~1802(2배 정적), line ~1877(3배 정적), line ~4586(1배 JS 동적)

**3. 물타기 가능 케이스에 "언제 멈출지" 출구 기준 추가**

배경: "물타기 가능"만 표시하고 출구 기준이 없으면 사용자가 무한정 물타기. "지금 가능하지만 이런 상황이 오면 즉시 멈추라"는 안내 필요.

추가 내용:
. 매도 압력 65점 돌파 — 시장이 팔자로 돌아선 것. 즉시 중단
. RSI 70 이상 — 고점 추가 매수 위험. 즉시 중단
. Gear 2 하락 — 추세 약화 시작. 즉시 중단 후 손절선 재점검

**4. 닷블릿 구조·3단계 논리 전면 재작성 (이전 세션 포함)**

. rsn1/rsn2/rsn3 전 케이스, 스윙지수 desc, AI 브리핑 주봉/일봉 텍스트 닷블릿+소제목 구조 완성
. "단기 숨고르기" 표현 전체 삭제 → "히스토그램 잠시 음전", "단기 가속도 일시 약화" 등으로 교체
. lev3x 케이스 3단계 논리 구조: ① 지금 상황 → ② 왜 진입 가능한가 → ③ 왜 전량이 아닌 절반인가
. buildNowActionHTML reason 영역 font-size 13px → 14px 수정 (14px 미만 금지 규칙)

```bash
# 이 버전 참조
git show f61f27c96:atmr-dashboard.html

# 이전 버전으로 롤백 (닷블릿 재작성 이전)
git checkout 34c8bcb1f -- atmr-dashboard.html
```

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

### 3배수 레버리지 임계값 전면 완화 ★

**compSell 기준선 대폭 완화 — 불장 초입에서 진입 가능하도록 (`atmr-dashboard.html`)**

배경: 불장 첫날 compSell=55점에서 "즉시 팔아라 / 진입 불가"가 나오는 게 말이 안 됨.
buyScore/sellScore 설계상 compSell 55점은 극초기 주의 구간이지 위험 구간이 아니다.
lev3x 조건 자체가 compSell < 55로 막혀 있어서, 55점이 되는 순간 진입 불가가 됐음.

변경 내용:

. lev3x 진입 조건: `compSell < 55` → `compSell < 70` (주의 구간에서도 진입 허용)
  - lev3xFull (5조건 완전 충족)은 compSell < 55 유지 — 최적 구간 기준 그대로

. 경계 구간 기준: 65점 → 70점 (신규 진입 금지 시작점)
. 위험 수준 기준: 75점 → 80점 (2배수 전환 권고 시작점)

최종 임계값 체계:
```
compSell < 55    : 최적 구간 — lev3xFull, 5조건 완전 충족, 적극 진입
compSell 55~69   : 주의 구간 — lev3x, 1차(50%) 부분 진입 허용, 불타기도 가능
compSell 70~79   : 경계 구간 — 신규 진입 금지, 기존 보유 유지, 불타기 자제
compSell >= 80   : 위험 수준 — 2배수 이하로 낮추세요
```

수정 위치 (7곳 동시 수정):
. lev3x/lev3xFull 조건 (line ~3966)
. lev3Label/lev3Sub (line ~4041)
. act3/rsn3 (line ~4442)
. masterSignal 임계값 (line ~4489)
. el3x.innerHTML 보유자 (line ~4535)
. li3new 신규진입 (line ~4637)
. li3fire 불타기 (line ~4651)

```bash
# 이 수정 이전 버전으로 롤백 (이전 3단계 분리 버전)
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
