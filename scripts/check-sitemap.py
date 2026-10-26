#!/usr/bin/env python3
"""사이트맵에 올린 것이 **이 사이트의 것이고 볼 것이 있는지** 배포 전에 본다.

왜 있나 (2026-09-15)
  2026-08-26 에 얇은 도구 페이지 11장을 채워 '1,200자 미만 없음'을 만들었다.
  사흘 뒤 앱 소개 페이지 15장이 새로 색인에 들어왔고, 그중 하나는 렌더해도
  0자였다. 그 상태로 재검토를 신청해 애드센스가 두 번째로 거절했다.
  채우는 일은 했는데 **다시 얇아지는 것을 보는 눈**이 없었다. 이 검사가 그 눈이다.

무엇을 보나 - 확실한 결함 여섯만 본다. 애매한 판정은 사람에게 넘긴다.
  1) 사이트맵에 있는데 noindex 다        — 서로 반대되는 말을 하고 있다
  2) 사이트맵에 있는데 파일이 없다        — 404 를 색인해 달라고 내놓은 셈
  3) 사이트맵에 있는데 정적 본문이 너무 짧다 — 렌더하면 두꺼운 페이지는 예외 목록에 둔다
  4) 사이트맵에 이 사이트의 주제가 아닌 경로가 있다 (2026-09-15 오너 지적)

     "ezlong.com 은 미국 주식 툴 관련 사항만 사이트맵에 있어야지, 같은 호스팅을 쓰는
      다른 서비스의 소개페이지를 ezlong.com 서비스에 속한다고 할 수 없다."

     같은 호스팅에 얹혀 있을 뿐인 앱 소개·개인정보처리방침은 이 사이트의 콘텐츠가
     아니다. 사이트맵은 "이 사이트의 주제는 이것"이라는 선언이다. 분량이 넉넉해도
     주제가 다르면 뺀다 — 색인까지 막지는 않는다(검색에서 찾아지는 편이 앱에 낫다).

     2026-09-15 정정: 처음에 /app/ 과 /skybluenote/* 에 noindex 까지 걸었다가
     되돌렸다. 오너 지시 원문 — "robots.txt 로 막지는 말고, ezlong.com 의
     사이트맵에서만 빼라." **사이트맵에서 빼는 것과 색인을 막는 것은 다른 일이다.**
     여기에 걸린다고 색인을 막지 않는다. 이 목록은 사이트맵만 본다.
  5) 사이트맵(본 주소·hreflang 대체 주소)에 있는데 firebase.json 이 다른 곳으로 보낸다
  6) 사이트맵에 있는데 그 페이지의 canonical 이 다른 주소를 가리킨다

     5·6 은 2026-10-27 추가. 서치콘솔이 '사이트맵에 포함된 페이지의 색인이 생성되지
     않습니다' 메일을 보냈다. 원인은 10-19 에 숨긴 페이지(301)의 번역판 셋이었다.
     그때는 사이트맵에서도 함께 뺐지만, 둘 중 하나만 했으면 이 경고가 계속 왔을 것이다.
     **리디렉션을 걸 때는 사이트맵에서도 뺀다. 사이트맵에는 200 으로 끝나는 주소만 싣는다.**
     canonical 이 다른 곳을 가리키면 구글은 '적절한 표준 태그가 포함된 대체 페이지'로
     분류하고 색인하지 않는다. 사이트맵이 '이 주소를 색인하라'고 하면서 페이지는
     '저 주소가 진짜'라고 하는 셈이다.

정적 글자수만 센다. 렌더까지 하려면 브라우저가 필요해 배포 앞단에 두기 무겁다.
대신 '정적이 짧은데 예외 목록에 없는' 페이지를 잡아 사람이 렌더로 확인하게 한다.

실행: python3 scripts/check-sitemap.py        (통과 0, 실패 1)
      python3 scripts/check-sitemap.py --list (전수 글자수만 출력)
"""
import fnmatch, json, os, re, sys, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIN_STATIC = 300          # 이보다 짧으면 렌더로 확인해야 한다

# 이 사이트의 것이 아닌 경로. 같은 호스팅을 쓸 뿐인 별개 서비스다.
# 사이트맵에서만 뺀다 - 이 목록에 있다고 noindex 를 거는 것은 아니다.
OFF_TOPIC = [
    ('/skybluenote/',        'Skyblue Note 앱 (별개 프로젝트)'),
    ('/time/',               'Long Time, Easy Life 앱'),
    ('/longtime/',           'Long Time, Easy Life 앱 소개'),
    ('/app/',                '앱 모아보기'),
    ('/flip-clock-alarm',    '플립시계 기상 알람 앱 소개'),
    ('/send',                '1분 파일 (send.ezlong.com 으로 옮겼다 · 여기는 301 안내만 한다)\n                              사이트맵은 send.ezlong.com/sitemap.xml 에 따로 있다'),
]

# 정적은 짧지만 렌더하면 충분한 페이지. 넣을 때는 렌더 글자수를 주석에 남긴다.
RENDER_OK = {
    '/market-vs.html':   '렌더 7,140자 (2026-09-15 실측)',
    '/today-chart.html': '렌더 32,154자 (2026-09-15 실측)',
    '/stocks.html':      '렌더 2,712자 (2026-09-15 실측)',
}

def static_text_len(html: str) -> int:
    b = re.sub(r'<script[\s\S]*?</script>', ' ', html, flags=re.I)
    b = re.sub(r'<style[\s\S]*?</style>', ' ', b, flags=re.I)
    b = re.sub(r'<!--[\s\S]*?-->', ' ', b)
    b = re.sub(r'<[^>]+>', ' ', b)
    b = re.sub(r'&[a-z]+;|&#\d+;', ' ', b)
    return len(re.sub(r'\s+', ' ', b).strip())

def local_path(url: str):
    path = urllib.parse.unquote(urllib.parse.urlparse(url).path)
    rel = path.lstrip('/')
    if rel == '' or rel.endswith('/'):
        rel += 'index.html'
    return path, os.path.join(ROOT, rel)

def redirect_sources():
    """firebase.json 의 리디렉션 출발지(glob). ':param' 이 든 패턴은 건너뛴다."""
    try:
        doc = json.load(open(os.path.join(ROOT, 'firebase.json'), encoding='utf-8'))
    except Exception:
        return []
    hosting = doc.get('hosting') or {}
    hostings = hosting if isinstance(hosting, list) else [hosting]
    out = []
    for h in hostings:
        for r in h.get('redirects') or []:
            src = r.get('source') or ''
            if src and ':' not in src:
                out.append((src, r.get('destination', '')))
    return out

def redirected(path, sources):
    for src, dst in sources:
        if path == src or fnmatch.fnmatchcase(path, src.replace('**', '*')):
            return dst
    return None

def canonical_of(html):
    for tag in re.findall(r'<link[^>]+>', html, re.I):
        if re.search(r'rel=["\']canonical["\']', tag, re.I):
            m = re.search(r'href=["\']([^"\']+)', tag, re.I)
            return m.group(1) if m else None
    return None

def same_url(a, b):
    def norm(u):
        p = urllib.parse.urlparse(urllib.parse.urljoin('https://ezlong.com/', u))
        path = p.path or '/'
        if path.endswith('/index.html'):
            path = path[:-len('index.html')]
        return (p.netloc.lower().removeprefix('www.'), path)
    return norm(a) == norm(b)

def main():
    sm = open(os.path.join(ROOT, 'sitemap.xml'), encoding='utf-8').read()
    urls = re.findall(r'<loc>([^<]+)</loc>', sm)
    alts = re.findall(r'<xhtml:link[^>]*href="([^"]+)"', sm)
    listing = '--list' in sys.argv
    rows, fails = [], []

    sources = redirect_sources()
    for u in sorted(set(urls) | set(alts)):
        path = urllib.parse.unquote(urllib.parse.urlparse(u).path)
        dst = redirected(path, sources)
        if dst:
            fails.append(f'사이트맵에 있는데 리디렉션된다: {path} -> {dst}'
                         '  (사이트맵에서 빼거나 hreflang 을 도착 주소로 바꾼다)')

    for u in urls:
        path, fp = local_path(u)
        off = next((why for pre, why in OFF_TOPIC if path.startswith(pre)), None)
        if off:
            fails.append(f'이 사이트의 주제가 아니다: {path}  ({off})'
                         '  — 사이트맵에서 뺀다. 색인까지 막을 필요는 없다')
            continue
        if not os.path.isfile(fp):
            fails.append(f'파일이 없다: {path}')
            continue
        html = open(fp, encoding='utf-8', errors='replace').read()
        if re.search(r'<meta[^>]+name=["\']robots["\'][^>]*content=["\'][^"\']*noindex', html, re.I):
            fails.append(f'사이트맵에 있는데 noindex 다: {path}')
            continue
        canon = canonical_of(html)
        if canon and not same_url(canon, u):
            fails.append(f'사이트맵에 있는데 canonical 이 다른 주소다: {path} -> {canon}')
        n = static_text_len(html)
        rows.append((n, path))
        if n < MIN_STATIC and path not in RENDER_OK:
            fails.append(f'정적 본문 {n}자로 너무 짧다: {path}'
                         '  (렌더하면 충분하다면 RENDER_OK 에 렌더 글자수와 함께 등록한다)')

    if listing:
        for n, path in sorted(rows):
            print(f'{n:>7}  {path}')
        print(f'\n사이트맵 {len(urls)}장 · 검사 대상 {len(rows)}장')
        return 0

    print(f'사이트맵 {len(urls)}장 검사')
    if fails:
        print(f'\n실패 {len(fails)}건')
        for f in fails:
            print('  · ' + f)
        return 1
    thin = sorted(rows)[:3]
    print('통과. 가장 짧은 셋: ' + ' · '.join(f'{p}({n}자)' for n, p in thin))
    return 0

if __name__ == '__main__':
    sys.exit(main())
