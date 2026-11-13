/**
 * ez-footer.js: EZLONG 글로벌 푸터 공유 스크립트
 * 사용법: <script src="/ez-footer.js"></script>
 * - ez-design.css 가 먼저 로드되어 있어야 합니다.
 */
(function () {
  var html =
    '<footer class="ez-footer" role="contentinfo">' +
      '<div class="ez-footer-inner">' +

        '<!-- 서비스 메뉴 그리드 (푸터 최상단) -->' +
        '<nav class="ez-footer-nav-grid" aria-label="서비스 메뉴">' +
          '<a href="/atmr-dashboard.html" class="ez-footer-nav-item">스윙 시그널 대시보드</a>' +
          '<a href="/atmr-dashboard.html#top9" class="ez-footer-nav-item">TOP9 집중분석<span class="ez-new">NEW</span></a>' +
          '<a href="/market-vs.html" class="ez-footer-nav-item">긍정 vs 부정 몇대몇</a>' +
          '<a href="/brief-history.html" class="ez-footer-nav-item">차트: 그날 무슨 일이 있었나<span class="ez-new">NEW</span></a>' +
          /* [보류 2026-10-19: 심플 주가] 복구 절차: docs/RESTORE-stocks.md
          '<a href="/stocks.html" class="ez-footer-nav-item">심플 주가 정보</a>' + */
          '<a href="/chart-analysis.html" class="ez-footer-nav-item">AI 차트분석</a>' +
          '<a href="/model-portfolio.html" class="ez-footer-nav-item">AI포트폴리오 점검<span class="ez-new">NEW</span></a>' +
          '<a href="/market-cycle.html" class="ez-footer-nav-item">Market Cycle Monitor</a>' +
          '<a href="/dca-simulator.html" class="ez-footer-nav-item">DCA 복리 시뮬레이터</a>' +
          '<a href="/portfolio-manager.html" class="ez-footer-nav-item">포트폴리오 복리 시뮬레이터</a>' +
          '<a href="/tax-account-simulator.html" class="ez-footer-nav-item">절세 계좌 세후 시뮬레이터</a>' +
          '<a href="/compound-calculator.html" class="ez-footer-nav-item">복리 계산기</a>' +
          '<a href="/retirement-calculator.html" class="ez-footer-nav-item">은퇴 목표 역산 계산기</a>' +
          '<a href="/backtest.html" class="ez-footer-nav-item">몬테카를로 포트폴리오 시뮬레이터</a>' +
          '<a href="/risk-diagnostic.html" class="ez-footer-nav-item">투자 행동 자가진단</a>' +
          '<a href="/stock-personality-quiz.html" class="ez-footer-nav-item">MBTI로 찾는 맞춤 투자 포트폴리오</a>' +
          '<a href="/auto-dca-guide.html" class="ez-footer-nav-item">자동 적립식 매수 가이드</a>' +
          '<a href="/life-balance-game.html" class="ez-footer-nav-item">밸런스게임: 마이 라이프</a>' +
        '</nav>' +

        /* ezlong이 만든 앱 9개 (2026-11-14 운영 지시: 메인 푸터와 같은 모양으로, 모든 지면에).
           큰 카드 둘(Long Time·Skyblue Note)은 상단 배너(ez-app-promo.js)와 메인 본문이 맡는다.
           원본 목록은 app/apps-nav.js, 메인(index.html) 푸터에도 같은 9개: 앱이 바뀌면 세 곳을 같이 고친다. */
        '<section class="ez-more-apps" aria-labelledby="ez-footer-apps-h">' +
          '<div class="ez-more-apps-head">' +
            '<h2 class="ez-more-apps-title" id="ez-footer-apps-h">ezlong이 만든 앱</h2>' +
            '<a class="ez-more-apps-all" href="/app/">앱 모음 전체 보기' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="13" height="13" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a>' +
          '</div>' +
          '<div class="ez-more-apps-grid">' +
            '<a href="https://insightimes.com/" class="ez-more-app">' +
            '<img src="/app/icons/icon-it.jpg" alt="" width="96" height="96" loading="lazy" decoding="async">' +
            '<span class="ez-more-app-body">' +
            '<b>Insight Times</b>' +
            '<small>웹진 · 미국 주식</small>' +
            '<em>반도체와 빅테크, 금리와 유가가 기업 손익에 닿는 길을 풀어 씁니다. 평일 아침엔 미국장 마감 시황.</em>' +
            '</span>' +
            '</a>' +
            '<a href="https://ziririt.github.io/phototime-site/" class="ez-more-app">' +
            '<img src="/app/icons/icon-pt.jpg" alt="" width="96" height="96" loading="lazy" decoding="async">' +
            '<span class="ez-more-app-body">' +
            '<b>포토 타임</b>' +
            '<small>사진 · 액자</small>' +
            '<em>사진첩을 음악과 함께 인화 사진 슬라이드쇼로. 서랍 속 옛 아이패드가 액자로 살아납니다.</em>' +
            '</span>' +
            '</a>' +
            '<a href="/app/#longlong" class="ez-more-app">' +
            '<img src="/app/icons/icon-ll.jpg" alt="" width="96" height="96" loading="lazy" decoding="async">' +
            '<span class="ez-more-app-body">' +
            '<b>LongLong</b>' +
            '<small>사진 · 편집</small>' +
            '<em>스크린샷 여러 장의 겹친 곳과 상단바를 걸러 내고 긴 한 장으로 이어 붙입니다.</em>' +
            '</span>' +
            '</a>' +
            '<a href="https://convert.ezlong.com/" class="ez-more-app">' +
            '<img src="/app/icons/icon-ec.jpg" alt="" width="96" height="96" loading="lazy" decoding="async">' +
            '<span class="ez-more-app-body">' +
            '<b>Ez Converter</b>' +
            '<small>파일 · 변환</small>' +
            '<em>HEIC를 JPG로, MOV를 MP4로, CSV를 엑셀로. 서버에 올리지 않고 기기 안에서 바꿉니다.</em>' +
            '</span>' +
            '</a>' +
            '<a href="https://pdf.ezlong.com/?lang=ko" class="ez-more-app">' +
            '<img src="/app/icons/icon-ap.jpg" alt="" width="96" height="96" loading="lazy" decoding="async">' +
            '<span class="ez-more-app-body">' +
            '<b>Any to PDF</b>' +
            '<small>문서 · PDF</small>' +
            '<em>사진, 글, 문서를 PDF 한 개로 묶습니다. 보던 웹 페이지도 A4나 긴 한 장으로 저장됩니다.</em>' +
            '</span>' +
            '</a>' +
            '<a href="/app/ezscan/" class="ez-more-app">' +
            '<img src="/app/icons/icon-es.jpg" alt="" width="96" height="96" loading="lazy" decoding="async">' +
            '<span class="ez-more-app-body">' +
            '<b>ezScan</b>' +
            '<small>문서 · 스캔</small>' +
            '<em>대고 찍으면 배경을 지우고, 말린 책 안쪽과 구부러진 영수증을 펴 줍니다.</em>' +
            '</span>' +
            '</a>' +
            '<a href="https://readtrans.ezlong.com/" class="ez-more-app">' +
            '<img src="/app/icons/icon-rt.jpg" alt="" width="96" height="96" loading="lazy" decoding="async">' +
            '<span class="ez-more-app-body">' +
            '<b>ReadTrans</b>' +
            '<small>전자책 · 번역</small>' +
            '<em>보던 전자책 뷰어는 그대로 두고, 지금 보는 쪽을 옆 창에 번역해 보여 주는 컴퓨터 앱.</em>' +
            '</span>' +
            '</a>' +
            '<a href="https://send.ezlong.com/" class="ez-more-app">' +
            '<img src="/app/icons/icon-sd.svg" alt="" width="96" height="96" loading="lazy" decoding="async">' +
            '<span class="ez-more-app-body">' +
            '<b>초간단 파일공유</b>' +
            '<small>웹 · 파일 전송</small>' +
            '<em>가입 없이 여섯 자리 코드로 주고받고, 보낸 뒤 1분이 지나면 지워집니다.</em>' +
            '</span>' +
            '</a>' +
            '<a href="https://ziririt.github.io/batterylife-site/" class="ez-more-app">' +
            '<img src="/app/icons/icon-bl.jpg" alt="" width="96" height="96" loading="lazy" decoding="async">' +
            '<span class="ez-more-app-body">' +
            '<b>배터리 라이프</b>' +
            '<small>충전 · 시계</small>' +
            '<em>들어오는 충전 속도를 와트로 크게, 완충까지 남은 시간은 80% 이후 느려지는 구간까지 셈합니다.</em>' +
            '</span>' +
            '</a>' +
          '</div>' +
        '</section>' +

        /* 브랜드·책 묶음은 앱 목록 아래(2026-11-14 운영 지시: 서비스 메뉴 → 만든 앱 → 브랜드·책 → 법적 고지). */
        '<div class="ez-footer-top">' +
          '<div class="ez-footer-brand">' +
            '<picture>' +
              '<source srcset="/logo-darkmode.png?v=20260807c" media="(prefers-color-scheme: dark)">' +
              '<img src="/logo.png?v=20260809" alt="EZLONG">' +
            '</picture>' +
            '<p class="ez-footer-brand-desc">쉽고 안전한 장기투자 파트너<br>easy.invest.good@gmail.com</p>' +
          '</div>' +
          '<div class="ez-footer-books">' +
            '<div class="ez-footer-book">' +
              '<a href="https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=385645494&partner=friends327" class="ez-footer-book-cover" target="_blank" rel="noopener">' +
                '<img src="/book01.png" alt="절대 실패하지 않는 미국 주식 ETF 투자">' +
              '</a>' +
              '<div class="ez-footer-book-info">' +
                '<span class="ez-footer-book-title">절대 실패하지 않는<br>미국 주식 ETF 투자</span>' +
                '<span class="ez-footer-book-label">종이책</span>' +
                '<div class="ez-footer-book-btns">' +
                  '<a href="https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=385645494&partner=friends327" class="ez-footer-book-btn" target="_blank" rel="noopener">알라딘</a>' +
                  '<a href="https://www.yes24.com/product/goods/177260453" class="ez-footer-book-btn" target="_blank" rel="noopener">예스24</a>' +
                  '<a href="https://product.kyobobook.co.kr/detail/S000219205812" class="ez-footer-book-btn" target="_blank" rel="noopener">교보문고</a>' +
                '</div>' +
                '<span class="ez-footer-book-label">전자책</span>' +
                '<div class="ez-footer-book-btns">' +
                  '<a href="https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=387049914&partner=friends327" class="ez-footer-book-btn" target="_blank" rel="noopener">알라딘</a>' +
                  '<a href="https://www.yes24.com/product/goods/180332209" class="ez-footer-book-btn" target="_blank" rel="noopener">예스24</a>' +
                  '<a href="https://ebook-product.kyobobook.co.kr/dig/epd/ebook/E000012611429" class="ez-footer-book-btn" target="_blank" rel="noopener">교보문고</a>' +
                  '<a href="https://ridibooks.com/books/3844000153" class="ez-footer-book-btn" target="_blank" rel="noopener">리디</a>' +
                '</div>' +
                '<span class="ez-footer-book-label">오디오북</span>' +
                '<div class="ez-footer-book-btns">' +
                  '<a href="https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=388954868&partner=friends327" class="ez-footer-book-btn" target="_blank" rel="noopener">알라딘</a>' +
                '</div>' +
                '<span class="ez-footer-book-label">구독</span>' +
                '<div class="ez-footer-book-btns">' +
                  '<a href="https://max.aladin.co.kr/product/387049914?&partner=friends327" class="ez-footer-book-btn" target="_blank" rel="noopener">알라딘</a>' +
                  '<a href="https://www.millie.co.kr/v4/book/52e27a74508a4c93" class="ez-footer-book-btn" target="_blank" rel="noopener">밀리</a>' +
                  '<a href="https://cremaclub.yes24.com/BookClub/Detail/180332209" class="ez-footer-book-btn" target="_blank" rel="noopener">예스24</a>' +
                  '<a href="https://ebook-product.kyobobook.co.kr/dig/epd/sam/E000012611429" class="ez-footer-book-btn" target="_blank" rel="noopener">교보</a>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="ez-footer-book">' +
              '<a href="https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=389499456&partner=friends327" class="ez-footer-book-cover" target="_blank" rel="noopener">' +
                '<img src="/book02_1.png" alt="월급쟁이 투자 자동화">' +
              '</a>' +
              '<div class="ez-footer-book-info">' +
                '<span class="ez-footer-book-title">월급쟁이<br>투자 자동화</span>' +
                '<span class="ez-footer-book-label">전자책</span>' +
                '<div class="ez-footer-book-btns">' +
                  '<a href="https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=389499456&partner=friends327" class="ez-footer-book-btn" target="_blank" rel="noopener">알라딘</a>' +
                  '<a href="https://www.yes24.com/product/goods/185275759" class="ez-footer-book-btn" target="_blank" rel="noopener">예스24</a>' +
                  '<a href="https://ebook-product.kyobobook.co.kr/dig/epd/ebook/E000012810587" class="ez-footer-book-btn" target="_blank" rel="noopener">교보문고</a>' +
                  '<a href="https://ridibooks.com/books/6121000386" class="ez-footer-book-btn" target="_blank" rel="noopener">리디</a>' +
                '</div>' +
                '<span class="ez-footer-book-label">오디오북</span>' +
                '<div class="ez-footer-book-btns">' +
                  '<a href="https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=391653601&partner=friends327" class="ez-footer-book-btn" target="_blank" rel="noopener">알라딘</a>' +
                '</div>' +
                '<span class="ez-footer-book-label">구독</span>' +
                '<div class="ez-footer-book-btns">' +
                  '<a href="https://max.aladin.co.kr/product/389499456?&partner=friends327" class="ez-footer-book-btn" target="_blank" rel="noopener">알라딘</a>' +
                  '<a href="https://www.millie.co.kr/v4/book/e7fbd96e137b4ae1" class="ez-footer-book-btn" target="_blank" rel="noopener">밀리</a>' +
                  '<a href="https://www.yes24.com/product/goods/185275759" class="ez-footer-book-btn" target="_blank" rel="noopener">예스24</a>' +
                  '<a href="https://ebook-product.kyobobook.co.kr/dig/epd/sam/E000012810587" class="ez-footer-book-btn" target="_blank" rel="noopener">교보</a>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="ez-footer-book">' +
              '<a href="https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=396190995" class="ez-footer-book-cover" target="_blank" rel="noopener">' +
                '<img src="/book03.png" alt="월급쟁이 투자자를 위한 AI 자동 투자 시스템">' +
              '</a>' +
              '<div class="ez-footer-book-info">' +
                '<span class="ez-footer-book-title">AI 자동<br>투자 시스템</span>' +
                '<span class="ez-footer-book-label">전자책</span>' +
                '<div class="ez-footer-book-btns">' +
                  '<a href="https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=396190995" class="ez-footer-book-btn" target="_blank" rel="noopener">알라딘</a>' +
                  '<a href="https://ebook-product.kyobobook.co.kr/dig/epd/ebook/E000013172896" class="ez-footer-book-btn" target="_blank" rel="noopener">교보문고</a>' +
                  '<a href="https://ridibooks.com/books/6121000541" class="ez-footer-book-btn" target="_blank" rel="noopener">리디</a>' +
                '</div>' +
                '<span class="ez-footer-book-label">구독</span>' +
                '<div class="ez-footer-book-btns">' +
                  '<a href="https://max.aladin.co.kr/product/396190995" class="ez-footer-book-btn" target="_blank" rel="noopener">알라딘</a>' +
                  '<a href="https://ebook-product.kyobobook.co.kr/dig/epd/sam/E000013172896" class="ez-footer-book-btn" target="_blank" rel="noopener">교보</a>' +
                  '<a href="https://www.millie.co.kr/v4/book/35c79b670e944931" class="ez-footer-book-btn" target="_blank" rel="noopener">밀리</a>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="ez-footer-bottom">' +
          /* 73항(2026-08-26): 소개·방침·약관·유의사항·문의는 사이트의 신뢰 근거다.
             푸터 어디서든 한 번에 닿아야 한다. */
          '<div class="ez-footer-legal">' +
            '<a href="/about.html">소개</a>' +
            '<a href="/privacy.html">개인정보처리방침</a>' +
            '<a href="/terms.html">이용약관</a>' +
            '<a href="/disclaimer.html">투자 유의사항</a>' +
            '<a href="/contact.html">문의</a>' +
          '</div>' +
          '© 2025–2026 유니아빠 · EZLONG · easy.invest.good@gmail.com<br>' +
          '본 서비스에서 제공하는 모든 시뮬레이션 수치는 참고용 추정치이며, 실제 투자 수익을 보장하지 않습니다. 투자 판단의 책임은 투자자 본인에게 있습니다.' +
        '</div>' +
      '</div>' +
    '</footer>';

  document.write(html);
})();
