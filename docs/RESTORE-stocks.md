# 심플 주가(stocks.html) 숨김과 복구 절차

**상태:** 2026-10-19부터 숨김(보류). 페이지와 코드는 지우지 않았다.
**이유:** 장중 시세를 대던 Massive(구 Polygon.io) Stocks Starter($29/월)를 해지했다.
라이브 시세 없이 하루 한 번 바뀌는 시세판은 "고장 난 페이지"로 보이므로, 종가판으로
남기지 않고 메뉴에서 숨겼다. 방문자가 늘어 다시 살릴 가치가 생기면 아래 순서대로 되돌린다.

숨긴 자리는 전부 `[보류 2026-10-19: 심플 주가]` 표시가 붙은 주석이다.
`grep -rn "보류 2026-10-19: 심플 주가" .` 한 줄이면 모든 자리가 나온다.

## 복구 순서

1. **Massive 재가입** - Stocks Starter($29/월, 15분 지연)면 충분하다. 새 API 키를
   GitHub 저장소 Settings → Secrets → `MASSIVE_API_KEY` 에 넣는다(값을 코드에 쓰지 않는다, 17항).
2. **자동 작업 되살리기**
   - `.github/workflows/fetch-stocks-prices.yml` (장중 15분 시세, Massive)
   - `.github/workflows/fetch-stocks-data.yml` (하루 1회 스파크라인, yfinance)
   - 두 파일의 `# schedule:` 과 `#  - cron:` 줄 앞의 `#` 를 지운다(들여쓰기 2칸/4칸 확인).
   - Actions 탭에서 두 워크플로를 수동 실행(Run workflow)해 `data/stocks-prices.json`,
     `data/stocks-data.json` 이 새로 써지는지 본다.
3. **감시견** - `scripts/watchdog.js` 의 `stocks-prices` · `stocks-data` 두 항목을 감싼
   `/* ... */` 를 푼다.
4. **주소 이동 해제** - `firebase.json` 의 `hosting.redirects` 에서 아래 7개를 지운다
   (다른 리다이렉트가 생겼다면 그것은 남긴다).
   `/stocks.html`, `/stocks_v2.html`, `/en/stocks.html`, `/ja/stocks.html`,
   `/zh/stocks.html`, `/es/stocks.html`, `/pt/stocks.html` → 각 언어 `chart-analysis.html` (301)
5. **메뉴·카드·링크 되살리기** (주석을 풀면 된다)
   - `ez-nav.js` 3곳(한국어 메뉴, 영문 메뉴, 언어별 공통 메뉴)
   - `ez-footer.js` 1곳
   - `index.html` 2곳(도구 카드, 하단 링크 묶음)
   - `en|ja|zh|es|pt/index.html` 도구 카드 각 1곳
   - `en|ja|zh|es|pt/analyst-reports.html`, `.../chart-analysis.html` 관련 도구 링크 각 1곳
   - `about.html` 과 그 생성기 `scripts/build-trust-pages.py` 각 1곳
   - 글 2편의 관련 링크: `rsi-30-base-rate.html`, `split-buy-334.html`
6. **사이트맵** - 아래 6개 `<url>` 블록을 `sitemap.xml` 에 다시 넣고
   `python3 scripts/check-sitemap.py` 를 통과시킨다.
7. **배포 후 확인** - `ezlong.com/stocks.html` 이 이동되지 않고 열리는지, 장중에
   시세 시각이 15분 안쪽인지 본다.

## 알아 둘 것

- 시세 작업은 장중 15분마다 **사이트 전체를 배포**했다. 숨긴 뒤에는 배포 빈도가 줄어,
  배포를 직접 하지 않는 봇(시장 신호·스코어카드 감사 등)의 `/data/` 파일은 다른 봇의
  배포가 올 때 함께 올라간다. 되살리면 다시 잦아진다.
- 관심종목은 방문자 브라우저(localStorage)에 저장돼 있어 서버에서 옮길 것이 없다.
- 운영 규칙: RULES-REF 17항(Massive 보안·이중 JSON), 19항(이중 장애 재발 방지),
  21~24항(브릿지·스파크라인).

## 사이트맵에서 뺀 블록 (그대로 다시 붙이면 된다)

```xml
  <url>
    <loc>https://ezlong.com/stocks.html</loc>
    <lastmod>2026-07-02</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.95</priority>
    <xhtml:link rel="alternate" hreflang="ko" href="https://ezlong.com/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://ezlong.com/en/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="ja" href="https://ezlong.com/ja/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="es" href="https://ezlong.com/es/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="pt" href="https://ezlong.com/pt/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="zh" href="https://ezlong.com/zh/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://ezlong.com/en/stocks.html"/>
  </url>
  <url>
    <loc>https://ezlong.com/en/stocks.html</loc>
    <lastmod>2026-07-02</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
    <xhtml:link rel="alternate" hreflang="ko" href="https://ezlong.com/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://ezlong.com/en/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="ja" href="https://ezlong.com/ja/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="es" href="https://ezlong.com/es/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="pt" href="https://ezlong.com/pt/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="zh" href="https://ezlong.com/zh/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://ezlong.com/en/stocks.html"/>
  </url>
  <url>
    <loc>https://ezlong.com/ja/stocks.html</loc>
    <lastmod>2026-07-28</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
    <xhtml:link rel="alternate" hreflang="ko" href="https://ezlong.com/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://ezlong.com/en/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="ja" href="https://ezlong.com/ja/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="es" href="https://ezlong.com/es/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="pt" href="https://ezlong.com/pt/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="zh" href="https://ezlong.com/zh/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://ezlong.com/en/stocks.html"/>
  </url>
  <url>
    <loc>https://ezlong.com/es/stocks.html</loc>
    <lastmod>2026-07-28</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
    <xhtml:link rel="alternate" hreflang="ko" href="https://ezlong.com/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://ezlong.com/en/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="ja" href="https://ezlong.com/ja/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="es" href="https://ezlong.com/es/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="pt" href="https://ezlong.com/pt/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="zh" href="https://ezlong.com/zh/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://ezlong.com/en/stocks.html"/>
  </url>
  <url>
    <loc>https://ezlong.com/pt/stocks.html</loc>
    <lastmod>2026-07-28</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
    <xhtml:link rel="alternate" hreflang="ko" href="https://ezlong.com/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://ezlong.com/en/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="ja" href="https://ezlong.com/ja/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="es" href="https://ezlong.com/es/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="pt" href="https://ezlong.com/pt/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="zh" href="https://ezlong.com/zh/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://ezlong.com/en/stocks.html"/>
  </url>
  <url>
    <loc>https://ezlong.com/zh/stocks.html</loc>
    <lastmod>2026-07-28</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
    <xhtml:link rel="alternate" hreflang="ko" href="https://ezlong.com/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://ezlong.com/en/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="ja" href="https://ezlong.com/ja/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="es" href="https://ezlong.com/es/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="pt" href="https://ezlong.com/pt/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="zh" href="https://ezlong.com/zh/stocks.html"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://ezlong.com/en/stocks.html"/>
  </url>
```
