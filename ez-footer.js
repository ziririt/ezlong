/**
 * ez-footer.js — EZLONG 글로벌 푸터 공유 스크립트
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
          '<a href="/market-vs.html" class="ez-footer-nav-item">긍정 vs 부정 몇대몇</a>' +
          '<a href="/stocks.html" class="ez-footer-nav-item">심플 주가 정보</a>' +
          '<a href="/chart-analysis.html" class="ez-footer-nav-item">AI 차트분석</a>' +
          '<a href="/analyst-reports.html" class="ez-footer-nav-item">핵심기업 목표주가</a>' +
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

        '<div class="ez-footer-top">' +
          '<div class="ez-footer-brand">' +
            '<picture>' +
              '<source srcset="/logo-darkmode.png" media="(prefers-color-scheme: dark)">' +
              '<img src="/logo.png" alt="EZLONG">' +
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
          '© 2025–2026 유니아빠 · EZLONG · easy.invest.good@gmail.com<br>' +
          '본 서비스에서 제공하는 모든 시뮬레이션 수치는 참고용 추정치이며, 실제 투자 수익을 보장하지 않습니다. 투자 판단의 책임은 투자자 본인에게 있습니다.' +
        '</div>' +
      '</div>' +
    '</footer>';

  document.write(html);
})();
