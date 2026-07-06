# Claude Cowork Handover: ezlong.com/time

최종 업데이트: 2026-07-06 19:40 KST  
담당 범위: `ezlong.com/time` 투자 멘탈 날씨 + 플립시계 웹앱, iOS/Android 앱 셸, 배경사진/투자문장 아카이브 자동화

## 1. 현재 제품 방향

`ezlong.com/time`은 기존 bookple 플립시계/날씨 앱의 디자인 감각을 거의 유지하되, 콘텐츠만 장기투자자용으로 바꾼 파생 앱이다.

- 첫 화면: 자연 배경 + 날짜 + 상세 날씨 + 플립시계 + 투자 명저 한 문장
- 스크롤 아래: `ezlong.com` 메인/서비스 접근 영역
- 핵심 감성: 하루 종일 스마트폰 대기화면처럼 켜두고 싶은 힐링 시계/날씨/투자멘탈 앱
- 가장 중요한 품질 기준: 계절, 날씨의 미묘한 차이, 현재 시간대가 배경사진과 어긋나지 않아야 한다.

사용자가 싫어한 것:

- 사람 얼굴이나 인물 중심 사진
- 우울하고 축축한 느낌만 강한 비/흐림 사진
- 첫 화면 하단에 ezlong.com 헤더가 살짝 보이는 것
- "강한 이슬비"처럼 한국어 감각상 모순적인 날씨 표현
- 날씨/계절/시간대와 무관한 배경이 점 4개나 스와이프에서 나오는 것

사용자가 좋아한 것:

- 하늘, 들판, 나무, 공원, 시골 풍경, 식물, 꽃
- 카페 창밖, 책 읽기 좋은 분위기
- 도시 항공사진, 도시의 좋은 풍경
- 비오는 날도 낭만적이고 기분 좋아지는 사진
- 유리창에 빗방울이 맺힌 듯한 고급스럽고 미묘한 효과

## 2. 주요 경로

운영 repo:

```bash
/Users/ziririt/Documents/Claude/Projects/미국주식투자자를 위한 ezlong.com
```

현재 작업에 사용한 깨끗한 임시 클론:

```bash
/tmp/ezlong-drizzle
```

로컬 프리뷰/파생 앱 작업 폴더:

```bash
/Users/ziririt/Documents/투자서 날씨 앱 2
```

배포 URL:

```text
https://ezlong.com/time
```

중요 파일:

```text
time/index.html
time/styles.css
time/app.js
time/investment-quotes.js
time/data/background-manifest.json
time/data/quote-archive-manifest.json
scripts/upload-time-background-storage.js
scripts/merge-time-quotes.js
mobile/time-app/
```

## 3. 웹앱 구현 상태

### 화면 구조

- `time/index.html`이 웹 route의 진입점이다.
- 첫 화면 `.sky-room`은 플립시계/날씨/문장 영역이다.
- 하단에는 ezlong.com live section이 이어진다.
- 모바일 Safari/Chrome에서 주소창과 겹치지 않게 `time/app.js`의 `applyViewportMetrics()`와 `time/styles.css`의 `--browser-bottom-lift`가 하단 여백을 조정한다.

### 플립시계

- `time/app.js`에서 현재 시간을 렌더링한다.
- UI는 가운데 수평 hinge line이 있고, 바뀌는 숫자 카드만 flip 느낌을 내는 방향으로 정리되어 있다.
- 카드가 단순 리로드처럼 번쩍이는 느낌이 생기면 `time/styles.css`의 `.flip-card`, `.flip-card.is-flipping`, hinge 관련 스타일을 점검한다.

### 날씨 표현

Open-Meteo weather code를 한국어 표현과 내부 tag로 변환한다.

현재 사용자 확인을 거친 표현:

```text
0: 맑음
1, 2: 구름 약간
3: 흐림
45, 48: 안개
51: 옅은 이슬비
53: 이슬비
55: 짙은 이슬비
56: 살짝 어는 이슬비
57: 어는 이슬비
61, 80: 약한 비
63, 81: 간간이 약한 비 / 약한 비 / 비
65, 66, 67, 82: 강한 비
71, 73, 75, 77, 85, 86: 눈
95, 96, 99: 뇌우
기타: 날씨
```

주의: "강한 이슬비"는 절대 쓰지 않는다.

## 4. 배경사진 선택 로직

사진 manifest:

```text
time/data/background-manifest.json
```

주요 필드:

```json
{
  "src": "assets/background-archive/2026-07-06/cloudy/cloudy-01.jpg",
  "publicUrl": "assets/background-archive/2026-07-06/cloudy/cloudy-01.jpg",
  "timeBuckets": ["morning", "late-morning", "midday", "afternoon", "late-afternoon", "sunset", "evening"],
  "weatherTags": ["cloudy", "partly-cloudy", "mist"],
  "seasonTags": ["summer"],
  "moodTags": ["cloudy-day", "soft-clouds", "summer-green", "calm", "healing"],
  "photoPosition": "center center",
  "photoSize": "cover",
  "source": "pexels-user-provided",
  "attribution": "Photographer Name",
  "license": "Pexels License",
  "sourceUrl": "https://www.pexels.com/license/",
  "width": 1800,
  "height": 2400,
  "sizeKB": 1200.0,
  "collectedAtKST": "2026-07-06T19:35:37+09:00"
}
```

선택 로직은 `time/app.js`의 아래 함수들을 중심으로 본다.

- `weatherCodeToTag()`
- `weatherTagGroup()`
- `getSceneTimeBuckets()`
- `refreshActivePhotoSet()`
- `selectBackground()`
- `selectPhotoIndex()`
- `shouldAutoRotatePhoto()`

현재 동작:

- 현재 season + weather tag + time bucket에 맞는 사진 후보를 만든다.
- 점 4개는 같은 조건의 다른 사진 4장을 선택하는 컨트롤이다.
- 좌우 스와이프도 같은 4장 사이에서 이동한다.
- 사용자가 점/스와이프로 고른 사진은 최소 5분 유지된다.
- 자동 회전은 슬롯 기준으로 천천히 바뀐다.

중요: 점 4개는 시간대 모드 버튼이 아니다. 같은 날씨/계절/시간대 사진 selector다.

## 5. 최근 추가된 사진

### 이슬비 사진

원본:

```text
/Users/ziririt/Downloads/drizzling
```

운영 저장 위치:

```text
time/assets/background-archive/2026-07-06/drizzling/drizzling-01.jpg
...
time/assets/background-archive/2026-07-06/drizzling/drizzling-30.jpg
```

태그:

```text
seasonTags: summer
weatherTags: light-rain, rain
timeBuckets: late-morning, midday, afternoon, late-afternoon, sunset, evening
moodTags: drizzling, romantic-rain, summer-green, soft-light, healing
```

주의: 예전에는 이슬비 사진에 `cloudy`가 섞여 있어 흐림 날씨에서도 이슬비 사진이 나올 수 있었다. 2026-07-06에 이 문제를 막기 위해 `drizzling` 묶음은 `light-rain`, `rain`으로 좁혔다.

### 구름이 많이 낀 날 사진

원본:

```text
/Users/ziririt/Downloads/cloudy
```

운영 저장 위치:

```text
time/assets/background-archive/2026-07-06/cloudy/cloudy-01.jpg
...
time/assets/background-archive/2026-07-06/cloudy/cloudy-23.jpg
```

태그:

```text
seasonTags: summer
weatherTags: cloudy, partly-cloudy, mist
timeBuckets: morning, late-morning, midday, afternoon, late-afternoon, sunset, evening
moodTags: cloudy-day, soft-clouds, summer-green, calm, healing
```

주의: cloudy 사진은 `light-rain`에 넣지 않았다. 비 날씨와 흐림 날씨가 섞여 사용자에게 어색하게 보이는 문제를 막기 위해서다.

## 6. 사진 수집/클라우드 저장 루틴

목표:

- 매시간 다음 시간대 날씨를 보고, 그 조건에 맞는 사진을 조금씩 확보한다.
- 낮 시간대는 시간당 4장 정도, 0시-5시는 적은 수량으로 충분하다.
- 태그는 반드시 season + detailed weather + time bucket을 포함한다.
- 사진은 저작권/라이선스 표기가 가능한 출처만 사용한다.

현재 스크립트:

```bash
npm run archive:time-backgrounds -- <local-image-folder> --time=evening --weather=cloudy --season=summer
```

실제 파일:

```text
scripts/upload-time-background-storage.js
```

이 스크립트는 로컬 이미지 폴더를 Firebase Storage에 업로드하고 `time/data/background-manifest.json`에 `storagePath`, `publicUrl`, tag metadata를 추가하는 목적이다.

필요 조건:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/firebase-service-account.json
export FIREBASE_PROJECT_ID=ezlong-541a8
export FIREBASE_STORAGE_BUCKET=ezlong-541a8.firebasestorage.app
```

주의:

- 예전에 `firebase-service-account.json`이 0바이트여서 `Unexpected end of JSON input`이 난 적이 있다.
- Admin SDK service account JSON이 유효해야 한다.
- Firebase Storage 활성화와 bucket 이름을 확인해야 한다.
- `firebase-service-account.json`은 절대 git에 커밋하지 않는다.

## 7. 투자 명저 문장 아카이브

현재 문장 데이터:

```text
time/investment-quotes.js
time/data/quote-archive-manifest.json
```

앱 렌더링 구조:

```json
{
  "english": "English quote if available",
  "text": "한국어 문장",
  "title": "책 제목",
  "author": "저자명",
  "category": "mindset",
  "rights": "short-quote",
  "sourceType": "curated",
  "sourceUrl": "",
  "addedAtKST": "2026-07-06T..."
}
```

문장 추가 스크립트:

```bash
npm run archive:time-quotes -- /path/to/quotes.json
```

실제 파일:

```text
scripts/merge-time-quotes.js
```

중복 제거 기준:

```text
title + author + text
```

랜덤 로직:

- `time/app.js`에서 최근 저자 3명을 기억해 같은 저자로 쏠리지 않도록 한다.
- 같은 책 제목이 연속으로 나오지 않게 조정한다.

클로드 코워크가 해야 할 다음 개선:

- 사용자가 준 붙여넣기 문서를 JSON으로 정제해 `quote-archive-manifest.json`에 병합한다.
- 영어 원문이 있는 외국 투자 명저는 `english` 필드를 채운다.
- 한국어 저자/국내 책은 `english` 없이 `text/title/author`만 넣어도 된다.
- 카테고리는 `mindset`, `volatility`, `compound`, `patience`, `behavior`, `long-term` 등으로 정리하면 좋다.

## 8. iOS/Android 앱 셸

앱 폴더:

```text
mobile/time-app
```

기술:

```text
Capacitor
```

실행:

```bash
cd mobile/time-app
npm install
npm run cap:sync
npm run cap:open:ios
npm run cap:open:android
```

현재 앱 심사 통과 방향:

- 단순 WebView로 보이지 않게 첫 화면 clock/weather/quote 경험은 앱 안에 번들한다.
- native haptics, local notification, splash/status bar, offline seed data를 앱 가치로 둔다.
- ezlong.com은 하단 live service surface로 자연스럽게 접근하게 한다.
- 심사 설명은 "calming weather clock and long-term-investing mindset companion"으로 잡는다.
- "ezlong.com wrapper"라고 설명하지 않는다.

다음 할 일:

- `time/` 웹 변경사항을 `mobile/time-app/www/`에 동기화하는 스크립트를 안정화한다.
- iOS safe-area, Safari/Chrome 주소창 이슈와 앱 WebView safe-area는 별도로 테스트한다.
- 앱 아이콘, splash 이미지, bundle id, 앱 이름을 최종 확정한다.
- 알림 권한 요청은 첫 실행 즉시가 아니라 사용자가 설정에서 켤 때 요청하는 것이 좋다.

## 9. 배포 주의사항

`ezlong.com` 운영 repo는 자동 데이터 커밋과 배포가 섞여 있으므로 반드시 작업 전에 최신화한다.

안전한 기본 순서:

```bash
git pull --rebase origin main
git status --short
git add <명시적 파일만>
git commit -m "..."
git pull --rebase --autostash origin main
git push origin HEAD:main
```

Firebase 수동 배포가 필요할 때:

```bash
/opt/homebrew/bin/firebase deploy --only hosting --project ezlong-541a8
```

검증:

```bash
/opt/homebrew/bin/node --check time/app.js
curl -I https://ezlong.com/time/
curl -I https://ezlong.com/time/data/background-manifest.json
```

새 이미지 검증:

```bash
/opt/homebrew/bin/node - <<'NODE'
(async () => {
  const m = await (await fetch('https://ezlong.com/time/data/background-manifest.json?verify=' + Date.now(), { cache: 'no-store' })).json();
  const cloudy = m.images.filter((x) => (x.src || '').includes('/cloudy/'));
  const drizzle = m.images.filter((x) => (x.src || '').includes('/drizzling/'));
  console.log({ total: m.images.length, cloudy: cloudy.length, drizzle: drizzle.length, updatedAtKST: m.updatedAtKST });
})();
NODE
```

절대 하지 말 것:

- `git reset --hard`
- `git add -A`
- pull 없이 firebase deploy
- git에 없는 이미지를 HTML/manifest에서 참조
- service account JSON을 commit

## 10. 현재 상태 요약

2026-07-06 19:40 KST 기준:

- `ezlong.com/time`은 Firebase Hosting에 배포 가능하다.
- 이슬비 사진 30장 반영 완료.
- 구름 많은 날 사진 23장 반영 작업 진행.
- `background-manifest.json`에는 사진별 season/weather/time/mood/license/attribution 메타데이터가 있다.
- 문장 아카이브는 구조가 준비되어 있고, 추가 수집분은 `scripts/merge-time-quotes.js`로 병합한다.
- 모바일 앱 셸은 `mobile/time-app`에 준비되어 있으나, 실제 App Store/Play Store 제출 전 native polish와 심사 문구, asset 확정이 필요하다.
