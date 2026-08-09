#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""시장 국면 진단 번역판을 한국어 원본에서 굽는다.

이슈 코너(build-brief-history-i18n.py)와 같은 방식이다. 매일 갱신되는 화면의
번역본을 손으로 관리하면 기능을 고칠 때마다 여섯 벌을 따라 고쳐야 하고,
반드시 한두 벌이 뒤처진다(뒤처져도 아무 신호가 없다).

무엇을 갈아끼우나
  · <html lang> 과 SEO 구간(MR_SEO_*)
  · 언어 사전 구간(MR_I18N_*) — window.MR_T·MR_DK·MR_TEXT
  · 본문에 박힌 고정 문구 — 제목·소제목·버튼
  레이아웃·CSS·로직은 한 글자도 건드리지 않는다.

데이터는 한국어 하나만 쓴다
  화면 데이터(/data/market-regime.json)는 언어별로 만들지 않는다. 엔진이 내는
  한국어 값은 종류가 정해져 있어(등급 5·상태 5·국면 10 등) 사전(MR_DK)으로
  덮는 편이 매일 번역을 돌리는 것보다 싸고 흔들림이 없다.

사용
  python3 scripts/build-market-regime-i18n.py
  python3 scripts/build-market-regime-i18n.py --langs en
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
SRC = os.path.join(ROOT, 'market-regime.html')
sys.path.insert(0, os.path.join(HERE, 'i18n'))
from market_regime_strings import BODY, JS, DATA_KO, SEO, TEXT  # noqa: E402

LANGS = ('en', 'ja', 'zh', 'es', 'pt')
BASE = 'https://ezlong.com'


def between(text, start, end):
    return text.index(start), text.index(end) + len(end)


def seo_block(lang):
    t = SEO[lang]
    url = f'{BASE}/{lang}/market-regime.html'
    alts = '\n'.join(
        f'<link rel="alternate" hreflang="{l}" href="{BASE}/{"" if l == "ko" else l + "/"}market-regime.html">'
        for l in ('ko', 'en', 'ja', 'es', 'pt', 'zh'))
    ld = {
        '@context': 'https://schema.org',
        '@graph': [
            {'@type': 'WebPage', '@id': url + '#page', 'url': url,
             'name': t['title'], 'description': t['desc'], 'inLanguage': lang,
             'isPartOf': {'@type': 'WebSite', 'name': 'EZLONG', 'url': BASE + '/'},
             'author': {'@type': 'Person', 'name': '김성동'}},
            {'@type': 'BreadcrumbList', 'itemListElement': [
                {'@type': 'ListItem', 'position': 1, 'name': 'EZLONG', 'item': f'{BASE}/{lang}/'},
                {'@type': 'ListItem', 'position': 2, 'name': t['crumb'], 'item': url}]},
        ],
    }
    return f'''<!-- MR_SEO_START — 빌더 생성. 원본은 /market-regime.html -->
<title>{t['title']}</title>
<meta name="description" content="{t['desc']}">
<meta name="keywords" content="{t['keywords']}">
<link rel="canonical" href="{url}">
<meta name="author" content="김성동">
{alts}
<link rel="alternate" hreflang="x-default" href="{BASE}/en/market-regime.html">
<meta property="og:type" content="website">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{t['title']}">
<meta property="og:description" content="{t['desc']}">
<meta property="og:locale" content="{t['locale']}">
<meta property="og:site_name" content="EZLONG">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="{t['title']}">
<meta name="twitter:description" content="{t['desc']}">
<!-- MR_SEO_END -->'''


def i18n_block(lang):
    return ('<!-- MR_I18N_START — 빌더 생성 -->\n<script>\n'
            "window.MR_TODAY = '/data/market-regime.json';\n"
            "window.MR_HIST = '/data/market-regime-history.json';\n"
            'window.MR_DK = ' + json.dumps(DATA_KO[lang], ensure_ascii=False, indent=1) + ';\n'
            'window.MR_TEXT = ' + json.dumps(TEXT[lang], ensure_ascii=False, indent=1) + ';\n'
            'window.MR_T = ' + json.dumps(JS[lang], ensure_ascii=False, indent=1) + ';\n'
            '</script>\n<!-- MR_I18N_END -->')


def body_swaps(lang, s):
    ko, tr = BODY['ko'], BODY[lang]
    pairs = [
        (f'<h1 class="mr-brand-title">{ko["h1"]}</h1>', f'<h1 class="mr-brand-title">{tr["h1"]}</h1>'),
        (f'<p class="mr-lede">{ko["lede1"]}</p>', f'<p class="mr-lede">{tr["lede1"]}</p>'),
        (f'<p class="mr-lede">{ko["lede2"]}</p>', f'<p class="mr-lede">{tr["lede2"]}</p>'),
        (f'<h2 class="mr-h2">{ko["h_today"]}</h2>', f'<h2 class="mr-h2">{tr["h_today"]}</h2>'),
        (f'<h2 class="mr-h2">{ko["h_roles"]}</h2>', f'<h2 class="mr-h2">{tr["h_roles"]}</h2>'),
        (f'<p class="mr-sub">{ko["sub_roles"]}</p>', f'<p class="mr-sub">{tr["sub_roles"]}</p>'),
        (f'<h2 class="mr-h2">{ko["h_scores"]}</h2>', f'<h2 class="mr-h2">{tr["h_scores"]}</h2>'),
        (f'<p class="mr-sub">{ko["sub_scores"]}</p>', f'<p class="mr-sub">{tr["sub_scores"]}</p>'),
        (f'<h2 class="mr-h2">{ko["h_chart"]}</h2>', f'<h2 class="mr-h2">{tr["h_chart"]}</h2>'),
        (f'<p class="mr-sub">{ko["sub_chart"]}</p>', f'<p class="mr-sub">{tr["sub_chart"]}</p>'),
        (f'<h2 class="mr-h2">{ko["h_trans"]}</h2>', f'<h2 class="mr-h2">{tr["h_trans"]}</h2>'),
        (f'<p class="mr-sub">{ko["sub_trans"]}</p>', f'<p class="mr-sub">{tr["sub_trans"]}</p>'),
        (f'<h2 class="mr-h2">{ko["h_eps"]}</h2>', f'<h2 class="mr-h2">{tr["h_eps"]}</h2>'),
        (f'<p class="mr-sub">{ko["sub_eps"]}</p>', f'<p class="mr-sub">{tr["sub_eps"]}</p>'),
        (f'<h2 class="mr-h2">{ko["h_next"]}</h2>', f'<h2 class="mr-h2">{tr["h_next"]}</h2>'),
        (f'<h2 class="mr-h2">{ko["h_limit"]}</h2>', f'<h2 class="mr-h2">{tr["h_limit"]}</h2>'),
        (f'<p class="mr-note">{ko["disclaimer"]}</p>', f'<p class="mr-note">{tr["disclaimer"]}</p>'),
        (f'data-freq="w">{ko["weekly"]}</button>', f'data-freq="w">{tr["weekly"]}</button>'),
        (f'data-freq="d">{ko["daily"]}</button>', f'data-freq="d">{tr["daily"]}</button>'),
        (f'data-w="120">{ko["w120"]}</button>', f'data-w="120">{tr["w120"]}</button>'),
        (f'data-y="3">{ko["y3"]}</button>', f'data-y="3">{tr["y3"]}</button>'),
        (f'data-y="5">{ko["y5"]}</button>', f'data-y="5">{tr["y5"]}</button>'),
        (f'data-y="10">{ko["y10"]}</button>', f'data-y="10">{tr["y10"]}</button>'),
        (f'data-y="0">{ko["all"]}</button>', f'data-y="0">{tr["all"]}</button>'),
        (f'<span class="mr-asof">{ko["loading"]}</span>', f'<span class="mr-asof">{tr["loading"]}</span>'),
    ]
    missed = []
    for old, new in pairs:
        if old not in s:
            missed.append(old[:46])
            continue
        s = s.replace(old, new)
    return s, missed


def main():
    argv = sys.argv[1:]
    langs = tuple(argv[argv.index('--langs') + 1].split(',')) if '--langs' in argv else LANGS

    with open(SRC, encoding='utf-8') as f:
        src = f.read()
    si, sj = between(src, '<!-- MR_SEO_START', '<!-- MR_SEO_END -->')
    ii, ij = between(src, '<!-- MR_I18N_START', '<!-- MR_I18N_END -->')

    rc = 0
    for lang in langs:
        s = src[:si] + seo_block(lang) + src[sj:ii] + i18n_block(lang) + src[ij:]
        s = s.replace('<html lang="ko">', f'<html lang="{lang}">', 1)
        s, missed = body_swaps(lang, s)
        if missed:
            print(f'::warning::[{lang}] 본문에서 못 찾은 문구 {len(missed)}건 — ' + ', '.join(missed))
            rc = 1
        outdir = os.path.join(ROOT, lang)
        os.makedirs(outdir, exist_ok=True)
        with open(os.path.join(outdir, 'market-regime.html'), 'w', encoding='utf-8') as f:
            f.write(s)
        print(f'[{lang}] {lang}/market-regime.html ({len(s):,}자)')
    return rc


if __name__ == '__main__':
    sys.exit(main())
