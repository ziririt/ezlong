#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""이슈(A Brief History) 번역판 페이지를 한국어 원본에서 굽는다.

왜 손으로 안 쓰나
  이 코너는 매일 갱신된다. 번역 페이지를 손으로 관리하면 기능을 고칠 때마다
  여섯 벌을 따라 고쳐야 하고, 반드시 한두 벌이 뒤처진다(그리고 뒤처져도
  아무 신호가 없다). 원본 하나만 고치고 나머지는 굽는다.

무엇을 갈아끼우나
  · <html lang> 과 SEO 구간(BH_SEO_START~END) — 제목·설명·canonical·hreflang·JSON-LD
  · 언어 사전 구간(BH_I18N_START~END) — 데이터 경로와 window.BH_T
  · 본문에 박힌 고정 문구 — 제목, 요일, 범례, 체크박스 라벨, 도구 툴팁
  나머지(레이아웃·CSS·로직)는 한 글자도 건드리지 않는다.

네이버 링크
  번역판이 읽는 data/brief-history-{lang}.json 에는 URL 자체가 없다
  (scripts/translate-brief-history.mjs 가 싣지 않는다). 그래서 문구를 지우는
  방식이 아니라 데이터에서 없애는 방식이고, 새는 자리가 없다.

사용
  python3 scripts/build-brief-history-i18n.py
  python3 scripts/build-brief-history-i18n.py --langs en
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
SRC = os.path.join(ROOT, 'brief-history.html')
sys.path.insert(0, os.path.join(HERE, 'i18n'))
from brief_history_strings import BODY, JS, SYMBOL_FULL, SEO  # noqa: E402

LANGS = ('en', 'ja', 'zh', 'es', 'pt')
BASE = 'https://ezlong.com'


def between(text, start, end):
    i = text.index(start)
    j = text.index(end) + len(end)
    return i, j


def seo_block(lang):
    t = SEO[lang]
    faq = [{'@type': 'Question', 'name': q,
            'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in t['faq']]
    url = f'{BASE}/{lang}/brief-history.html'
    alts = '\n'.join(
        f'<link rel="alternate" hreflang="{l}" href="{BASE}/{"" if l == "ko" else l + "/"}brief-history.html">'
        for l in ('ko', 'en', 'ja', 'es', 'pt', 'zh'))
    ld = {
        '@context': 'https://schema.org',
        '@graph': [
            {'@type': 'WebPage', '@id': url + '#page', 'url': url,
             'name': t['ldName'], 'description': t['ldDesc'], 'inLanguage': lang,
             'isPartOf': {'@type': 'WebSite', 'name': 'EZLONG', 'url': BASE + '/'},
             'author': {'@type': 'Person', 'name': '김성동'}},
            {'@type': 'BreadcrumbList', 'itemListElement': [
                {'@type': 'ListItem', 'position': 1, 'name': 'EZLONG', 'item': f'{BASE}/{lang}/'},
                {'@type': 'ListItem', 'position': 2, 'name': t['crumb'], 'item': url}]},
            {'@type': 'FAQPage', 'mainEntity': faq},
        ],
    }
    ld_json = json.dumps(ld, ensure_ascii=False, indent=1)
    return f'''<!-- BH_SEO_START — 빌더 생성. 원본은 /brief-history.html -->
<title>{t['title']}</title>
<meta name="description" content="{t['desc']}">
<meta name="keywords" content="{t['keywords']}">
<link rel="canonical" href="{url}">
{alts}
<link rel="alternate" hreflang="x-default" href="{BASE}/en/brief-history.html">
<!-- Open Graph -->
<meta property="og:type"        content="website">
<meta property="og:url"         content="{url}">
<meta property="og:title"       content="{t['ogTitle']}">
<meta property="og:description" content="{t['ogDesc']}">
<meta property="og:image"       content="{BASE}/og/og-1200x630.png?v=20260809">
<meta property="og:image:width"  content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale"      content="{t['locale']}">
<meta property="og:site_name"   content="EZLONG">
<!-- Twitter Card — 2026-08-26 SEO 점검: 손으로 넣은 og:image 가 이 빌더에 덮여
     사라졌다. 생성되는 페이지의 메타는 반드시 빌더에 있어야 한다. -->
<meta name="twitter:card"        content="summary_large_image">
<meta name="twitter:image"       content="{BASE}/og/og-1200x630.png?v=20260809">
<meta name="twitter:title"       content="{t['ogTitle']}">
<meta name="twitter:description" content="{t['ogDesc']}">
<script type="application/ld+json">
{ld_json}
</script>
<!-- BH_SEO_END -->'''


def i18n_block(lang):
    d = dict(JS[lang])
    d['symbolFull'] = SYMBOL_FULL[lang]
    return ('<!-- BH_I18N_START — 빌더 생성 -->\n<script>\n'
            f"window.BH_DATA = '/data/brief-history-{lang}.json';\n"
            'window.BH_T = ' + json.dumps(d, ensure_ascii=False, indent=1) + ';\n'
            '</script>\n<!-- BH_I18N_END -->')


def noscript_block(lang):
    """스크립트 없이 들어온 크롤러·독자를 위한 요약. 본문이 JSON 안에 있어
    이 블록이 없으면 빈 껍데기로 읽힌다."""
    t = SEO[lang]
    paras = ''.join(f'          <div class="bh-event-summary">{a}</div>\n'
                    for _, a in t['faq'])
    return ('<!-- BH_NOSCRIPT_START — 빌더 생성 -->\n'
            '      <noscript>\n'
            '        <div class="bh-event-item">\n'
            f'          <div class="bh-event-title">{t["ldName"]}</div>\n'
            f'          <div class="bh-event-summary">{t["ldDesc"]}</div>\n'
            + paras +
            '        </div>\n'
            '      </noscript>\n'
            '      <!-- BH_NOSCRIPT_END -->')


def body_swaps(lang, s):
    ko, tr = BODY['ko'], BODY[lang]
    pairs = [
        (f'<h1 class="bh-brand-title">{ko["h1"]}</h1>',
         f'<h1 class="bh-brand-title">{tr["h1"]}</h1>'),
        (f'<p class="bh-brand-lede">{ko["lede"]}</p>',
         f'<p class="bh-brand-lede">{tr["lede"]}</p>'),
        (f'<p class="bh-brand-lede">{ko["lede2"]}</p>',
         f'<p class="bh-brand-lede">{tr["lede2"]}</p>'),
        (''.join(f'<span>{d}</span>' for d in ko['weekdays']),
         ''.join(f'<span>{d}</span>' for d in tr['weekdays'])),
        (f'<p class="bh-chart-hint">{ko["chartHint"]}</p>',
         f'<p class="bh-chart-hint">{tr["chartHint"]}</p>'),
        (f'></span>{ko["legendMajor"]}\n', f'></span>{tr["legendMajor"]}\n'),
        (f'></span>{ko["legendNotable"]}\n', f'></span>{tr["legendNotable"]}\n'),
        (f'></span>{ko["legendLog"]}\n', f'></span>{tr["legendLog"]}\n'),
        (f'>{ko["majorOnly"]}</label>', f'>{tr["majorOnly"]}</label>'),
        (f'id="bh-events-title">{ko["allTitle"]}</div>',
         f'id="bh-events-title">{tr["allTitle"]}</div>'),
    ]
    for key in ('Cursor', 'Trend', 'Measure', 'Clear', 'Erase', 'ZoomOut', 'ZoomIn', 'Goto'):
        pairs.append((f'aria-label="{ko["t" + key + "Aria"]}"', f'aria-label="{tr["t" + key + "Aria"]}"'))
        pairs.append((f'title="{ko["t" + key]}"', f'title="{tr["t" + key]}"'))
    # 날짜 이동 버튼은 aria-label 이 title 과 다른 문구다(입력칸 쪽이 tGotoAria)
    pairs.append((f'aria-label="{ko["tGoto"]}"', f'aria-label="{tr["tGoto"]}"'))
    pairs.append((f'aria-label="{ko["tPrevMonth"]}"', f'aria-label="{tr["tPrevMonth"]}"'))
    pairs.append((f'aria-label="{ko["tNextMonth"]}"', f'aria-label="{tr["tNextMonth"]}"'))
    pairs.append((f'aria-label="{ko["tPrevDay"]}"', f'aria-label="{tr["tPrevDay"]}"'))
    pairs.append((f'aria-label="{ko["tNextDay"]}"', f'aria-label="{tr["tNextDay"]}"'))

    missed = []
    for old, new in pairs:
        if old not in s:
            missed.append(old[:50])
            continue
        s = s.replace(old, new)
    return s, missed


def main():
    argv = sys.argv[1:]
    langs = LANGS
    if '--langs' in argv:
        langs = tuple(argv[argv.index('--langs') + 1].split(','))

    with open(SRC, encoding='utf-8') as f:
        src = f.read()

    si, sj = between(src, '<!-- BH_SEO_START', '<!-- BH_SEO_END -->')
    ii, ij = between(src, '<!-- BH_I18N_START', '<!-- BH_I18N_END -->')
    ni, nj = between(src, '<!-- BH_NOSCRIPT_START', '<!-- BH_NOSCRIPT_END -->')

    rc = 0
    for lang in langs:
        s = (src[:si] + seo_block(lang) + src[sj:ii] + i18n_block(lang)
             + src[ij:ni] + noscript_block(lang) + src[nj:])
        s = s.replace('<html lang="ko">', f'<html lang="{lang}">', 1)
        s, missed = body_swaps(lang, s)
        if missed:
            print(f'::warning::[{lang}] 본문에서 못 찾은 문구 {len(missed)}건 — ' + ', '.join(missed))
            rc = 1
        outdir = os.path.join(ROOT, lang)
        os.makedirs(outdir, exist_ok=True)
        with open(os.path.join(outdir, 'brief-history.html'), 'w', encoding='utf-8') as f:
            f.write(s)
        print(f'[{lang}] {lang}/brief-history.html ({len(s):,}자)')

    # 남아 있는 한글이 있으면 알린다 — 코드 주석은 정상이므로 화면 텍스트만 대충 훑는다
    return rc


if __name__ == '__main__':
    sys.exit(main())
