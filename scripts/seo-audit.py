#!/usr/bin/env python3
# SEO·AEO 전수 점검 (2026-08-26 신설, 성동님 지시 "SEO 및 AEO 최적화 점검").
# 전 언어판 HTML의 title·description 길이, canonical, hreflang, OG/트위터 카드,
# JSON-LD, h1, sitemap 등재, noindex 일관성을 훑는다. 발견만 하고 고치지 않는다.
# 사용: python3 scripts/seo-audit.py   (저장소 루트에서)
import os, re, json, glob, html
ROOT = '.'
LANGS = {'': 'ko', 'en': 'en', 'ja': 'ja', 'es': 'es', 'pt': 'pt', 'zh': 'zh'}
SKIP = {'_template.html','_og-render.html','admin.html','gauge-preview.html',
        'ez-style-guide.html','tv-inbox.html','swing-signal-mockup.html'}

def head_of(p):
    s = open(p, encoding='utf-8', errors='replace').read()
    m = re.search(r'</head>', s, re.I)
    return s[:m.end()] if m else s[:8000], s

def attr(tag, name):
    # (?<![-\w]) — 'content='가 'data-i18n-content=' 안에서 잡히던 오탐 방지(2026-08-26)
    m = re.search(r'(?<![-\w])' + name + r'\s*=\s*["\']([^"\']*)["\']', tag, re.I)
    return m.group(1) if m else None

def tags(head, pat):
    return re.findall(pat, head, re.I)

sitemap = open(os.path.join(ROOT,'sitemap.xml')).read()
smap_urls = set(re.findall(r'<loc>([^<]+)</loc>', sitemap))
llms = open(os.path.join(ROOT,'llms.txt')).read()

# 서브디렉터리 단독 페이지 — 2차 점검(2026-08-26)에서 편입. (경로, 언어)
EXTRA = [('app/index.html','ko'), ('time/index.html','ko'), ('time/privacy.html','ko'),
         ('time/privacy-en.html','en'), ('skybluenote/index.html','ko'),
         ('skybluenote/app/index.html','ko'), ('skybluenote/privacy/index.html','ko'),
         ('skybluenote/web/index.html','ko'), ('kis-portfolio/index.html','ko'),
         ('life-signal/index.html','ko'), ('life-signal/today.html','ko'),
         ('life-signal/result.html','ko'), ('life-signal/import.html','ko'),
         ('life-signal/test.html','ko')]

pages = []
for rel, lang in EXTRA:
    p2 = os.path.join(ROOT, rel)
    if os.path.exists(p2):
        pages.append((rel, lang, p2))
for d, lang in LANGS.items():
    for p in sorted(glob.glob(os.path.join(ROOT, d, '*.html') if d else os.path.join(ROOT,'*.html'))):
        base = os.path.basename(p)
        if base in SKIP or base.endswith('.bak'): continue
        rel = (d + '/' if d else '') + base
        pages.append((rel, lang, p))

report = {}
og_missing_files = set()
for rel, lang, p in pages:
    head, full = head_of(p)
    url = 'https://ezlong.com/' + rel
    issues = []
    info = {}
    # lang attr
    m = re.search(r'<html[^>]*\blang\s*=\s*["\']([^"\']+)', full[:300], re.I)
    info['lang'] = m.group(1) if m else None
    if not m: issues.append('html lang 없음')
    elif not m.group(1).lower().startswith(lang if lang!='zh' else 'zh'): issues.append(f"lang 불일치({m.group(1)}≠{lang})")
    # title
    t = re.search(r'<title[^>]*>(.*?)</title>', head, re.I|re.S)
    title = html.unescape(t.group(1).strip()) if t else None
    info['title'] = title
    if not title: issues.append('title 없음')
    elif len(title) > 70: issues.append(f'title 과다({len(title)}자)')
    # meta description
    desc = None
    for tag in tags(head, r'<meta[^>]+>'):
        if (attr(tag,'name') or '').lower() == 'description': desc = attr(tag,'content')
    info['desc_len'] = len(desc) if desc else 0
    if not desc: issues.append('meta description 없음')
    elif len(desc) < 40: issues.append(f'description 너무 짧음({len(desc)}자)')
    elif len(desc) > 170: issues.append(f'description 과다({len(desc)}자)')
    # robots
    noindex = False
    for tag in tags(head, r'<meta[^>]+>'):
        if (attr(tag,'name') or '').lower() == 'robots' and 'noindex' in (attr(tag,'content') or ''):
            noindex = True
    info['noindex'] = noindex
    # canonical
    canon = None
    for tag in tags(head, r'<link[^>]+>'):
        if (attr(tag,'rel') or '').lower() == 'canonical': canon = attr(tag,'href')
    info['canonical'] = canon
    if not noindex:
        if not canon: issues.append('canonical 없음')
        elif canon.rstrip('/') != url.rstrip('/'):
            # index.html: canonical to dir is fine
            if not (rel.endswith('index.html') and canon.rstrip('/') == url[:-len('index.html')].rstrip('/')):
                issues.append(f'canonical 불일치({canon})')
    # hreflang
    alts = {}
    for tag in tags(head, r'<link[^>]+>'):
        if (attr(tag,'rel') or '').lower() == 'alternate' and attr(tag,'hreflang'):
            alts[attr(tag,'hreflang').lower()] = attr(tag,'href')
    info['hreflang'] = sorted(alts.keys())
    # og / twitter
    props = {}
    for tag in tags(head, r'<meta[^>]+>'):
        pr = attr(tag,'property') or attr(tag,'name')
        if pr: props[pr.lower()] = attr(tag,'content')
    for k in ('og:title','og:description','og:image'):
        if not noindex and not props.get(k): issues.append(f'{k} 없음')
    ogi = props.get('og:image')
    if ogi and ogi.startswith('https://ezlong.com/'):
        f = os.path.join(ROOT, ogi.replace('https://ezlong.com/','').split('?')[0])
        if not os.path.exists(f): issues.append('og:image 파일 없음'); og_missing_files.add(ogi)
    if not noindex and not props.get('twitter:card'): issues.append('twitter:card 없음')
    # JSON-LD
    lds = re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', full, re.I|re.S)
    types = []
    for ld in lds:
        try:
            j = json.loads(ld)
            items = j if isinstance(j, list) else [j]
            for it in items:
                if isinstance(it, dict): types.append(it.get('@type'))
        except Exception:
            issues.append('JSON-LD 파싱 오류')
    info['ld'] = types
    # h1 — <script>(JSX 문자열)와 <noscript>(비JS 대체 뷰)는 이중 집계를 만들므로
    # 걷어내고 센다. 실사고: 정적 h1이 noscript 안에 있고 JSX가 런타임 h1을 그리는
    # tax-account-simulator를 'h1 2개'로 오판해 고쳤다가 되돌렸다(2026-08-26).
    # noscript는 남긴다 — JS 꺼진 뷰에서는 실제 h1이고, JS 켜진 뷰에서는 비활성이라
    # 어느 쪽에서도 이중이 아니다. script(JSX)만 걷어내면 'JS 꺼진 뷰의 h1 수'가 된다.
    stripped = re.sub(r'<script\b.*?</script>', '', full, flags=re.I|re.S)
    h1s = re.findall(r'<h1[\s>]', stripped, re.I)
    if not noindex:
        if len(h1s) == 0: issues.append('h1 없음')
        elif len(h1s) > 1: issues.append(f'h1 {len(h1s)}개')
    # sitemap
    in_smap = url in smap_urls or (rel.endswith('index.html') and (
        url[:-len('index.html')] in smap_urls                      # /dir/ 표기
        or url[:-len('/index.html')] in smap_urls))                # /dir 확장자 없는 표기
    info['sitemap'] = in_smap
    if not noindex and not in_smap: issues.append('sitemap 미등재')
    if noindex and in_smap: issues.append('noindex인데 sitemap 등재')
    info['in_llms'] = ('/' + rel) in llms
    report[rel] = {'issues': issues, **info}

# 요약 출력
from collections import Counter
cnt = Counter()
for rel, r in report.items():
    for i in r['issues']:
        cnt[re.sub(r'\(.*', '', i)] += 1
print('=== 이슈 빈도 ===')
for k, v in cnt.most_common(): print(f'{v:4d}  {k}')
print()
print('=== 페이지별(이슈 있는 것만, 최대 표시) ===')
for rel, r in sorted(report.items()):
    if r['issues']:
        print(f"{rel} [{'noindex' if r['noindex'] else 'index'}]: {'; '.join(r['issues'])}")
json.dump(report, open('/tmp/seo-report.json','w'), ensure_ascii=False, indent=1)
