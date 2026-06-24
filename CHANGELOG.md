# EZLONG.COM — 작업 이력

> 각 세션 마무리마다 업데이트. 알고리즘 변경 시 반드시 복구 명령어 포함.
> git log 기반으로 자동 생성 — `git log --since="YYYY-MM-DD 00:00" --oneline --no-merges`

---

## [2026-06-24] 세션 2 — 긍정 vs 부정 몇대몇 페이지 신설 (14번째 툴)

### 커밋 이력 (주요 작업)

. `233a2ef47` — feat: 긍정vs부정 몇대몇 페이지 추가 (14번째 툴)

---

### 1. 신규 페이지 `market-vs.html` 제작

**목적:** 미국 주식시장 시황을 "긍정 vs 부정 몇대몇" 구도로 시각화하는 스마트폰 최적화 카드형 페이지. 스코어카드를 최신순으로 최대 10개 쌓아 표시(비엔나 소세지 스택 구조).

**특징:**
- `/data/market-scorecard-data.json` 에서 데이터 로드 (정적 JSON, 별도 API 서버 없음)
- 각 카드 상단 타임스탬프를 navy 배너로 강하게 부각 (최신 카드는 녹색 배너)
- 긍정 합계 + 부정 합계 = 100 체계, 가로 막대 그래프 비율 시각화
- 핵심 이벤트 1개 / 점수 구도 / 2열 요인 카드 구조

### 2. `data/market-scorecard-data.json` 초기 데이터 생성

2026-06-24 22:00 KST 기준 첫 항목 (긍정 42 vs 부정 58, 마이크론 실적 발표) 수동 입력.

### 3. `scripts/fetch-market-scorecard.py` 자동화 스크립트 제작

yfinance로 QQQ·SPY·TSLA·NVDA·AAPL·MSFT·GOOGL·SOXX 가격 + VIX·10Y금리·WTI·DXY·금 수집, 뉴스 헤드라인 최대 20개 수집 → Gemini `gemini-2.5-flash-lite` 분석 → JSON 앞에 prepend, 10개 초과 시 오래된 항목 자동 삭제.

**점수 합계 검증 로직 포함:** positive_total + negative_total ≠ 100이면 자동 보정.

### 4. `.github/workflows/market-scorecard.yml` 워크플로우 제작

하루 5회 자동 실행 스케줄:
- KST 07:00 (UTC 전날 22:00)
- KST 12:00 (UTC 03:00)
- KST 18:30 (UTC 09:30)
- KST 22:00 (UTC 13:00)
- KST 23:30 (UTC 14:30)

기존 워크플로우와 동일한 안전 패턴: `git add [파일 명시]` + `ff-only merge` 재시도 방식.

### 5. 글로벌 네비게이션·푸터·홈 업데이트

- `ez-nav.js`: 스윙 시그널 바로 다음 2번째에 '긍정vs부정' 삽입 (총 15개 항목)
- `ez-footer.js`: 스윙 시그널 바로 다음에 '긍정 vs 부정 몇대몇' 링크 추가
- `index.html`: 툴 카드 2번째 위치에 새 카드 추가 + 내부 푸터 링크 추가
- `EZLONG_GUIDE.md`: 서비스 목록 행 추가, ez-nav.js links 배열 최신화 (15개 항목 반영)

---

## [2026-06-24] 세션 — 스윙 시그널/전략/집중분석 시장 흐름 컨텍스트 추가 + 차트분석 안정화

### 커밋 이력 (주요 작업)

. `6b9cf5ad0` — fix: 스윙 시그널 최근 시장 급락 컨텍스트 추가 + 차트분석 Gemini 실패 시 기존 데이터 보존
. `7a50d6cb4` — fix: 스윙시그널 시장흐름 배너 1순위 배치 + 스윙전략/TSLA·NVDA 집중분석 최근 흐름 컨텍스트 추가 + Gemini 실패 시 기존 분석 보존
. `423334aaa` — fix: 스윙시그널 시장흐름 1순위 배치 + 스윙전략·TSLA·NVDA 최근흐름 컨텍스트 + Gemini실패시 기존분석 보존 + 차트분석워크플로 수동실행시 시간체크 우회

---

### 1. 스윙 시그널 탭 — "오늘의 시장 흐름 — 주의" 배너 위치 변경 (`atmr-dashboard.html`)

**문제:** QQQ -3.29%, SOXX -7.88% 급락일임에도 스윙 시그널 해설이 "72점 분할 진입 적합 구간"만 표시하고 시장 급락 맥락을 전혀 언급하지 않음. 배너가 진입 근거 **뒤(3번째)**에 위치.

**수정:** `buildRecentContextHtml()` 반환값 포맷 변경 (앞 `<br><br>` → 뒤 `<br><br>`), 세 곳의 `desc` 문자열에서 `${buildRecentContextHtml()}` 위치를 **맨 앞(1번째)**으로 이동.

**트리거 조건:** QQQ 이틀 연속 -0.5% 이상 하락, QQQ 당일 -2% 이상, SOXX 당일 -4% 이상.

### 2. 스윙 전략 탭 — 시장 흐름 컨텍스트 배너 추가 (`atmr-dashboard.html`)

**추가:** `buildStrategyContextBanner()` 함수 신규 작성 — QQQ/SOXX/TSLA/NVDA `recentDailyReturns` 기반으로 "오늘의 시장 흐름 — 전략 수립 시 반드시 고려" 배너를 전략 가이드 카드 **최상단**에 표시.

**내용:** QQQ 연속 하락, SOXX 급락, TSLA/NVDA ±3% 이상 급등락 감지 시 각각 한 줄 해설 자동 생성.

### 3. 테슬라/엔비디아 집중분석 탭 — 종목별 최근 등락 흐름 배너 추가 (`atmr-dashboard.html`)

**추가:** `stockRecentBanner` 블록 — 각 종목의 오늘/어제/2일 전 등락률을 수치로 시각화(빨강/초록). 이틀 연속 하락(-1% 이상) 또는 ±3% 이상 급등락 시 한 줄 코멘트 자동 생성.

**위치:** `msBanner`(시장 전체 맥락) 바로 아래, `king-header` 바로 위.

### 4. 차트분석 Gemini 실패 시 기존 데이터 보존 (`scripts/generate-chart-analysis.js`)

**문제:** Gemini API 실패(과부하, 타임아웃) 시 `analysis: aiResult ?? { narrative: 'AI 분석 데이터를 불러오는 중입니다.' }` 패턴으로 기존 유효 분석을 placeholder로 덮어씀. TSLA, IONQ, QLD 등 16개 종목 항상 placeholder 표시.

**수정:** IIFE 패턴으로 교체 — Gemini 실패 시 기존 JSON 파일을 읽어 `narrative`가 placeholder가 아니고 30자 이상이면 기존 분석 보존. 신규 종목(기존 파일 없음)은 기존대로 placeholder 사용.

### 5. 차트분석 워크플로 수동 실행 시 시간 체크 우회 (`.github/workflows/fetch-us-chart-analysis.yml`)

**문제:** `workflow_dispatch`(수동 실행)임에도 ET 시간 체크(09:30~16:00)에 막혀 장 외 시간에 수동 실행 불가. "장 외 시간 — 건너뜀 (ET 1852)" 메시지 후 skip.

**수정:** `if [ "${{ github.event_name }}" = "workflow_dispatch" ]` 조건 추가 — 수동 실행 시 시간 체크 완전 우회, 강제 실행. cron 스케줄은 기존 ET 시간 체크 그대로 유지.

**추가 수정:** Step 5의 `git pull --rebase origin main` 을 Rule 16 확정 패턴 `git push origin main || (git fetch origin main && git merge --ff-only origin/main && git push origin main)` 으로 교체.

---

## [2026-06-23] 세션 — 데이터 파이프라인 완전 정상화 + Firebase 자동 배포 구조 확립

### 커밋 이력 (주요 작업)

. `8c1a5ce1c` — ci: Firebase deploy를 서비스 계정 방식으로 교체 (FIREBASE_TOKEN → service account)
. `1fc303dc1` — fix: 인덱스 카드 ETF 프록시 changePct 우선 적용 (price=null 폴백 제거)
. `6f988fb8b` — fix: get_intraday_date() 미국 공휴일 소급 처리 추가 (Juneteenth 버그)
. `bcaba9666` — ci: GitHub Actions에 Firebase 자동 배포 추가

---

### 1. Firebase 자동 배포 구조 확립

**문제:** `fetch-stocks-prices.yml`이 10분마다 데이터를 GitHub에 push했지만, `firebase-hosting.yml`은 GitHub bot push를 트리거로 인식하지 않아 라이브 서버에 반영 안 됨. (GitHub 보안 정책)

**해결:** `fetch-stocks-prices.yml`과 `fetch-stocks-data.yml` 모두 Firebase deploy step에 `FirebaseExtended/action-hosting-deploy@v0` (서비스 계정 방식) 추가. 데이터 변경 시 commit → push → Firebase 자동 배포 체인 완성.

### 2. 미국 공휴일 소급 처리 버그 수정 (`scripts/fetch-stocks-prices.py`)

**문제:** `get_intraday_date()`가 주말만 소급하고 공휴일은 처리 못 함. 6/22(월) 프리마켓 실행 시 6/19(Juneteenth 공휴일)를 대상 날짜로 잡아 `0/284 종목 데이터 확보`.

**수정:** 2025~2027 NYSE 공휴일 목록 추가, 소급 최대 7일로 확장.

### 3. 인덱스 카드 등락률 버그 수정 (`stocks.html`)

**문제:** ETF 프록시 방식(`price=null`)일 때 `changePct`도 stocks-data.json(어제 종가 기준)으로 폴백해 어제 등락률이 표시됨.

**수정:** `price != null` 조건 제거 → ETF 프록시 `changePct` 오늘 실시간값 우선 적용.

### 잔여 과제

. GitHub Actions 10분 cron 신뢰성 문제 — cron-job.org → `workflow_dispatch` API 방식으로 보완 예정
. 스파클라인 베이스라인 정책 — `dayOpen`(시초가) 기준 확정 필요 (현재 `closes[0]` 폴백 사용 중)

---

## [2026-06-19] 3차 세션 — periodPrices 3M+ 버그 수정 + US_TOP100 시총 순위 업데이트

### 커밋 이력 (주요 작업)

. `a85f110f0` — fix: periodPrices 3M+ 0% 버그 — pandas Timestamp 비교로 교체
. `560ba7f6f` — data: US_TOP100 시총 순위 업데이트 (2026-06-18 CSV 기준, 101~200위 가격추적 추가)

---

### 1. periodPrices 3M+ 0% 버그 수정 (`scripts/fetch-stocks-data.py`)

디테일 페이지에서 1M 수익률은 오차 있고, 3M 이상은 전부 0%로 표시되던 버그.

**원인:** `pandas DatetimeIndex.astype('int64')`가 timezone-aware 인덱스에서 정상 동작하지 않아, `cutoff` 이전 데이터 슬라이스가 항상 비어 현재가를 그대로 반환.

**수정 내용:**
```python
# 이전 (버그)
idx_ts = idx5y.astype('int64') // 10 ** 9
mask = idx_ts <= int(cutoff_ts)

# 수정 후
idx_utc = idx5y.tz_convert('UTC').tz_localize(None)
cutoff = pd.Timestamp(now - timedelta(days=days_ago)).tz_localize(None)
mask = idx_utc <= cutoff
```

**검증:** NVDA periodPrices = `{'5d':200.42, '1m':222.06, 'ytd':184.63, '3m':172.5, '6m':180.77, '1y':143.66, '2y':126.36, '3y':42.13, '5y':18.57}` — 정상 확인.

**복구 방법:**
```bash
git revert a85f110f0  # periodPrices fix 롤백
```

---

### 2. US_TOP100 시총 순위 업데이트 (us-stock-top200.csv 기준)

**`fetch-stocks-data.py`** — 1~100위 정렬 교체. 주요 변경:
. 이전: NVDA·AAPL·MSFT·GOOGL 순 → 현재: NVDA·GOOGL·AAPL·MSFT 순
. 신규 진입: MU(10위), INTC(18위), SNDK(42위), GEV(44위), DELL(47위), WFC(49위), MRVL(50위), WDC(53위), STX(54위), ANET(59위), APH(62위), IBKR(75위), WELL(86위), UBER(88위), SHOP(90위), COF(98위)
. 제외: ADBE, ACN, INTU, NOW, REGN, SYK, BSX, EOG, PGR, ADP, UPS, ICE, CME, CI, BMY, ZTS, ELV, WM, MMC, TSM

**`fetch-stocks-prices.py`** — 101~200위 가격 추적 추가. `US_TOP100` 변수를 200개로 확장. 10분마다 `stocks-prices.json`에 현재가·등락률 수집.

---

## [2026-06-18] 2차 세션 — 프리/포스트마켓 등락률 + 스파클라인 전체 세션 + SPCX 버그 수정

### 커밋 이력 (주요 작업)

. `c80d0e804` — fix: 프리마켓 구간 Yahoo 호출 완전 제거 — Massive 봉 전용
. `07b24cfc3` — fix: 프리마켓 ext를 Massive API 오늘 봉으로 교체 — Yahoo 의존 제거
. `394c3a78f` — fix: 프리마켓 시간대 Yahoo 강제 실행 + day_close_ref 인트라데이 봉에서 추출
. `c31aa2c65` — feat: 포스트/프리마켓 등락률 목록 상시 표시 — 인트라데이 봉+타임스탬프 기반
. `b8ecacd63` — fix: SPCX changePct 0% 버그 — day.c/prevDay.c로 재계산, live.price>0 폴백
. `777ceeeb7` — fix: live.price > 0 체크 — Massive API price=0 폴백 버그 수정
. `4df6847c6` — fix: 심야 price=0 버그 — prevDay.c 폴백 추가
. `d6c923f35` — feat: 스파클라인 전체 세션(프리+정규+포스트) + dayOpen 베이스라인
. `bf2e84120` — fix: 인트라데이 스파클라인 RTH만 필터링 (장외시간 제거)
. `dab2b0cc4` — feat: 스파클라인 인트라데이 5분봉으로 교체 (Massive API aggregates)

---

### 1. 프리/포스트마켓 등락률 목록 상시 표시 (`stocks.html`)

종목 목록 우측에 정규장 등락률 밑에 확장시간 등락률 추가 표시.

. 프리마켓: ☀ 아이콘 + 초록/빨강 등락률
. 포스트마켓: ☽ 아이콘 + 초록/빨강 등락률
. `extPct != null && extSes` 조건 충족 시에만 표시

---

### 2. 프리마켓 데이터 소스 확정 — Massive API 5분봉

**핵심 발견:** Massive API 스냅샷의 `preMarket.c`는 항상 None. 5분봉 aggregates 엔드포인트만 프리마켓 데이터를 제공.

**최종 구조 (`fetch-stocks-prices.py`):**

```python
# 프리마켓(ET 4AM~9:30AM): 오늘 날짜 5분봉 별도 수집
if is_premarket:
    today_str = now_et.date().strftime('%Y-%m-%d')
    today_intraday, _ = fetch_intraday_all(symbols, today_str, KEY)
    # last bar = 프리마켓 현재가 (15분 지연)
    # prev_close_ref = prevDay.c 또는 어제 정규장 마지막 봉
    # extPct = (last_pre_c - prev_close_ref) / prev_close_ref * 100
```

**Yahoo Finance 완전 제거 (프리마켓):**
. 프리마켓 시간대엔 `is_premarket` 조건으로 Yahoo 호출 차단
. Yahoo는 포스트마켓/overnight 80% 미만일 때만 보완용으로 잔존

**복구 방법 (문제 발생 시):**
```bash
git revert c80d0e804  # Yahoo 제거 롤백
git revert 07b24cfc3  # 5분봉 기반 롤백
```

---

### 3. SPCX changePct 0% 버그 수정

Massive API가 SPCX의 `todaysChangePerc`를 0으로 반환하는 버그. `day.c`와 `prevDay.c`로 직접 재계산.

```python
if change_pct == 0 and day_close and prev_close:
    computed = (day_close - prev_close) / prev_close * 100
    if abs(computed) > 0.01:
        change_pct = computed
```

---

### 4. 스파클라인 전체 세션 + dayOpen 베이스라인

. 5분봉 인트라데이 전체(프리+정규+포스트) 스파클라인 표시
. `dayOpen`(정규장 시가)을 베이스라인으로 초록/빨강 분기
. `live.price > 0` 체크로 price=0 폴백 버그 수정 (5곳)

---

### 5. 신규 확정 사항 (CLAUDE.md 규칙 17 보완)

. Massive API snapshot `preMarket.c` = **항상 None** — 절대 이걸로 프리마켓 데이터 기대하지 말 것
. 프리마켓 데이터 소스: `/v2/aggs/ticker/{sym}/range/5/minute/{today}/{today}`
. 스냅샷의 `preMarket` 객체 자체가 None으로 옴 (`preMarket=None` 확인)

---

## [2026-06-18] 1차 세션 — Massive API 실시간 주가 연동 + stocks.html 차트 개선

### 커밋 이력 (주요 작업)

. `154661be9` — fetch+reset 충돌 해결 + 포트폴리오 ID 레이블 변경
. `67c26e503` — fetch+reset 방식으로 push 충돌 완전 해결
. `4a4414c41` — 실시간 주가 UI + 확장시간 표시 + nav/footer 업데이트
. `0c77e4160` — shallow clone 충돌 제거, pull --rebase 제거
. `5dd0a3a6e` — Massive API 실시간 가격 + 확장시간(프리/포스트/나이트마켓) 표시
. `22913a33b` — 1D 차트 15분봉·오늘 세션·프리포스트마켓 적용
. `d24224dd6` — fetch-stocks-prices.yml 주석 제거

---

### 1. 신규 파일: `scripts/fetch-stocks-prices.py`

Massive API (구 Polygon.io) 를 호출해 220개 종목 현재가·등락률·확장시간 데이터를 `data/stocks-prices.json`에 저장. stdlib만 사용, yfinance 불필요. 배치 200개씩 API 호출.

출력 필드: `price`, `change`, `changePct`, `extPrice`, `extPct`, `extSession`('pre'|'post'|null)

확장시간 로직:
. postMarket.c → day.c 대비 등락률 → session='post'
. preMarket.c → prevDay.c 대비 등락률 → session='pre'
. 차이가 0.001 미만이면 None 처리

---

### 2. 신규 파일: `.github/workflows/fetch-stocks-prices.yml`

GitHub Actions 스케줄: 월~금 장중(ET 3am~6pm) + 포스트/나이트마켓(ET 7pm~11:50pm) 10분 간격 실행.

**핵심 수정 이력 — 반복 실패 5회 끝에 확정된 git 커밋 패턴:**

```bash
# ❌ 실패 패턴 — unstaged 파일이 있으면 rebase 즉시 실패
git pull --rebase origin main

# ✅ 확정 패턴 (untracked 파일은 reset --hard로 삭제되지 않음)
git fetch origin main
git reset --hard origin/main
git add data/stocks-prices.json
git commit -m "data: ..."
git push origin main
```

→ CLAUDE.md 규칙 16 추가

---

### 3. `stocks.html` — 이중 JSON 아키텍처 + 확장시간 UI

**이중 JSON 구조:**
. `stocks-data.json` — 1일 1회, 스파크라인+종목명
. `stocks-prices.json` — 10분마다, 현재가+등락률+확장시간

**확장시간 표시 (야후 파이낸스 동일 구조):**
. 종가 + 정규장 등락률 (기존)
. ☽ / ☀ 아이콘 + 포스트/프리마켓 등락률 (신규)

**기타 변경:**
. `나의 ID` → `동기화를 위한 나의 ID` 버튼 레이블 변경
. 타임스탬프: `주가 HH:MM KST · 15분마다 업데이트`

---

### 4. 보안 확인 — API 키 미노출 검증

```bash
grep -rn "MASSIVE_API_KEY\|massive\.com.*apiKey" *.html *.js # 결과 0 확인
```

MASSIVE_API_KEY는 GitHub Secret에만 저장. 클라이언트 코드 완전 미노출.

---

### 5. 신규 규칙 (CLAUDE.md)

. 규칙 16 — GitHub Actions git 커밋 패턴 (pull--rebase 절대 금지)
. 규칙 17 — Massive API 보안 규칙 및 이중 JSON 아키텍처

---

### 6. [당일 추가] stocks.html 차트 개선 (2026-06-18 후속)

. **1D 15분봉 수정** — `range:'1D'` 제거: TradingView가 `interval:'15'`를 `range:'1D'`와 함께 쓰면 1분봉으로 강제 변경하는 것 확인. range 완전 제거로 15분봉 확정.
. **시간대 KST 변경** — `timezone: 'America/New_York'` → `timezone: 'Asia/Seoul'`
. **이평선 개편** — 50/100/200일 → 10/50/100일, 색상 부여: 10일=파랑(#3B82F6), 50일=보라(#8B5CF6), 100일=회색(#9CA3AF)
. CLAUDE.md 규칙 13 보강 — `interval:'15' + range:'1D'`도 금지 목록에 추가

**복구 명령 (이평선 이전 버전으로):**
```bash
git revert HEAD  # 또는
git checkout <이전 커밋 SHA> -- stocks.html
```

---

## [2026-06-17] — chart-analysis.html 모노스페이스 폰트 전면 제거 + CLAUDE.md 규칙 15 추가

### 커밋: `417c3a51c`

**수정 파일: `chart-analysis.html`, `CLAUDE.md`**

---

### 1. chart-analysis.html — --ez-mono 폰트 전면 제거 (2시간 소요 누락 사고)

**문제:** 티커 가격·등락률·매수점수·타겟가·지표 등 7개 CSS 클래스에 `font-family: var(--ez-mono)` 잔존. `--ez-mono = 'SF Mono', 'Fira Code', Consolas, 'Courier New', monospace` — 얇고 가독성 없는 코드 전용 폰트. `atmr-dashboard.html`만 수정하고 `chart-analysis.html` 누락.

**수정된 CSS 클래스 7개:**

. `.ca-ticker-price` — `font-family: var(--ez-mono)` 제거
. `.ca-ticker-chg` — `font-family: var(--ez-mono)` 제거
. `.ca-ph-price` — `font-family: var(--ez-mono)` 제거
. `.ca-ph-change` — `font-family: var(--ez-mono)` 제거
. `.ca-ph-52-labels` — `font-family: var(--ez-mono)` 제거
. `.ca-ind-cell-sub` — `font-family: var(--ez-mono)` 제거
. `.ca-buy-score-num` — `font-family: var(--ez-mono)` 제거
. `.ca-target-cell-val` — `font-family: var(--ez-mono)` 제거 + 모바일 `font-size: 13px` → `14px` 수정

**결과:** 모든 가격·수치 텍스트가 시스템 기본 폰트(`-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo'`) 상속.

---

### 2. CLAUDE.md 규칙 15 추가 — --ez-mono 가격 표시 금지

재발 방지를 위해 규칙 15 추가. 폰트 관련 배포 전 grep 점검 명령 포함:
```bash
grep -rn "font-family.*ez-mono\|font-family.*SF Mono\|font-variant-numeric" *.html | grep -v "//\|/\*"
```

---

## [2026-06-17] — TradingView 일봉 강제 수정 + 폰트 14px 미만 전면 제거 + 규칙 명문화

### 커밋: `bb2bfbfec`

**수정 파일: `atmr-dashboard.html`, `CLAUDE.md`**

---

### 1. TradingView 차트 2시간봉 → 일봉 복구 (root cause 확정, 2회차 재발)

**문제:** PC·모바일 모두 일봉(`interval:'D'`)이 아닌 2시간봉(2h)으로 차트가 표시됨. 직전 세션에서 `range:'6M'`을 추가했는데, 이것이 원인이었다.

**Root cause:** TradingView `embed-widget-advanced-chart.js`에서 `range` 파라미터를 지정하면 `interval` 파라미터를 무시하고 해당 range에 최적화된 interval을 자동 선택한다. `range:'6M'` → 2h 자동 선택.

**수정 내용 (`loadTVChart` 함수):**

. `range: '6M'` 파라미터 완전 제거 — interval과 range 동시 사용 영구 금지
. 위젯 생성 전 TradingView localStorage 키(`tv.*`, `chartWidget*`, `*tradingview*`) 전체 클리어 — 사용자가 이전에 수동으로 선택한 interval 캐시 무효화
. 우리 앱 키(`atmr_cache_v7`, `ezlong_alpha_history_v2`)는 클리어 대상 아님 (패턴 비매칭 확인)

**복구 방법 (이 수정을 되돌려야 할 경우):**
```bash
# range 파라미터를 원래대로 추가하는 것은 2시간봉 버그를 다시 유발하므로 하지 말 것
# 만약 초기 기간 제어가 필요하면 interval:'D'만 유지하고 range 없이 운영
git show bb2bfbfec -- atmr-dashboard.html | grep -A 30 "loadTVChart"
```

---

### 2. 폰트 14px 미만 전면 제거 (반복 지적 사항 일괄 해결)

**문제:** `font-size:13px`, `font-size:11px` 인라인 스타일이 JS 생성 HTML과 CSS 클래스 곳곳에 잔존. 가격·변동률 표시가 시스템 기본 폰트보다 얇고 작아 가독성 저하.

**수정 내용:**

. JS `updateLivePrices()` — 인라인 `font-size:17px`, `font-size:13px`, `font-size:11px` 모두 제거. `el.textContent`로 교체해 CSS 클래스(`.score-price`, `.score-change`, `.king-price`, `.king-change`)가 폰트를 제어하도록 변경
. 애프터마켓 가격 표시 → `.live-ext` CSS 클래스(14px)로 대체
. `renderIndexChip()`, `fetchStripPrice()`, `fetchLivePrice()` 내 `font-size:13px` 제거
. VIX HTML 인라인 `font-size:13px` 제거
. `.title-date` CSS — `font-family: 'SF Mono', monospace` 및 `font-variant-numeric: tabular-nums` 제거
. `.pchip-lbl` 12px → 14px
. CSS 클래스 전체 (`ball-ph`, `ltier-*`, `macro-*`, `dot-sub` 등) — 11px/13px → 14px 일괄 치환
. **결과: 파일 내 14px 미만 폰트 0개**

---

### 3. CLAUDE.md 규칙 추가 (재발 방지)

새 규칙 2개 추가:

. **규칙 13 — TradingView interval/range 충돌 금지**: `interval`과 `range` 동시 사용 절대 금지. 배포 전 grep 점검 명령 포함.
. **규칙 14 — 폰트 14px 미만 재발 방지**: JS 인라인 font-size 금지 패턴·올바른 패턴 코드 예시 포함. 자동 점검 grep 포함.

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
