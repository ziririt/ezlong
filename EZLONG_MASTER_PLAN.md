# EZLONG 종합 점검 및 개선 체계 — 마스터 플랜

> 작성: 2026-07-02(목) 23:20 KST · Claude Fable 5 전수 점검 결과
> 성격: 진단 리포트 + 운영 체계 재설계 + 실행 로드맵. **이 문서 자체는 아무것도 바꾸지 않는다.**
> 모든 실제 수정은 아래 로드맵의 Phase 단위로, 백업 → 수정 → 검증 → 배포 절차를 지켜 진행한다.
> 이 문서는 `**/*.md` firebase ignore 패턴에 걸리므로 운영 서버에 배포되지 않는다.

---

## 0. 실행 요약 — 세 줄

- **자동 업데이트:** 저장소 워크플로 16개 + 외부 파이프라인 1개(스윙 브리핑) 중 죽어 있는 건 정확히 2개 — 마켓 사이클 데이터(6/13 이후 19일 정지)와 스윙 브리핑(6/26 이후 정지, 긴급 시황 배너가 무력화된 상태). 나머지는 오늘 밤 실측 기준 전부 정상 가동. 공통 원인은 GitHub 바깥(cron-job.org·Claude 예약)에 의존하는 트리거의 '조용한 죽음'.
- **SEO/AEO:** 골격(hreflang, sitemap, JSON-LD, AI 크롤러 허용)은 이미 상위 수준. 그러나 영문판이 한국어판과 내부링크로 연결되지 않은 '고립된 섬'이고, og-image.png 404, 백업/드래프트 파일 공개 배포 등 감점 요인이 산재.
- **체계:** 지침 문서는 훌륭하나 CLAUDE.md와 EZLONG_GUIDE.md 사이에 모순 4건 발견(그중 1건은 6/14 대형사고의 원인 명령이 GUIDE에 아직 권장 절차로 남아 있는 위험한 모순). 감시 체계는 '감시자(watchdog)를 감시하는 자가 없는' 구조. 그리고 라이브 대조 결과 **배포는 이미 push 시 GitHub Actions 자동 배포가 지배하고 있어** CLAUDE.md 7항("자동 배포 불신, 수동 deploy 필수")의 전제가 현실과 반대로 뒤집혀 있다(2-4항).

---

## 1. 자동 업데이트 파이프라인 — 2026-07-02 23:15 KST 실측 진단

### 1-1. 정상 가동 확인 (파일 내용의 타임스탬프로 실측, 커밋 메시지 아님)

- `market-signals.json` (긍정vs부정·ATMR) — 22:31 KST, 30분 주기 정상
- `stocks-prices.json` (심플 주가 실시간) — 21:31 KST, 10분 주기 정상. missingSymbols는 BRK-B·ANSS·MMC 3개뿐 = CLAUDE.md 19항이 말하는 정상 공백
- `stocks-data.json` (심플 주가 일간) — 오늘 08:22 KST 생성 확인. 7/2 복구 조치가 실제로 작동 중
- `kr-prices.json` — 16:35 KST (한국장 마감 직후) 정상
- `market-scorecard-data.json` — 22:29 KST (고용보고서 카드 수동 추가 포함) 정상
- `analysis-*.json` (AI 차트분석) — TSLA 20:17, BTC 22:17 KST 정상
- `naver-content.json` — 21:10 KST 정상
- `options-latest.json` — 7/2 06:47 KST (7/1 미국장 마감 후) 정상 주기
- `watchdog-status.json` — 22:17 KST, 30분 주기로 복귀. 단 7/1에 약 18시간 공백 전력 있음(메모리 기록)

### 1-2. 죽어 있는 것 — 2건

**(A) 마켓 사이클 — 19일 정지 [P0]**

- `data/mc-ohlcv-*.json` 6종(SPY/QQQ/SOXX/RSP/TNX/VIX 주봉)의 마지막 갱신: **2026-06-13**. 마지막 커밋 2026-06-14 05:36.
- market-cycle.html은 이 파일들을 직접 fetch하므로, "하락장 변곡점 감시" 페이지가 3주 전 데이터를 서빙 중이다. 주봉이라 눈에 덜 띄었을 뿐, VIX·금리 같은 빠른 지표는 이미 완전히 낡았다.
- 원인: `fetch-market-cycle.yml`은 GitHub native cron이 없고 `workflow_dispatch` 전용 → cron-job.org 외부 트리거 의존 → 그쪽 잡이 죽은 뒤 아무 에러 없이 방치 (2026-07-02 메모리와 일치. 생성 이후 단 1회만 실행된 이력).
- watchdog 감시 대상에도 빠져 있어 이중으로 사각지대였다.

**(B) 스윙 브리핑 — 6일 정지 [P1]**

- `data/swing-brief.json` 마지막 실질 갱신: **2026-06-26** (6/27 커밋은 alertLevel none으로 배너를 끈 수동 조치).
- atmr-dashboard.html의 긴급 시황 배너는 alertLevel high/medium일 때만 뜨는 구조인데, 파이프라인이 죽어 있으면 **진짜 급락장이 와도 배너가 영원히 안 뜬다.** "조용한 고장"의 전형.
- 생성 주체가 저장소 안에 없다(워크플로·스크립트 없음). 메모리상 TradingView MCP + flash-lite로 Claude 쪽에서 돌리던 파이프라인인데, 현재 이 계정의 Claude 예약 작업 목록은 **비어 있음**을 확인. 즉 어디서도 안 돌고 있다.

### 1-3. 구조적 취약점

- **외부 트리거 의존 워크플로 3개:** `watchdog.yml`, `fetch-market-cycle.yml`, `naver-sync.yml`만 native cron 없이 cron-job.org 의존. 이 중 market-cycle이 죽었고, watchdog도 7/1에 18시간 멎은 전력. cron-job.org는 죽어도 GitHub에 아무 흔적을 남기지 않는다 — "실패"가 아니라 "실행 이력 없음"으로 보여서 대시보드로는 못 잡는다.
- **watchdog 커버리지가 5개뿐:** us-chart, kr-chart, crypto-chart, market-data, options. 정작 이번에 사고 난 market-cycle, swing-brief, 그리고 지난주 사고 난 stocks-data/stocks-prices, scorecard, kr-prices, naver는 전부 미감시.
- **감시자를 감시하는 자가 없다:** watchdog 자체가 cron-job.org 단일 의존이므로, cron-job.org가 죽으면 감시 체계 전체가 동반 침묵한다.

---

## 2. SEO / AEO / 국제화 — 현황 감사

### 2-1. 이미 잘 되어 있는 것 (건드리지 말 것)

- robots.txt: GPTBot·OAI-SearchBot·PerplexityBot·ClaudeBot 명시 허용(AEO 기본기), Ahrefs·Semrush 등 상업 스크레이퍼 차단, /data/ 차단, sitemap 선언. 구성 우수.
- sitemap.xml: 39개 URL, ko/en hreflang 쌍 + x-default 포함.
- 영문판 16페이지: GA·canonical·JSON-LD(페이지당 5개 블록)·hreflang 전부 탑재.
- 한국어 블로그 5편(테슬라 DCA 10년, NVDA DCA 5년, FIRE 4%룰, ISA/IRP 절세, AAPL vs MSFT): Article + FAQPage 스키마 탑재 — AEO 관점에서 정확한 방향.
- 네이버 서치어드바이저 인증 완료.

### 2-2. 발견된 문제 (심각도순)

- **[P1] og-image.png가 존재하지 않는다.** en/index.html의 og:image가 `https://ezlong.com/og-image.png`를 가리키는데 파일이 없음 → 영문 홈을 SNS/메신저에 공유하면 이미지가 깨진다. 한국어판은 logo-preview.png로 정상.
- **[P0로 격상] 영문판은 라이브에 존재하지 않았다.** 2026-07-03 새벽 확인: en/ 폴더 22개 파일 전체가 git 미추적 → 자동 배포(라이브=git 추적 파일)에서 제외 → **https://ezlong.com/en/ 이 404**. sitemap의 /en/ URL 16개와 hreflang이 전부 404를 가리키고 있었다. 해결: en/*.html(.bak 제외)을 커밋에 포함 (2026-07-03 배포분에 반영). 부가 문제로 ez-nav/ez-footer에 /en/ 내부링크 0개 — Phase 3-A에서 해결.
- **[P1] hreflang 누락 2페이지:** atmr-dashboard.html, dca-simulator.html (한국어판에 hreflang 0개 — en 버전이 있는데도). hreflang은 양방향이어야 유효하므로 이 2쌍은 국제화 신호가 깨져 있다.
- **[P2] sitemap lastmod 절반이 낡았다:** 39개 중 16개가 6/15, 6개가 5/31~6/8. 그 사이 실제로 수정된 페이지들이 있어 구글에 "안 바뀌는 사이트" 신호를 줄 수 있다.
- **[P2] 잡파일 공개 노출 — 라이브 실측 완료:** `swing-signal-mockup.html`, `gauge-preview.html`이 현재 ezlong.com에서 200으로 서빙되는 것을 브라우저로 직접 확인했다(admin.html·ez-style-guide.html도 git 추적 중이라 노출 추정). 반면 드래프트(atmr-dashboard 10~14)·en/*.bak·cleanup-dups.py는 404 — 이유는 아래 [중대 발견]에서 설명. 노출 중인 목업 페이지는 실서비스와 유사한 콘텐츠라 중복 콘텐츠 판정 위험이 있다.
- **[P2] google-site-verification 메타 태그가 없다** (네이버만 있음). GSC를 DNS나 GA 방식으로 인증했다면 문제없지만, 등록 여부 자체를 확인할 필요가 있다. GSC 없이는 색인 현황·검색 노출 쿼리·국가별 유입을 전혀 볼 수 없다.
- **[P3] llms.txt 없음.** 신흥 AEO 표준. 비용 5분, 잠재 이득 있음.
- **[P3] 루트에 빈 파일 `=`**, data/에 macOS 복사 잔재 2건(`analysis-ETH_USD 2.json`, `naver-content 2.json`) — CLAUDE.md 12항 규칙 위반 상태.

### 2-3. 영어권 노출 전략 — 냉정한 진단과 순서

현실 진단부터: 영문판 16페이지는 존재하지만, 영어권 구글에서 이길 무기는 아직 아니다. 이유는 세 가지 — (1) 내부링크 제로라 크롤러가 잘 못 들어가고, (2) 도구 페이지는 원래 검색 유입이 약하며(사람들은 "compound calculator"를 치면 nerdwallet을 만난다), (3) 진짜 유입을 만드는 롱테일 콘텐츠(블로그)가 영어로는 0편이다.

**전략의 핵심: 한국어에서 이미 증명된 공식을 영어로 복제한다.** 오늘 추가된 한국어 롱테일 5편이 바로 그 공식이다 — "TSLA에 매달 $500씩 10년 DCA 했으면?" 같은 구체적 백테스트 콘텐츠는 영어권 검색량이 한국어의 수십 배이고, 실데이터 기반이라 AI 답변엔진(Perplexity·ChatGPT 검색)이 인용하기 좋은 형태다. 계산기·시뮬레이터로 내부링크를 걸면 도구 페이지에도 트래픽이 흘러든다.

우선순위 (상세 실행은 4장 로드맵):

1. 기술적 결함 제거 — og-image, hreflang 2페이지, .bak 배포 차단, sitemap lastmod. (이걸 안 하면 뒤의 모든 노력이 할인당한다)
2. 색인 인프라 — GSC 등록 확인, Bing 웹마스터 등록(+IndexNow). Bing은 ChatGPT 검색의 소스라 AEO에서 체감보다 중요하다.
3. 내부링크 개통 — ez-footer.js에 "English" 섹션 추가(전 페이지 자동 반영, ez-nav은 이미 15개로 포화이므로 푸터가 적절), 각 한국어 도구 페이지 상단에 언어 스위처 1줄.
4. 영어 롱테일 콘텐츠 — 한국어 5편 중 보편성 높은 3편부터 영어화: TSLA 10-year DCA, NVDA 5-year DCA, 4% rule FIRE. ISA/IRP는 한국 제도라 제외. 이후 월 2편 페이스.
5. llms.txt + 블로그 FAQ 스키마 유지 — AEO 마무리.

### 2-4. [중대 발견] 배포 파이프라인의 실체 — CLAUDE.md 7항의 전제가 뒤집혀 있다

이번 점검에서 라이브 서버를 직접 대조한 결과, 문서에 적힌 배포 모델과 실제가 다르다:

- `firebase-hosting.yml`이 **main 브랜치 push마다 자동 배포**하도록 살아 있다. 데이터 커밋이 10~30분마다 push되므로, **사실상 하루 수십 번 GitHub 체크아웃(=git 추적 파일만) 기준으로 재배포**되고 있다.
- 증거: git 추적 파일(swing-signal-mockup.html 등)은 라이브에서 200, 미추적 파일(로컬 드래프트·.bak·cleanup-dups.py·`=`)은 전부 404. 라이브 상태가 git 추적 목록과 정확히 일치한다.
- 그런데 CLAUDE.md 7항은 "GitHub Actions 자동 배포는 신뢰하지 않는다. 항상 수동 firebase deploy 필수"라고 못박고 있다. 6/14 사고 당시엔 맞는 진단이었을 수 있으나, **현재는 자동 배포가 지배적 배포 경로**다.

이게 왜 중요한가:

- **수동 firebase deploy는 이제 오히려 위험 요인이다.** 로컬 폴더에는 미추적 잡파일(드래프트 5개, .bak 6개 등)이 있으므로, 수동 deploy를 하는 순간 이것들이 운영에 올라간다. 다음 데이터 push 때 Actions가 다시 지워주지만, 그 사이 노출되고, 반대로 "커밋 안 한 수정 + 수동 deploy"는 몇십 분 뒤 Actions 배포가 **조용히 되돌린다** — "분명히 고쳤는데 사라졌다"는 미스터리의 완벽한 레시피.
- **좋은 소식:** "라이브 = git" 등식은 사실 안정성에 유리한 구조다. push만 하면 배포되고, 라이브가 항상 저장소와 일치한다. 6/14식 "deploy 누락" 사고 자체가 구조적으로 사라진 상태.
- **결론(권고):** 자동 배포를 공식 경로로 인정하고 CLAUDE.md 3·7항을 현실에 맞게 개정한다 — "push = 배포. 수동 deploy는 Actions 장애 시 비상용으로만. 배포 확인은 push 후 1~2분 뒤 web.app에서". 아울러 `.firebaseignore`는 Firebase 공식 문서에 없는 파일이므로(공식 메커니즘은 firebase.json의 ignore 배열뿐), 제외 패턴을 firebase.json으로 이전해야 어떤 경로로 배포돼도 안전하다.

---

## 3. 지침·문서·메모리 체계 점검

### 3-1. 문서 간 모순 — 4건 발견

- **[위험] EZLONG_GUIDE.md 9장이 아직 `git stash && git pull --rebase && git stash pop`을 "1차 실행" 표준 절차로 안내한다.** 6/14 대형사고의 원인이 바로 미커밋 상태의 `git pull --rebase`였고 CLAUDE.md는 이를 금지 목록에 올렸는데, GUIDE에는 사고 이전 절차가 그대로 남아 있다. 유저가 GUIDE만 보고 따라 하면 같은 사고가 재현될 수 있다. → GUIDE 9장을 CLAUDE.md 3항(pull-first 철칙)과 동일하게 교체 필요.
- EZLONG_GUIDE.md 2장 서비스 표가 13행 — 실제 nav는 15개(심플 주가, 투자유형 진단 누락). 블로그 5편도 미기재.
- EZLONG_GUIDE.md가 `DEPLOY_CHECKLIST.md`를 참조하지만 그 파일은 존재하지 않는다(유령 참조).
- EZLONG_GUIDE.md 7장 이미지 목록이 2026-06-01 기준 21개로 동결 — 이후 추가된 book02_1.png, hero-swing.jpg 등 미반영. "목록을 문서에 수동 유지"하는 방식 자체가 항상 낡는다 → 목록은 삭제하고 점검 명령(grep 스크립트)만 남기는 것이 맞다.

### 3-2. 체계 평가

- CLAUDE.md의 사고방지 프로토콜·트리거 단어 자동 실행·위험 등급제(18항)는 실제로 작동하는 좋은 설계다. 유지한다.
- 메모리(21건)는 최신이고 정확했다 — 이번 점검에서 cron-job.org 취약점, 파이프라인 이중 장애 등 메모리 기록이 실측과 전부 일치.
- 다만 CLAUDE.md가 585줄로 비대해지는 중이다. "사건이 날 때마다 항목 추가" 방식은 언젠가 로드 비용과 규칙 충돌을 낳는다. → 당장 재편하지 말 것(안정성). 단, **새 항목 추가 시 기존 항목과 충돌 여부를 확인하는 관례**를 넣고, 20항을 넘으면 그때 "사고 사례집(INCIDENTS.md)"과 "현행 규칙(CLAUDE.md)"으로 분리를 검토한다.
- STATE.md 금지·CHANGELOG 단일화 원칙(18항)은 옳다. 그래서 이 마스터 플랜도 "완료된 Phase는 CHANGELOG로 넘기고 이 문서에서는 지운다"는 규칙으로 운영한다 — 진실의 원천이 갈라지지 않게.

---

## 4. 실행 로드맵 — 안정성 우선, Phase 단위

> 원칙: 한 Phase = 한 세션 = 한 커밋 묶음. 각 Phase 시작 전 백업 스크립트, 끝나면 라이브 확인 + CHANGELOG 기록.
> 코드가 아닌 유저 액션(콘솔 로그인 등)은 ◆ 표시.

### Phase 0 — 즉시 (코드 수정 없음, 오늘 밤~내일)

- ◆ **GitHub Actions에서 `fetch-market-cycle.yml` 수동 실행** (Actions 탭 → Run workflow) — 19일 묵은 마켓 사이클 데이터 즉시 캐치업. 위험도 0.
- ◆ **cron-job.org 콘솔 로그인 확인**: market-cycle용 잡이 활성인지, 감시견(ID 7692964) 로그에 에러 없는지. (Claude는 로그인 대행 불가)
- ◆ **GSC(Google Search Console) 등록 여부 확인** — 미등록이면 도메인 속성으로 등록. sitemap 제출.
- **결정 필요 1:** 스윙 브리핑을 재가동할지, 기능을 내릴지. (재가동이면 생성 파이프라인을 GitHub Actions로 이식하는 게 정석 — Claude 예약 작업은 이번에 증명됐듯 조용히 사라질 수 있다)
- **결정 필요 2:** market-cycle 트리거를 GitHub native cron으로 복원할지. **권고: 복원.** 주봉 데이터라 평일 1회면 충분하고, native cron은 외부 서비스가 죽어도 돈다. cron-job.org는 분 단위 정밀 스케줄이 필요한 잡(차트분석 시간대 분리)에만 남긴다.

### Phase 1 — 저위험 청소 + SEO 기술 결함 제거 (1등급 작업, 1세션)

- 루트 `=` 빈 파일, data/ 중복 2건 삭제 (`analysis-ETH_USD 2.json`, `naver-content 2.json`), 로컬 .bak·드래프트는 `.backup/`으로 이동(미추적이라 라이브 영향 없음)
- **배포 제외를 firebase.json의 ignore 배열로 이전** (.firebaseignore는 비공식 — 2-4항 참조): `*.bak`, `*.BACKUP-*.html`, `atmr-dashboard [0-9]*.html`, `swing-signal-mockup.html`, `gauge-preview.html`, `_og-render.html`, `*.py`, `*.sh`, `next.config.mjs`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `vercel.json`, `package.json`, `*.plist`, `_github-setup/**` (admin.html·ez-style-guide.html은 유저 판단)
- CLAUDE.md 3·7항 배포 모델 개정: "push = 자동 배포"를 공식화, 수동 deploy는 비상용으로 격하 (2-4항 근거)
- og-image 해결: 1200×630 og-image.png 신규 제작 또는 en/index.html의 참조를 logo-preview.png로 교체 (후자가 5분 해법)
- atmr-dashboard.html, dca-simulator.html에 hreflang 3종 추가
- sitemap.xml lastmod 실제 파일 수정일 기준으로 일괄 갱신
- llms.txt 신설 (사이트 소개 + 주요 도구/블로그 목록, 영/한 병기)
- EZLONG_GUIDE.md 모순 4건 수정 (9장 pull --rebase 절차 교체가 핵심)
- 배포: 이미지 있으면 단독 커밋 먼저 → pull → add(명시) → commit → push → firebase deploy → web.app 확인

### Phase 1.5 — AI 판단 연속성: "3영업일 판단 원장" — **구현 완료 (2026-07-03 새벽, 독립 감사 통과, 배포 대기)**

> 아래 설계대로 구현됐다. 유닛 테스트(차트 9종·스코어카드 7종·스윙 5종) 전부 통과, 깨끗한 서브에이전트 감사 "배포 가능" 판정.
> Phase 1 저위험 수정(firebase.json ignore, og:image, hreflang 2页, GUIDE 모순 4건, CLAUDE.md 3·7항 개정+20항 신설, sitemap lastmod 12건, llms.txt, 탭 딥링크)도 같은 세션에서 완료.
> 추가 발견: market-cycle yml의 git add 패턴이 구버전 파일명(ohlcv-*)이어서 트리거가 살아 있었어도 커밋 불가였음 — mc-ohlcv-*로 수정 완료.



**문제의 실체 (코드로 확인):** 유저가 여러 차례 요구했음에도 모든 AI 분석이 기억상실 상태로 동작하는 이유 —

- `generate-chart-analysis.js` (AI 차트분석 + TSLA/NVDA 집중 분석): Gemini 프롬프트에 당일 차트 수치만 들어간다. 자신이 어제 내린 판단을 전혀 모른다. RSI "이전값→현재값" 궤적은 있지만 이건 원시 지표 궤적이지 판단의 연속이 아니다.
- `fetch-market-scorecard.py` (긍정vs부정): `prev_entries[:2]` — 직전 카드 2장만 참조. 같은 날 안에서의 일관성 장치일 뿐, 3영업일 추이가 아니다.
- 스윙 시그널: `market-signals.json`의 `previousSignals`에 30분 단위 수치 스냅샷 144개가 이미 쌓이고 있으나(약 3~6일치), 이를 판단 서술에 활용하는 층이 없다.

**설계 — 판단 원장(judgment ledger):**

- 신규 파일 `data/judgment-history.json` 하나. 구조:
  ```json
  {
    "chart":     { "TSLA": [{"d":"2026-07-02","t":"22:17","k":"관망 — RSI 48↘, $315 지지 유지, 분배 조짐"}], "NVDA": [], "...": [] },
    "scorecard": [{"d":"2026-07-02","slot":"am","k":"긍정 6:4 — 고용 서프라이즈, 금리인하 기대"}],
    "swing":     [{"d":"2026-07-02","k":"buy 69 / sell 36, gear3, F&G 30 — 온기 유지"}]
  }
  ```
- **쓰기:** 각 생성 스크립트가 Gemini 출력에 `summaryLine`(80자 이내 핵심 키워드 요약) 필드를 추가로 요구 → 생성 직후 원장에 append → 심볼·파이프라인당 최근 15개로 prune. 파일 크기 영구 상한.
- **읽기:** 생성 직전 원장에서 **최근 3개의 서로 다른 날짜**를 추출해 프롬프트에 주입. "서로 다른 날짜 3개" 방식이면 주말·공휴일 테이블이 필요 없다 — 파이프라인이 거래일에만 돌므로 원장에 존재하는 날짜 자체가 영업일이다.
- **프롬프트 주입 블록 (각 스크립트 공통):**
  ```
  === 직전 3영업일 판단 기록 (오래된 순) ===
  07-01: ...
  07-02: ...
  규칙: 오늘 판단은 위 흐름과의 연속성을 반드시 명시하라. "3일 연속 ~", "어제 ~에서 오늘 ~로 전환" 형태.
  판단이 어제와 달라지면 무엇이 달라졌는지 근거를 제시하라. 기록과 무관한 처음 보는 듯한 서술 금지.
  ```
- **출력 노출:** narrative에 [3일 추이] 섹션 추가 → 대시보드·차트분석 화면에서 유저도 연속성을 눈으로 확인.
- **안전장치:** 원장 read/write는 try/catch — 파일이 없거나 깨져도 오늘처럼 단발 생성으로 동작(무중단 폴백). 워크플로 yml의 `git add` 명시 목록에 `data/judgment-history.json` 추가 필수(16항 패턴 준수).
- **비용:** 호출당 입력 +300~500토큰. flash-lite 기준 일 수 원 수준 — 무시 가능.

**수정 파일:** `scripts/generate-chart-analysis.js`, `scripts/fetch-market-scorecard.py`, (스윙 서술은 previousSignals 활용 확인 후) `atmr-dashboard.html` 또는 `fetch-market-data.py`, 관련 워크플로 yml 2~3개. 2등급 규율 적용: 백업 → git tag → 구현 → 깨끗한 서브에이전트 diff 감사 → 배포.

### Phase 2 — 감시 체계 확장 (2등급 작업, 1세션, 서브에이전트 검증 필수)

목표: **"어떤 파이프라인이 죽어도 24시간 내 자동 감지"**. 설계:

- `scripts/watchdog.js`의 monitors 배열 확장 — 기존 5개에 추가:
  - `market-cycle`: mc-ohlcv-SPY-weekly.json, maxAgeHours 192 (8일 — 주봉이므로), stale 시 fetch-market-cycle.yml 트리거
  - `stocks-data`: stocks-data.json, maxAgeHours 30 (일 1회 + 여유), 트리거 fetch-stocks-data.yml
  - `stocks-prices`: stocks-prices.json, maxAgeHours 2 (장중 기준), 주말 skip 로직
  - `scorecard`: market-scorecard-data.json, maxAgeHours 20
  - `kr-prices`: kr-prices.json, maxAgeHours 30, 주말 skip
  - (swing-brief는 Phase 0 결정에 따라 추가 또는 대상 제외)
- **감시자의 감시자:** watchdog.yml에 GitHub native cron 백업 추가 (예: `13 */6 * * *` — cron-job.org 30분 주기가 살아 있으면 concurrency로 중복 방지, 죽으면 최소 6시간 주기로 생존). 이걸로 "동반 침묵" 시나리오가 사라진다.
- `scripts/health-check.py` 신설 — 모든 데이터 파일의 내용 타임스탬프를 한 번에 출력하는 30줄짜리 점검 스크립트. Claude 세션 시작 시 명령 하나로 전체 파이프라인 생사 확인:
  ```bash
  python3 scripts/health-check.py   # 각 파일: 이름 / 내용상 갱신시각 / 경과시간 / 판정(OK·STALE)
  ```
- CLAUDE.md에 20항 신설: "유저가 '파이프라인 점검'·'데이터 점검'·'헬스체크'라고 하면 health-check.py 실행 + 외부 트리거 전용 워크플로(현재 watchdog·naver-sync±market-cycle) 최근 실행 별도 확인"
- 검증: 변경을 보지 않은 서브에이전트에게 watchdog.js diff 감사 (18항 규율)

### Phase 3 — 영어권 SEO/AEO 본격화 (1등급, 2~3세션 분할)

- 3-A: ez-footer.js에 English Tools 섹션(en/ 16페이지 링크) + 한국어 도구 페이지에 언어 스위처. 파일 2개 수정으로 전 페이지 반영 — 기존 일원화 구조의 이점.
- 3-B: 영어 블로그 3편 — Tesla $500/month 10-Year DCA Backtest, NVDA 5-Year DCA, The 4% Rule with US Stocks. 각각 Article+FAQPage 스키마, 관련 계산기로 내부링크, sitemap 등록. 실데이터는 기존 data/ 파이프라인 재활용.
- 3-C: ◆ Bing Webmaster Tools 등록 + IndexNow 키 설치. GSC에서 en/ 색인 현황 첫 리뷰.
- 성과 측정: GSC 국가별 노출 쿼리를 월 1회 확인. 지표 없는 SEO는 감이다.

### Phase 4 — 콘텐츠 리듬 (상시 운영)

- 영어 롱테일 월 2편, 한국어 월 2편. 소재는 이미 있는 데이터 파이프라인에서 나온다(백테스트·시그널 통계).
- 분기 1회 "문서 정합성 데이": GUIDE 표 vs ez-nav.js 실물 대조, sitemap lastmod, 이미지 참조 grep, data/ 중복 점검 — 전부 이미 있는 점검 명령의 정기 실행일 뿐.

---

## 5. 이 문서의 운영 규칙

- 완료된 Phase는 CHANGELOG.md에 이관하고 여기서는 "완료(날짜)"로 한 줄만 남긴다. 진실의 원천은 CHANGELOG 하나.
- 로드맵 변경은 이 문서에서만 한다. 별도 TODO/STATE 파일 금지 (CLAUDE.md 18항).
- 다음 세션에서 "마스터 플랜 Phase 1 진행해줘"라고 하면 Claude가 백업 확인부터 시작한다.

## 6. 결정 사항 (2026-07-02 유저 확정)

1. 스윙 브리핑: **GitHub Actions로 이식** — Phase 2에서 구현. 생성 로직을 저장소 안 워크플로로 옮겨 매일 자동 실행.
2. market-cycle 트리거: **GitHub native cron 복원** — 평일 1회. cron-job.org 의존 제거.
3. 배포 모델: **push = 자동 배포 공식화** — CLAUDE.md 3·7항 개정 + Actions 배포 실패 시 알림 스텝 추가. 수동 deploy는 비상용으로 격하.
4. og-image: **logo-preview.png 재사용** — en/index.html 참조 1줄 교체.

### 아직 답 필요한 것

- GSC(Google Search Console) 등록되어 있는가? (되어 있으면 인증 메타 불필요, 안 되어 있으면 Phase 0에서 등록)
- admin.html, ez-style-guide.html을 공개 유지할 것인가?
