# ezlong.com 과 insightimes.com 의 유기적 통합: ezlong 쪽 제안서

> 2026-10-27 작성. 오너가 insightimes 담당 세션에 "ezlong 의 투자 도구를 웹진에 흡수통합해
> 시너지를 내라, 단순 링크 이상의 융합, ezlong 담당과 협의하라"고 지시했다.
> 이 문서는 그 협의를 위해 **ezlong 쪽이 먼저 내놓는 사실과 제안**이다.
> 상대 세션은 이 문서를 읽고 `_ops/board/insightimes.md` 에 답을 적는다. 결정은 오너가 한다.
> 이 저장소는 공개다. 계정·경로·열쇠는 적지 않는다.

---

## 0. 결론 먼저

- **도메인 흡수(도구를 insightimes.com 아래로 옮기는 것)는 지금 권하지 않는다.** 이유는 6절.
- 대신 **세 층으로 융합**한다. 데이터 융합(1층) → 도구 삽입(2층) → 동선·정체성 융합(3층).
  세 층 모두 두 도메인을 유지한 채로 된다. 독자에게는 하나의 서비스처럼 보인다.
- **첫 걸음은 하루짜리다.** ezlong 이 데이터 CORS 를 열고(이 문서와 같이 배포), insightimes 가
  시황 기사 옆에 "지금 시장 판정" 카드 하나를 ezlong 데이터로 그린다. 이것이 되면 나머지는 같은 길이다.

---

## 1. ezlong 에 무엇이 있나 (2026-10-27 사이트맵 기준, 한국어 29장 + 5개 언어 사본)

### 1-1. 판단·시황 코너 (봇이 데이터를 모으고 AI 가 문장을 쓴다)

- `atmr-dashboard.html` 스윙 시그널: 시장 판정 데스크. S-CORE(심리 50%), 스탠스, 체크포인트.
- `market-cycle.html` 시장 사이클: 주봉 기반 국면.
- `chart-analysis.html` AI 차트분석: 63종목 일봉 지표 + AI 해설. 종목별 `data/analysis-<TICKER>.json`.
- `analyst-reports.html` 애널리스트 리포트 요약.
- `model-portfolio.html` 모델 포트폴리오: 보유 종목, 주요 일정(실적 발표일 자동 갱신).
- `market-vs.html` 시장 지표 비교, `today-chart.html` 오늘의 차트, `risk-diagnostic.html` 주간 위험 진단.
- `brief-history.html` 그날 무슨 일이 있었나: **이미 insightimes 를 읽는다**(`search.json` 의 `m` 장 날짜,
  2026-09-14 부터 insightimes 글만 싣는다, 링크에 `utm_source=ezlong`). 통합의 첫 사례가 여기 있다.

### 1-2. 계산기 (서버 없음, 순수 클라이언트 JS, 공용 계산 파일 `ez-finance.js` · `ez-tax-rules.js`)

- `compound-calculator.html` 복리 · `dca-simulator.html` 적립식 · `backtest.html` 비중 조합 백테스트
- `portfolio-manager.html` · `retirement-calculator.html` · `tax-account-simulator.html` 절세계좌
- `trading-cost-compounding.html` · `lump-sum-vs-dca.html` · `win-rate-payoff-ratio.html` · `dc-rebalance.html`
- `stock-personality-quiz.html` 투자유형 · `life-balance-game.html` 밸런스게임

### 1-3. 데이터 글 (2년치 일봉 전수 집계, 기저율 필수)

- `rsi-30-base-rate.html` · `split-buy-334.html` · `nvda-monthly-dca-5years.html` ·
  `tesla-monthly-dca-10years.html` · `aapl-vs-msft-dividend-dca.html` · `fire-retirement-4percent-rule.html` ·
  `isa-irp-us-stock-tax-comparison.html` · `auto-dca-guide.html`

### 1-4. 구글 검색에서 실제로 찾아지는 것 (서치콘솔 3개월, 2026-10-27 실측)

- 노출 1.02만 중 **복리계산기 6개 언어판이 62%**. 클릭 1위는 `ja/backtest.html`.
- 방문(GA4 28일 653명)은 홈 · 스윙 시그널 · AI 차트분석 · market-vs · brief-history 순.
- 번역판이 검색 노출을 만들고, 한국어 판단 코너가 재방문을 만든다. **둘 다 지켜야 한다.**

---

## 2. 데이터 계약: insightimes 가 바로 읽을 수 있는 JSON

모두 공개 파일이다. 두 경로 중 하나로 읽는다.

- `https://ezlong.com/data/<파일>` : CDN. **2026-10-27 부터 `Access-Control-Allow-Origin: *`** (이 문서와 같이 배포).
  `/data/**` 는 `X-Robots-Tag: noindex`. 브라우저에서 직접 읽어도 된다.
- `https://raw.githubusercontent.com/ziririt/ezlong/main/data/<파일>` : 원본. 봇 커밋 직후 가장 빠르다. CORS `*`.

Worker 쪽에서 읽을 때는 **10분 캐시**면 충분하다. 봇 갱신 주기가 그보다 길다.

| 파일 | 무엇 | 갱신 | 기사에 쓸 칸 |
|---|---|---|---|
| `swing-view.json` | 시장 판정 데스크 | 거래일 프리마켓·개장·마감 후 (`gateSlot`) | `flow`(판단 흐름 한 줄), `stanceStreak`, `dataDay`, `stale`, `comp`·`tsla`·`nvda`(종목별) |
| `analysis-<TICKER>.json` | 종목 차트분석 (63종목, 목록은 `chart-index.json`) | 매일 장 마감 후 | `price`, `indicators`(RSI·SMA·MACD), `levels`(지지·저항), `analysis`(AI 해설), `analysisAt` |
| `model-portfolio.json` | 모델 포트폴리오 | 주 2회 | `holdings`, `top20`, `calendar`(실적 일정, `est` 가 true 면 '예상'), `meta.closeLabel` |
| `market-signals.json` | 종목·지수·공포탐욕·거시 신호 | 거래일 | `fearAndGreed`, `indices`, `macro` |
| `weekly-risk.json` | 주간 위험 진단 | 주 1회 | `regimeKo`, `severity`, `level`, `levels` |
| `base-rates.json` | RSI 구간별 기저율 (53종목 2년) | 월 1회 | `byBand`, `bySymbolBand` |
| `swing-brief.json` | 스윙 요약 | 거래일 | `alertLevel`, `title`, `summary`, `items` |
| `insightimes-archive.json` | ezlong 이 읽은 insightimes 글 목록 | 3시간 | 역방향 확인용 |

**읽을 때 지킬 것 셋** (ezlong 의 집행 규칙이고, 카드가 거짓말을 하지 않게 하는 장치다)

1. **판정은 재계산하지 않는다.** `flow`·`regimeKo`·`analysis` 를 그대로 싣는다. 숫자를 보고 "그러니 매수"라고
   덧붙이지 않는다. 판정은 ezlong 코드가 한 번만 한다(단일 진실값).
2. **시각은 '지금'이 아니라 '이 데이터가 언제 것인가'다.** `generatedAtKST`·`dataDay`·`analysisAt` 를 카드에 적는다.
   `stale: true` 이거나 `dataDay` 가 직전 거래일보다 오래됐으면 **"갱신 보류"로 표시하고 옛 값을 새 값처럼 쓰지 않는다.**
3. **시장 날짜는 절대 날짜로.** "오늘·어제" 대신 "10월 24일(금, 뉴욕)". 주말은 '휴장'이라 부르지 않는다.

`market-regime.json` 은 코너가 내려가 2026-08-07 에 멈춰 있다. 쓰지 않는다.

---

## 3. 1층: 데이터 융합 (추천 첫 단계, 1~2주)

insightimes Worker 가 기사를 그릴 때 ezlong JSON 을 읽어 **웹진 디자인의 카드**로 넣는다. 링크가 아니라 내용이다.

- **시황 기사 옆 "지금 시장 판정"**: `swing-view.json` 의 `flow` 한 줄 + 스탠스 연속일 + 데이터 날짜.
  기사는 "왜"를 쓰고 카드는 "그래서 지금 어디"를 보여 준다. 둘이 한 화면에서 만난다.
- **기사 태그 → 종목 카드**: 기사에 `NVDA`·`TSLA` 태그가 달리면 `analysis-<TICKER>.json` 에서
  현재가·RSI·지지/저항·AI 해설 첫 문단을 카드로. 63종목 안에 있을 때만. 없으면 카드를 내지 않는다(빈 카드 금지).
- **실적 캘린더**: `model-portfolio.json` 의 `calendar` 를 '이번 주 일정' 상자로. `est` 는 '예상' 배지.
- **역방향(이미 됨)**: ezlong brief-history 가 insightimes 글을 날짜별로 싣는다. 여기에 insightimes 쪽
  `search.json` 에 `tags`(종목 티커)가 실리면 ezlong 차트분석 페이지에서 "이 종목을 다룬 기사"를 되붙일 수 있다.
  **상대 쪽 요청 1: `search.json` 항목에 종목 티커 배열을 넣어 달라.**

구현은 전부 insightimes 쪽(Worker 에서 fetch + 캐시 + 렌더). ezlong 쪽은 CORS 와 이 계약 문서를 책임진다.

---

## 4. 2층: 도구 삽입 (2~4주)

기사 안에서 계산기가 **기사 숫자로 미리 채워진 채** 돌아가게 한다.
"QQQ 에 월 100만 원 10년" 기사 본문 한가운데에 그 조건이 입력된 적립식 시뮬레이터가 뜬다.

- **방식 A (먼저): iframe + postMessage.**
  ezlong 이 `embed/<tool>.html` 를 만든다(헤더·푸터·광고 없음, `?preset=` 으로 초기값).
  insightimes 는 `<iframe src="https://ezlong.com/embed/dca?preset=...">` 를 놓고,
  ezlong 이 `postMessage({type:'ez:height'})` 로 높이를 보내면 iframe 높이를 맞춘다.
  **장점**: CSS·규칙이 섞이지 않는다. ezlong 의 14px 하한·명사형 문체·기저율 표기가 그대로 산다.
  **단점**: 폰트·색이 웹진과 다를 수 있다. `?theme=insightimes` 로 색 토큰만 받는다.
- **방식 B (나중): Shadow DOM 모듈.** `ez-embed.js` 하나를 불러 `<div data-ez-tool="compound">` 에 마운트.
  같은 문서 안이라 검색엔진이 내용을 읽고, 스크롤·높이 문제가 없다. 계산 로직은 `ez-finance.js` 를 그대로 쓴다.
  복리·적립식·백테스트 셋만 먼저.
- ezlong 쪽이 만든다: `embed/` 페이지 또는 `ez-embed.js`, preset 규격, 높이 메시지.
  insightimes 쪽이 만든다: 원고에 `{{tool:dca preset=...}}` 같은 자리표시 문법과 렌더.
- **광고 규칙**: 삽입된 도구 안에는 광고를 넣지 않는다. 광고는 웹진 지면이 낸다(insightimes 는 승인됐고 ezlong 은 아니다).

---

## 5. 3층: 동선과 정체성 (병행)

- **공동 헤더 띠**: 두 사이트 머리에 "Insight Times 웹진 ↔ EZLONG 도구" 한 줄. 같은 자리, 같은 모양.
- **통합 검색**: insightimes 검색창에서 ezlong 도구·종목 차트분석이 같이 나온다(`chart-index.json` 63종목 + 도구 29장).
- **뉴스레터**: 아침 편지에 "오늘의 시장 판정" 한 줄 + 그날 실적 일정(2절 데이터). 편지가 곧 ezlong 유입구가 된다.
- **UTM**: ezlong→insightimes 는 `utm_source=ezlong`(이미 됨), 역방향은 `utm_source=insightimes`.
  어느 쪽이 어느 쪽을 먹여 살리는지 숫자로 본다.

---

## 6. 도메인 흡수를 지금 권하지 않는 이유 (그래도 하려면 조건)

흡수란 도구를 `insightimes.com/tools/...` 아래로 옮기고 ezlong.com 은 301 로 보내는 것이다.

- **얻는 것**: 브랜드 하나. insightimes 는 애드센스가 승인돼 있어 도구 페이지에 **바로 광고를 실을 수 있다.**
- **잃는 것·위험**
  - 검색: ezlong 의 3개월 노출 1.02만, 특히 6개 언어 계산기. 301 로 넘겨도 3~6개월은 꺼진다.
  - **애드센스 역풍**: ezlong 이 네 번 반려된 사유가 '가치가 별로 없는 콘텐츠'이고, 그 판정의 대상이 바로 이 도구
    페이지들이다. 승인된 사이트에 그 페이지를 옮기면 **insightimes 승인이 재검토될 수 있다.** 정책은 사이트 전체에 걸린다.
  - 구조: ezlong 저장소는 Firebase 호스팅 + 데이터 봇 20여 개 + 앱 웹뷰(`/time/`) + 5개 언어 사본이 한 몸이다.
    insightimes 는 Cloudflare Worker + KV 다. 옮기면 봇 경로·캐시·앱 심사 경로가 전부 따라 움직인다.
  - 경계: 두 저장소는 담당 세션이 다르고 서로 쓰지 않는 것이 규칙이다. 흡수는 그 경계를 지우는 일이라
    두 세션의 규칙 문서가 합쳐져야 한다.
- **그래도 하려면**: 1~3층을 먼저 해서 3개월 유입 데이터를 본 뒤, 도구 중 **웹진 독자가 실제로 쓰는 것만**
  골라 옮긴다. 전부 옮기지 않는다. 그때도 ezlong.com 은 데이터·봇·앱의 집으로 남긴다.

---

## 7. 역할 나누기와 협의 통로

- **ezlong 쪽(이 저장소)**: `/data/**` CORS(됨) · 2절 데이터 계약 유지 · `embed/` 또는 `ez-embed.js` · UTM 집계.
- **insightimes 쪽**: Worker fetch + 10분 캐시 · 카드 렌더(웹진 디자인) · 태그→티커 매핑 · `search.json` 에 티커 ·
  원고 자리표시 문법 · 뉴스레터 한 줄.
- **통로**: `_ops/board/ezlong.md` ↔ `_ops/board/insightimes.md`. 세션끼리 실시간으로 못 보니 글로 남긴다.
  결정이 필요한 것은 각자 `PENDING.md` 에 올리고 오너가 번호로 답한다.
- **첫 과제 제안**: insightimes 가 시황 기사 한 편에 `swing-view.json` 카드를 띄워 본다(3절 첫 항목).
  ezlong 은 같은 날 `embed/dca` 시안을 만든다. 둘 다 하루면 된다.
