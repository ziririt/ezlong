# -*- coding: utf-8 -*-
"""신뢰 페이지 생성기 (2026-08-26 신설, CLAUDE.md 73항).
애드센스 '가치 없는 콘텐츠' 판정의 원인 중 하나가 소개·약관·방침 부재였다.
손으로 다섯 장을 따로 관리하면 머리말이 어긋나므로 한 곳에서 찍어낸다."""
import os, json, html

BASE = 'https://ezlong.com'
OUT = '/home/claude/ezlong'
UPDATED = '2026-08-26'

HEAD = '''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="EZLONG">
<meta property="og:title" content="{ogtitle}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{base}/og/og-1200x630.png?v=20260809">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="{base}/og/og-1200x630.png?v=20260809">
<link rel="icon" href="/icons/favicon.ico?v=20260825" sizes="any">
<link rel="icon" type="image/svg+xml" href="/icons/favicon.svg?v=20260825">
<link rel="apple-touch-icon" href="/icons/pwa-180.png?v=20260809">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#f5f5f7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#080C18" media="(prefers-color-scheme: dark)">
<link rel="stylesheet" href="/ez-design.css">
<script type="application/ld+json">
{ld}
</script>
<style>
.tp-wrap{{max-width:760px;margin:0 auto;padding:26px 18px 70px}}
.tp-eyebrow{{font-size:14px;font-weight:800;letter-spacing:.12em;color:var(--ez-blue);text-transform:uppercase}}
.tp-h1{{font-size:30px;font-weight:800;letter-spacing:-.02em;line-height:1.25;margin:8px 0 12px;color:var(--ez-text)}}
.tp-lede{{font-size:17px;line-height:1.7;color:var(--ez-text2);margin:0 0 8px}}
.tp-meta{{font-size:14px;color:var(--ez-text3);margin:0 0 26px}}
.tp-wrap h2{{font-size:21px;font-weight:800;letter-spacing:-.01em;margin:34px 0 10px;color:var(--ez-text);
  padding-top:20px;border-top:1px solid var(--ez-border)}}
.tp-wrap h3{{font-size:17px;font-weight:800;margin:20px 0 6px;color:var(--ez-text)}}
.tp-wrap p{{font-size:16px;line-height:1.75;color:var(--ez-text2);margin:0 0 12px}}
.tp-wrap ul{{margin:0 0 14px;padding-left:20px}}
.tp-wrap li{{font-size:16px;line-height:1.75;color:var(--ez-text2);margin-bottom:6px}}
.tp-wrap b,.tp-wrap strong{{color:var(--ez-text);font-weight:800}}
.tp-wrap a{{color:var(--ez-blue)}}
.tp-note{{background:var(--ez-card2);border:1px solid var(--ez-border);border-radius:14px;
  padding:15px 17px;margin:18px 0}}
.tp-note p{{margin:0;font-size:15px}}
.tp-note p + p{{margin-top:8px}}
.tp-kv{{border-top:1px solid var(--ez-border);padding:11px 0;display:flex;gap:14px;flex-wrap:wrap}}
.tp-kv .k{{flex:0 0 130px;font-size:15px;font-weight:800;color:var(--ez-text)}}
.tp-kv .v{{flex:1 1 260px;font-size:15px;line-height:1.7;color:var(--ez-text2)}}
</style>
{banner}
</head>
<body>
<script src="/ez-nav.js"></script>
<main class="tp-wrap">
<div class="tp-eyebrow">{eyebrow}</div>
<h1 class="tp-h1">{h1}</h1>
<p class="tp-lede">{lede}</p>
<p class="tp-meta">최종 갱신 {updated} · 운영 EZLONG(유니아빠) · 문의 easy.invest.good@gmail.com</p>
{body}
</main>
<script src="/ez-footer.js"></script>
</body>
</html>
'''
BANNER = '<script src="/ez-app-banner.js"></script><!-- 앱 설치 배너 · 앱 웹뷰에서는 뜨지 않는다 (71항) -->'

def ld_for(name, url, desc, kind='WebPage'):
    return json.dumps({
        "@context": "https://schema.org",
        "@graph": [
            {"@type": kind, "name": name, "url": url, "description": desc, "inLanguage": "ko",
             "isPartOf": {"@type": "WebSite", "name": "EZLONG", "url": BASE + "/"},
             "publisher": {"@type": "Organization", "name": "EZLONG", "url": BASE + "/",
                           "email": "easy.invest.good@gmail.com"},
             "dateModified": UPDATED},
            {"@type": "BreadcrumbList", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "EZLONG", "item": BASE + "/"},
                {"@type": "ListItem", "position": 2, "name": name, "item": url}]}
        ]}, ensure_ascii=False, indent=1)

def write(fname, **kw):
    url = f'{BASE}/{fname}'
    kw.setdefault('ogtitle', kw['h1'])
    page = HEAD.format(base=BASE, url=url, updated=UPDATED, banner=BANNER,
                       ld=ld_for(kw['h1'], url, kw['desc'], kw.pop('ldkind', 'WebPage')), **kw)
    with open(os.path.join(OUT, fname), 'w', encoding='utf-8') as f:
        f.write(page)
    import re
    txt = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', kw['body'])).strip()
    print(f'{fname:18s} 본문 {len(txt):,}자')

# ─────────────────────────────────────────────────────────────── 소개
write('about.html',
 title='EZLONG 소개 — 누가, 왜, 어떻게 만드는가 | 미국주식 장기투자 도구',
 desc='ezlong.com을 누가 만들고 데이터를 어디서 가져오며 AI 판정을 어떻게 검증하는지 밝힙니다. 미국주식 ETF 투자서 3권을 쓴 개인투자자가 직접 운영합니다.',
 eyebrow='About', h1='EZLONG 소개',
 lede='이 사이트를 누가 만들고, 숫자를 어디서 가져오며, AI가 내린 판정을 어떻게 검증하는지 전부 적어 둡니다. 투자 판단에 쓰이는 도구라면 만든 사람과 만드는 방법이 먼저 투명해야 한다고 봅니다.',
 body='''
<h2>한 문장으로</h2>
<p>EZLONG(ezlong.com)은 <b>미국주식 장기투자자를 위한 무료 도구 모음</b>입니다. 회원가입도, 결제도, 앱 설치도 필요 없습니다. 복리·적립식·은퇴 목표 계산기부터 AI 시황 분석과 차트 진단까지, 제가 투자하면서 실제로 필요했던 것들을 하나씩 만들어 붙였습니다.</p>

<h2>누가 만드나</h2>
<p>개인투자자 <b>유니아빠</b>가 혼자 기획하고 운영합니다. 회사도, 팀도, 투자자문업 등록도 없습니다. 미국주식에 직접 투자하는 한 사람이 자기가 쓰려고 만든 도구를 공개해 둔 것입니다.</p>
<p>미국주식 투자에 관해 아래 책을 썼습니다. 교보문고·예스24·알라딘·리디·밀리에서 종이책, 전자책, 오디오북으로 판매·구독되고 있습니다.</p>
<ul>
<li><b>절대 실패하지 않는 미국 주식 ETF 투자</b></li>
<li><b>월급쟁이 투자 자동화</b></li>
<li><b>월급쟁이 투자자를 위한 AI 자동 투자 시스템</b></li>
</ul>
<p>이 책들에서 다룬 생각 — 타이밍을 맞히려 애쓰지 말고 구조를 만들라, 꾸준함은 사람이 아니라 기계가 지키게 하라 — 이 그대로 이 사이트의 설계 원칙입니다.</p>

<h2>무엇을 제공하나</h2>
<h3>시장을 읽는 도구</h3>
<ul>
<li><a href="/atmr-dashboard.html">스윙 시그널 대시보드</a> — QQQ·VOO·SOXX의 매수·매도 점수와 3-3-4 분할 진입 전략</li>
<li><a href="/market-vs.html">긍정 vs 부정 몇대몇</a> — 지금 시장을 움직이는 재료를 긍정·부정으로 나눠 점수화. 하루 다섯 번 갱신</li>
<li><a href="/chart-analysis.html">AI 차트분석</a> — 50여 종목의 RSI·MACD·볼린저밴드 해석</li>
<li><a href="/analyst-reports.html">월가 목표주가</a> · <a href="/market-cycle.html">마켓 사이클</a> · <a href="/stocks.html">심플 주가</a></li>
</ul>
<h3>계산하는 도구</h3>
<ul>
<li><a href="/dca-simulator.html">DCA 적립식 시뮬레이터</a> · <a href="/compound-calculator.html">복리 계산기</a></li>
<li><a href="/retirement-calculator.html">은퇴 목표 역산 계산기</a> · <a href="/backtest.html">몬테카를로 포트폴리오 시뮬레이터</a></li>
<li><a href="/tax-account-simulator.html">절세 계좌 세후 시뮬레이터</a>(연금저축·IRP·ISA) · <a href="/dc-rebalance.html">DC·IRP 안전자산 리밸런싱</a></li>
</ul>
<h3>읽는 글</h3>
<ul>
<li><a href="/tesla-monthly-dca-10years.html">테슬라 10년 적립식 백테스트</a> · <a href="/nvda-monthly-dca-5years.html">엔비디아 5년 적립식 백테스트</a></li>
<li><a href="/aapl-vs-msft-dividend-dca.html">애플 vs 마이크로소프트 배당 DCA 비교</a> · <a href="/fire-retirement-4percent-rule.html">FIRE와 4% 룰</a></li>
<li><a href="/isa-irp-us-stock-tax-comparison.html">ISA·IRP 미국주식 절세 비교</a> · <a href="/brief-history.html">그날 무슨 일이 있었나</a></li>
</ul>

<h2>숫자는 어디서 오나</h2>
<p>추정하거나 지어내지 않습니다. 전부 출처가 있는 값입니다.</p>
<div class="tp-kv"><div class="k">주가·지수·ETF</div><div class="v">Yahoo Finance 시세(yfinance). 프리마켓·정규장·시간외 세션을 구분해 표기합니다</div></div>
<div class="tp-kv"><div class="k">공식 매크로</div><div class="v">FRED(세인트루이스 연준) — CPI 상승률, 기준금리, 실업률, 기대인플레이션, 장단기 스프레드</div></div>
<div class="tp-kv"><div class="k">경제 일정</div><div class="v">미국 노동통계국(BLS), 경제분석국(BEA), 연방준비제도 공식 발표 일정표. 뉴욕 시간(ET)으로 표기합니다</div></div>
<div class="tp-kv"><div class="k">뉴스</div><div class="v">Alpha Vantage 금융뉴스 감성 데이터, Google News RSS</div></div>
<div class="tp-kv"><div class="k">AI 분석</div><div class="v">Google Gemini. 판정문을 쓰는 역할이고, 그 판정을 검증하는 것은 아래의 코드입니다</div></div>
<p>갱신 주기는 스윙 시그널 30분, AI 차트분석 매시, 긍정 vs 부정 하루 다섯 번입니다. 미국 증시가 열리는 날 기준입니다.</p>

<h2>AI가 쓴 판정을 그대로 내보내지 않습니다</h2>
<p>이 사이트에서 가장 공들인 부분입니다. AI는 그럴듯한 문장을 잘 쓰지만, 그럴듯한 것과 맞는 것은 다릅니다. 그래서 생성된 판정문은 게시되기 전에 <b>코드가 실측 데이터와 대조</b>합니다. 예를 들면 이런 것들입니다.</p>
<ul>
<li><b>사실 대조</b> — "유가 급등"이라고 썼는데 실제 WTI가 +0.1%면 그 재료는 점수를 잃습니다</li>
<li><b>원인과 결과 구분</b> — "반도체가 빠져서 부정"은 동어반복입니다. 주가가 움직인 것은 결과이고, 왜 움직였는지가 재료입니다</li>
<li><b>방향 없는 재료 금지</b> — 관망, 눈치보기, "발표를 기다린다"는 오르지도 내리지도 않습니다. 점수 칸이 아니라 혼조 칸으로 갑니다</li>
<li><b>일정 검증</b> — 예정 이벤트는 공식 일정표와 대조합니다. 2주 뒤 지표를 "곧"이라고 쓸 수 없습니다</li>
<li><b>극단 판정 방지</b> — 지수가 보합이고 변동성이 낮은 날 한쪽으로 쏠린 점수가 나오면 되돌립니다</li>
</ul>
<p>검사에 걸리면 사유를 붙여 다시 쓰게 하고, 그래도 남으면 코드가 직접 고칩니다. <b>고칠 수 없으면 그 판정은 게시하지 않습니다</b> — 틀린 카드를 내보내느니 직전 카드를 그대로 두는 쪽을 택합니다. 그리고 매일 아침, 지난 45일치 카드를 나란히 놓고 같은 주제가 편을 갈아탔는지, 점수만 고정된 채 이유가 바뀌었는지를 따로 감사합니다.</p>
<div class="tp-note">
<p>완벽하다는 뜻이 아닙니다. 지금까지 잡아낸 오류 대부분은 이용자가 먼저 발견했고, 그때마다 사람이 고치는 대신 <b>같은 오류를 두 번 못 내게 하는 검사</b>를 코드로 추가해 왔습니다. 오류를 보시면 알려 주십시오 — 그게 이 사이트가 나아지는 방식입니다.</p>
</div>

<h2>하지 않는 것</h2>
<ul>
<li><b>매수·매도를 권하지 않습니다.</b> "지금 사세요" 같은 문장은 쓰지 않습니다. 상태를 진단해 보여 줄 뿐, 판단과 책임은 이용자에게 있습니다</li>
<li><b>유료 상품을 팔지 않습니다.</b> 리딩방, 종목 추천, 유료 구독이 없습니다</li>
<li><b>개인정보를 모으지 않습니다.</b> 계산기와 시뮬레이터에 입력한 금액은 브라우저 안에서만 계산되고 서버로 전송되지 않습니다</li>
</ul>
<p>자세한 내용은 <a href="/disclaimer.html">투자 유의사항</a>과 <a href="/privacy.html">개인정보처리방침</a>에 적어 두었습니다.</p>

<h2>연락</h2>
<p>오류 제보, 데이터 정정 요청, 기능 제안, 제휴 문의 모두 <a href="mailto:easy.invest.good@gmail.com">easy.invest.good@gmail.com</a>으로 받습니다. 자세한 안내는 <a href="/contact.html">문의</a> 페이지에 있습니다.</p>
''')

# ─────────────────────────────────────────────────────── 개인정보처리방침
write('privacy.html',
 title='개인정보처리방침 | EZLONG',
 desc='ezlong.com이 수집하는 정보와 수집하지 않는 정보, 쿠키와 구글 애널리틱스·애드센스 사용, 이용자의 권리와 요청 방법을 안내합니다.',
 eyebrow='Privacy', h1='개인정보처리방침',
 lede='EZLONG(ezlong.com)은 이용자의 개인정보를 최소한으로만 다룹니다. 무엇을 모으지 않는지부터 밝히는 편이 정확하다고 봅니다.',
 body='''
<h2>1. 모으지 않는 것</h2>
<p>이 점을 먼저 적습니다. EZLONG은 서비스 이용을 위해 <b>회원가입을 요구하지 않으며, 이름·전화번호·주소·주민등록번호·계좌번호 등 개인을 식별하는 정보를 수집하지 않습니다.</b></p>
<p>계산기와 시뮬레이터에 입력하시는 <b>투자 금액, 나이, 연봉 구간, 목표 금액, 보유 종목</b>은 전부 이용자의 브라우저 안에서만 계산되며 <b>서버로 전송되지도, 저장되지도 않습니다.</b> 창을 닫으면 사라집니다.</p>

<h2>2. 자동으로 수집되는 정보</h2>
<p>웹사이트를 운영하기 위해 아래 정보가 자동으로 처리됩니다. 개인을 특정하려는 목적이 아니라 통계와 서비스 운영을 위한 것입니다.</p>
<div class="tp-kv"><div class="k">접속 기록</div><div class="v">IP 주소, 브라우저 종류와 버전, 운영체제, 방문 일시, 방문한 페이지, 유입 경로</div></div>
<div class="tp-kv"><div class="k">기기 저장소</div><div class="v">언어 선택(ezlong_lang_choice), 배너 닫음 여부 등 이용 편의를 위한 값. 브라우저의 로컬 저장소에 남으며 서버로 전송되지 않습니다</div></div>
<div class="tp-kv"><div class="k">보유 기간</div><div class="v">분석 도구 제공사의 기본 보관 기간에 따르며, 목적 달성 후 파기됩니다</div></div>

<h2>3. 쿠키와 제3자 서비스</h2>
<h3>3-1. 구글 애널리틱스 (Google Analytics 4)</h3>
<p>어느 페이지가 얼마나 읽히는지 파악하기 위해 구글 애널리틱스를 사용합니다(측정 ID: G-8DY4BGP444). 방문 통계는 집계된 형태로만 확인하며 개별 이용자를 식별하지 않습니다. 수집을 원하지 않으시면 <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener nofollow">구글 애널리틱스 차단 브라우저 부가기능</a>을 설치하실 수 있습니다.</p>
<h3>3-2. 구글 애드센스 (광고)</h3>
<p>EZLONG은 운영 비용을 충당하기 위해 구글 애드센스 광고를 게재할 수 있습니다. 이때 다음 사항이 적용됩니다.</p>
<ul>
<li>구글을 포함한 제3자 공급업체는 <b>쿠키를 사용해 이용자의 이전 방문 기록을 바탕으로 광고를 게재</b>할 수 있습니다.</li>
<li>구글이 광고 쿠키를 사용함으로써 이용자에게 이 사이트 및 다른 사이트 방문 기록에 기반한 광고를 표시할 수 있습니다.</li>
<li>이용자는 <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener nofollow">광고 설정</a>에서 개인 맞춤 광고를 사용 중지할 수 있습니다. 또는 <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener nofollow">www.aboutads.info</a>에서 제3자 공급업체의 쿠키 사용을 차단할 수 있습니다.</li>
</ul>
<h3>3-3. 구글 파이어베이스 (게시판)</h3>
<p>투자 인사이트 게시판에 글을 쓰시는 경우에 한해 구글 파이어베이스(Firestore·Authentication)를 통해 <b>작성한 글의 내용과 작성 시각, 로그인에 사용한 계정 식별자</b>가 저장됩니다. 게시판을 이용하지 않으시면 이 항목은 수집되지 않습니다.</p>
<h3>3-4. 호스팅·전송</h3>
<p>사이트는 Google Firebase Hosting과 Cloudflare를 통해 제공됩니다. 이 과정에서 접속 IP 등 통신 기록이 처리될 수 있습니다.</p>

<h2>4. 제3자 제공과 위탁</h2>
<p>EZLONG은 이용자의 정보를 제3자에게 판매하거나 대여하지 않습니다. 위 3항에 적은 서비스 제공사(구글, Cloudflare)를 통한 처리 외에 별도의 제공·위탁은 없습니다. 법령에 따른 적법한 요청이 있는 경우에만 예외가 적용됩니다.</p>

<h2>5. 이용자의 권리</h2>
<ul>
<li>브라우저 설정에서 <b>쿠키 저장을 거부</b>하실 수 있습니다. 다만 일부 기능(언어 선택 기억 등)이 정상 동작하지 않을 수 있습니다.</li>
<li>브라우저의 저장 데이터 삭제로 이 사이트가 기기에 남긴 값을 <b>언제든 지울 수 있습니다.</b></li>
<li>게시판에 작성한 글의 <b>열람·수정·삭제</b>를 요청하실 수 있습니다. 아래 연락처로 요청하시면 확인 후 처리합니다.</li>
</ul>

<h2>6. 만 14세 미만 아동</h2>
<p>EZLONG은 만 14세 미만 아동을 대상으로 하지 않으며, 아동의 개인정보를 알면서 수집하지 않습니다.</p>

<h2>7. 문의 및 책임자</h2>
<p>개인정보 관련 문의·열람·정정·삭제 요청은 아래로 보내 주시면 확인 후 회신드립니다.</p>
<div class="tp-note">
<p><b>개인정보 보호책임자</b> · EZLONG 운영자(유니아빠)</p>
<p><b>이메일</b> · <a href="mailto:easy.invest.good@gmail.com">easy.invest.good@gmail.com</a></p>
</div>

<h2>8. 방침의 변경</h2>
<p>이 방침이 바뀌면 이 페이지에 갱신일과 함께 게시합니다. 중요한 변경은 시행 전에 알립니다.</p>
''')

# ─────────────────────────────────────────────────────────────── 이용약관
write('terms.html',
 title='이용약관 | EZLONG',
 desc='ezlong.com이 제공하는 서비스의 성격, 이용 조건, 저작권, 책임의 한계를 안내합니다.',
 eyebrow='Terms', h1='이용약관',
 lede='EZLONG(ezlong.com, 이하 "사이트")을 이용하시면 아래 조건에 동의하신 것으로 봅니다. 어려운 말을 줄이고 실제로 지켜야 할 것만 적었습니다.',
 body='''
<h2>제1조 (서비스의 성격)</h2>
<p>사이트는 미국주식 장기투자에 참고할 수 있는 <b>정보와 계산 도구를 무료로 제공</b>합니다. 사이트는 금융투자업자나 투자자문업자가 아니며, 어떠한 형태의 투자자문·투자일임·금융상품 판매도 하지 않습니다.</p>

<h2>제2조 (이용 조건)</h2>
<ul>
<li>회원가입 없이 누구나 이용할 수 있습니다. 게시판 등 일부 기능은 로그인이 필요합니다.</li>
<li>이용료는 없습니다. 사이트는 광고 수익으로 운영될 수 있습니다.</li>
<li>사이트는 서비스의 내용·구성을 사전 통지 없이 변경하거나 중단할 수 있습니다.</li>
</ul>

<h2>제3조 (금지 행위)</h2>
<ul>
<li>자동화된 수단으로 과도한 트래픽을 발생시켜 서비스 운영을 방해하는 행위</li>
<li>사이트의 데이터·분석 결과를 <b>출처 표시 없이 복제·재배포</b>하거나 상업적으로 이용하는 행위</li>
<li>게시판에 타인의 권리를 침해하거나 법령을 위반하는 글을 올리는 행위</li>
<li>사이트의 정보를 마치 투자 권유나 수익 보장인 것처럼 인용·가공해 제3자에게 전달하는 행위</li>
</ul>

<h2>제4조 (저작권)</h2>
<p>사이트에 게시된 글, 분석, 도구, 디자인의 저작권은 운영자에게 있습니다. 개인적·비상업적 목적의 인용은 출처(ezlong.com)를 밝히는 조건으로 허용합니다. 그 외의 복제·배포·2차적 저작물 작성은 사전 동의가 필요합니다.</p>
<p>주가·지표 등 원본 데이터의 권리는 각 제공처(Yahoo Finance, FRED, Alpha Vantage 등)에 있으며, 사이트는 이를 참고용으로 가공해 표시합니다.</p>

<h2>제5조 (게시물)</h2>
<p>이용자가 게시판에 올린 글의 책임은 작성자에게 있습니다. 운영자는 법령 위반, 타인의 권리 침해, 광고성 게시물에 해당하는 글을 사전 통지 없이 삭제할 수 있습니다.</p>

<h2>제6조 (책임의 한계)</h2>
<ul>
<li>사이트가 제공하는 정보는 <b>참고용</b>입니다. 정확성·완전성·적시성을 보증하지 않습니다.</li>
<li>데이터는 제3자 제공처에서 받아 표시하며, <b>지연·누락·오류가 있을 수 있습니다.</b></li>
<li>사이트의 정보를 근거로 한 <b>투자 판단과 그 결과에 대한 책임은 전적으로 이용자에게 있습니다.</b></li>
<li>운영자는 서비스 이용으로 발생한 직접·간접 손해에 대해 관련 법령이 허용하는 범위에서 책임을 지지 않습니다.</li>
</ul>
<p>자세한 내용은 <a href="/disclaimer.html">투자 유의사항</a>을 함께 읽어 주십시오.</p>

<h2>제7조 (약관의 변경)</h2>
<p>약관이 바뀌면 이 페이지에 갱신일과 함께 게시하며, 게시 후 계속 이용하시면 변경에 동의하신 것으로 봅니다.</p>

<h2>제8조 (준거법)</h2>
<p>이 약관은 대한민국 법령에 따라 해석됩니다.</p>
''')

# ─────────────────────────────────────────────────────── 투자 유의사항
write('disclaimer.html',
 title='투자 유의사항 — 이 사이트의 정보를 어떻게 읽어야 하나 | EZLONG',
 desc='EZLONG의 분석과 계산 결과가 무엇이고 무엇이 아닌지, AI 판정과 백테스트 수치를 읽을 때 주의할 점을 밝힙니다. 투자 판단과 책임은 이용자에게 있습니다.',
 eyebrow='Disclaimer', h1='투자 유의사항',
 lede='이 사이트의 숫자를 어떻게 읽어야 하는지 적어 둡니다. 형식적인 면책 문구가 아니라, 실제로 오해하기 쉬운 지점을 짚는 글로 썼습니다.',
 body='''
<h2>먼저, 이것부터</h2>
<p>EZLONG은 <b>투자자문업자가 아닙니다.</b> 자본시장법상 투자자문업·투자일임업 등록을 하지 않았고, 개별 이용자의 상황에 맞춘 조언을 하지 않습니다. 이 사이트의 모든 내용은 <b>정보 제공과 학습 목적</b>이며, 특정 종목의 매수·매도 권유가 아닙니다.</p>
<p><b>투자 판단과 그 결과에 대한 책임은 전적으로 이용자 본인에게 있습니다.</b> 원금 손실이 발생할 수 있습니다.</p>

<h2>AI 분석을 어떻게 읽어야 하나</h2>
<p>'긍정 vs 부정 몇대몇', 'AI 차트분석', '스윙 시그널' 등은 AI가 시장 데이터와 뉴스를 읽고 만든 <b>진단</b>입니다. 예측이 아닙니다. 아래를 염두에 두고 보십시오.</p>
<ul>
<li><b>점수는 정밀 측정값이 아닙니다.</b> 65점과 70점의 차이에 의미를 두지 마십시오. 어느 쪽이 우세한지, 그 이유가 무엇인지를 보는 도구입니다.</li>
<li><b>재료는 바뀝니다.</b> 시황 분석은 하루 여러 번 갱신되며, 새 사건이 생기면 판정이 달라집니다. 과거 카드는 그 시점의 판단이지 지금의 판단이 아닙니다.</li>
<li><b>AI는 틀립니다.</b> 사이트는 생성된 판정을 실측 데이터와 대조하는 검증 장치를 여러 겹 두고 있지만(<a href="/about.html">소개</a> 참고), 그것으로도 걸러지지 않는 오류가 있을 수 있습니다.</li>
<li><b>기술적 지표는 과거의 가격에서 계산됩니다.</b> RSI·MACD·이동평균은 이미 일어난 일을 요약한 값이며, 앞으로 일어날 일을 알려 주지 않습니다.</li>
</ul>

<h2>백테스트와 시뮬레이터를 어떻게 읽어야 하나</h2>
<p>'테슬라 10년 적립식', '몬테카를로 포트폴리오' 같은 계산 결과에는 다음 한계가 있습니다.</p>
<ul>
<li><b>과거 수익률은 미래를 보장하지 않습니다.</b> 지난 10년 특정 종목이 잘한 것은 그 기간의 사실일 뿐입니다. 살아남아 좋은 성과를 낸 종목만 사후에 골라 보게 되는 편향(생존자 편향)에 특히 주의하십시오.</li>
<li><b>세금·수수료·환율이 반영되지 않거나 단순화됩니다.</b> 실제 계좌의 수익률은 계산기의 숫자보다 낮은 것이 보통입니다.</li>
<li><b>배당 재투자, 매수 시점, 환전 타이밍</b> 등 가정이 결과를 크게 바꿉니다. 각 페이지에 적힌 가정을 확인하십시오.</li>
<li><b>절세 계좌 계산은 현행 세법 기준</b>이며 세법은 바뀝니다. 실제 절세 여부는 개인의 소득·공제 상황에 따라 다르므로 세무 전문가와 상의하십시오.</li>
</ul>

<h2>데이터의 한계</h2>
<ul>
<li>주가는 <b>실시간이 아닐 수 있으며</b> 제공처 사정에 따라 지연·누락될 수 있습니다. 실제 주문은 반드시 증권사 시세로 확인하십시오.</li>
<li>매크로 지표는 발표 시점과 데이터가 가리키는 기간이 다릅니다. 예를 들어 8월에 발표되는 CPI는 7월분입니다.</li>
<li>예정 이벤트 일정은 공식 발표 기준으로 표기하지만, 주최 측 사정으로 변경될 수 있습니다.</li>
</ul>

<h2>이 사이트가 하지 않는 것</h2>
<ul>
<li>"지금 사세요", "여기서 파세요" 같은 지시형 문장을 쓰지 않습니다.</li>
<li>수익을 보장하거나 목표 수익률을 약속하지 않습니다.</li>
<li>종목 추천 서비스, 리딩방, 유료 시그널을 운영하지 않습니다.</li>
<li>이용자의 계좌·자산 정보를 요구하지 않습니다. <b>누군가 EZLONG을 사칭해 이런 것을 요구하면 사기입니다.</b></li>
</ul>

<h2>오류를 발견하시면</h2>
<p>숫자가 이상하거나 분석이 사실과 다르면 <a href="mailto:easy.invest.good@gmail.com">easy.invest.good@gmail.com</a>으로 알려 주십시오. 확인 후 고치고, 같은 오류가 다시 나지 않도록 검증 장치를 보강합니다.</p>
''')

# ─────────────────────────────────────────────────────────────── 문의
write('contact.html',
 title='문의 — 오류 제보·정정 요청·제휴 | EZLONG',
 desc='ezlong.com에 오류를 제보하거나 데이터 정정, 기능 제안, 제휴를 문의하는 방법과 처리 절차를 안내합니다.',
 eyebrow='Contact', h1='문의',
 lede='한 사람이 운영하는 사이트라 창구는 이메일 하나입니다. 대신 보내 주신 내용은 제가 직접 읽고 처리합니다.',
 body='''
<h2>이메일</h2>
<div class="tp-note">
<p><b>easy.invest.good@gmail.com</b></p>
<p>운영 EZLONG(유니아빠) · 보통 2~3일 안에 회신드립니다.</p>
</div>

<h2>무엇을 보내시면 되나</h2>
<h3>1. 오류 제보 — 가장 환영합니다</h3>
<p>숫자가 이상하거나, 분석이 사실과 다르거나, 화면이 깨져 보이면 알려 주십시오. 이 사이트의 검증 장치 대부분은 <b>이용자가 먼저 발견한 오류</b>에서 만들어졌습니다. 아래를 함께 적어 주시면 훨씬 빨리 고칠 수 있습니다.</p>
<ul>
<li>어느 페이지인지 (주소를 복사해 주시면 좋습니다)</li>
<li>언제 보셨는지 (분석 카드는 시각마다 내용이 다릅니다)</li>
<li>무엇이 이상한지 — 가능하면 화면 사진</li>
<li>사용 기기와 브라우저 (아이폰 사파리, 안드로이드 크롬 등)</li>
</ul>

<h3>2. 데이터 정정 요청</h3>
<p>표시된 주가·지표·기업 정보가 사실과 다르면 근거와 함께 보내 주십시오. 확인되는 대로 정정합니다. 다만 이미 게시된 과거 시황 분석은 <b>그 시점의 판단으로 그대로 남겨 둡니다</b> — 지나간 판정을 조용히 고쳐 쓰는 쪽이 더 나쁘다고 보기 때문입니다. 대신 잘못된 사실 자체는 바로잡습니다.</p>

<h3>3. 기능 제안</h3>
<p>"이런 계산기가 있으면 좋겠다", "이 도구에 이런 항목을 넣어 달라" 같은 제안을 받습니다. 실제로 이 사이트의 여러 도구가 그렇게 만들어졌습니다.</p>

<h3>4. 개인정보 관련 요청</h3>
<p>게시판에 쓰신 글의 열람·수정·삭제 요청은 같은 주소로 보내 주십시오. 자세한 내용은 <a href="/privacy.html">개인정보처리방침</a>에 있습니다.</p>

<h3>5. 제휴·인용·취재</h3>
<p>콘텐츠 인용, 제휴, 인터뷰 요청도 같은 주소로 받습니다. 인용은 출처(ezlong.com)를 밝혀 주시면 개인적·비상업적 범위에서 자유롭게 하실 수 있습니다(<a href="/terms.html">이용약관</a> 제4조).</p>

<h2>답변드리기 어려운 것</h2>
<ul>
<li><b>개별 종목 상담.</b> "지금 사도 되나요", "제 포트폴리오를 봐 주세요" 같은 질문에는 답하지 않습니다. 투자자문업자가 아니기 때문입니다(<a href="/disclaimer.html">투자 유의사항</a>).</li>
<li><b>수익률 예측.</b> 앞으로 오를지 내릴지는 저도 모릅니다.</li>
<li><b>세무·법률 상담.</b> 절세 계좌 계산기는 참고용이며, 실제 판단은 세무 전문가와 상의하십시오.</li>
</ul>

<h2>운영자에 대해</h2>
<p>누가 만들고 어떤 원칙으로 운영하는지는 <a href="/about.html">소개</a> 페이지에 적어 두었습니다.</p>
''')
