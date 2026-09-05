# API 키 대장

이 문서는 **키 값을 담지 않는다.** 이름, 쓰이는 자리, 발급일, 만료 예정일만 적는다.
값은 전부 GitHub 저장소 시크릿(Settings → Secrets and variables → Actions)에 있다.

만료 3주 전에 알람을 받기 위한 근거 문서다. 주간 점검 작업이 이 표를 읽는다.
**갱신하면 이 문서의 날짜를 같이 고친다.** 안 고치면 알람이 거짓말을 한다.

## 형식

`| 시크릿 이름 | 서비스 | 발급일 | 만료 예정 | 쓰이는 곳 |` 순서로 닷불릿에 적는다.
만료일을 모르면 `확인 필요`라고 적는다. 주간 점검이 그것도 알려 준다.

## 목록 (최종 확인: 2026-09-05)

- **ANTHROPIC_API_KEY**: Claude API. 키 이름 'ezlong swing'.
  발급 2026-09-05 / 만료 2026-12-05(3개월 가정, 확인 필요)
  쓰는 곳: `market-scorecard.yml` 82행, `swing-view.yml` 52행.
  호출 코드: `scripts/fetch-market-scorecard.py`(claude-sonnet-5),
  `scripts/generate-swing-view.py`(claude-fable-5)
  이력: 2026-09-05에 만료로 재발급. 그날 12:00·15:30 정규 실행이 갱신에 실패했다.

- **GEMINI_API_KEY**: Google AI Studio. 발급 확인 필요 / 만료 확인 필요
  **이 사이트에서 가장 많이 쓰는 키다. 죽으면 화면의 절반이 어제 것으로 굳는다.**
  2026-09-05 확인: 살아 있다(아래 데이터가 그날 전부 갱신됨).

  워크플로 8개와 그 산출물:
  - `fetch-us-chart-analysis.yml`(미국장 6회 + KST 07:15): `data/analysis-<티커>.json` 60여 개
  - `fetch-crypto-analysis.yml`(KST 06:05·14:05·22:05): `data/analysis-BTC_USD.json` 등
  - `fetch-kr-crypto-analysis.yml`(KST 09:35·12:05·14:05·15:35): 국내 종목 분석
  - `fetch-market-data.yml`(미국장 30분마다 + 프리·애프터): `data/market-signals.json`,
    스윙 연속성 서술(swingContinuity)
  - `fetch-today-chart.yml`(KST 06:30·22:35): `data/today-chart-data.json`
  - `fetch-time-background-photos.yml`(매시 05·35분): 사진을 보고 시간대·날씨·계절 분류
  - `naver-sync.yml`(KST 09:05·10:35·18:45): `data/naver-content.json`
  - `market-scorecard.yml`(하루 8회): Claude와 함께 쓴다

  호출 코드 10개:
  - `scripts/generate-chart-analysis.js`(gemini-2.5-flash-lite): us·kr·crypto 분석의 본체
  - `scripts/fetch-market-scorecard.py`(gemini-2.5-flash, 폴백 flash-lite)
  - `scripts/fetch-today-chart.py`(flash-lite, 폴백 flash)
  - `scripts/fetch-market-data.py`(flash-lite)
  - `scripts/collect-time-background-photos.js` · `scripts/photo-tag-classifier.mjs` ·
    `scripts/import-photos-r2.js` · `scripts/validate-photo-classifier.mjs` ·
    `scripts/translate-brief-history.mjs` · `scripts/brief-history-briefings.mjs`

  **주의: 키 사본이 맥에도 있다.** 사진 분류 스크립트는 로컬 실행용으로
  `~/.config/ezlong/gemini-key` 파일도 읽는다(`import-photos-r2.js` 안내 문구).
  **키를 갈면 GitHub 시크릿과 이 파일 두 곳을 다 고쳐야 한다.**

- **FIREBASE_TOKEN**: Firebase Hosting 배포. 발급 확인 필요 / 만료 확인 필요
  쓰는 곳: 워크플로 10개. 죽으면 배포가 안 된다.

- **FRED_API_KEY**: 세인트루이스 연준 경제지표. 발급 확인 필요 / 만료 확인 필요
  쓰는 곳: 워크플로 2개

- **ALPHAVANTAGE_API_KEY**: 시세 보조. 발급 확인 필요 / 만료 확인 필요
- **MASSIVE_API_KEY**: 발급 확인 필요 / 만료 확인 필요
- **FLASHALPHA_API_KEY**: 발급 확인 필요 / 만료 확인 필요

- **GitHub 개인 액세스 토큰**(시크릿 아님, 사람이 쓰는 자격 증명):
  fine-grained, ziririt/ezlong 한 저장소, Contents 쓰기.
  발급 2026-09-05 / 만료 2026-12-04(90일)
  쓰는 곳: 클라우드 세션이 맥 쪽 셸에서 push할 때. HANDOFF 7-2 참조

## 만료가 의심될 때 보는 자리

키가 죽으면 워크플로가 조용히 실패하고 데이터의 시각이 멈춘다. 화면은 어제 것을 계속 보여준다.

- Claude 키: `data/market-scorecard-data.json`의 `updated_at`,
  `data/swing-view.json`의 `generatedAtKST`
- Gemini 키: `data/analysis-*.json`, `data/today-chart-data.json`
- 배포: 라이브 반영이 2~3분 안에 안 되면 `FIREBASE_TOKEN` 의심

`data/watchdog-status.json`은 재실행만 걸고 **사람에게 알리지는 않는다.**
그래서 이 대장과 주간 점검이 따로 필요하다.
