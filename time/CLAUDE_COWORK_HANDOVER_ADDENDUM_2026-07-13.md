# Claude Cowork Handover Addendum: 배경사진 수집/분류 (2026-07-13)

작성 시각: 2026-07-13T00:40+09:00 KST
작성 세션: Cowork(별도 대화방) — Pexels "좋아요" 갤러리 다운로드 + 사진 분류 작업
기존 `CLAUDE_COWORK_HANDOVER.md`(2026-07-06 작성)를 대체하지 않음. 이 파일은 그 이후 진행된 별도 세션의 작업 내역을 정리한 추가 문서.

## 0. 왜 이 문서가 필요한가

이 Cowork 세션은 `ezlong.com/time`의 정식 운영 repo(`/Users/ziririt/Documents/Claude/Projects/미국주식투자자를 위한 ezlong.com`) 경로를 몰랐던 상태로 시작해서, 사용자의 Pexels "좋아요" 갤러리(3,219개)를 브라우저로 한 장씩 순차 다운로드하고, 별도로 날씨/시간대를 자동 분류하고, 자체적인 배경 선택 알고리즘까지 새로 설계했다.

작업 도중 실제 운영 repo와 `scripts/collect-background-photos.js`, `scripts/upload-time-background-storage.js`, `scripts/gallery-server.js`, `time/app.js`의 `selectBackground()` 등 이미 훨씬 성숙한 동일 목적 시스템이 이미 존재한다는 것을 뒤늦게 발견했다. 따라서 이 세션에서 만든 산출물은 **운영 repo에 직접 병합하지 않았고**, 원본 사진과 1차 분류 결과만 정리해서 다음 세션이 기존 `archive:time-backgrounds` 파이프라인으로 정식 반영할 수 있도록 남겨둔다.

## 1. 이 세션에서 만든 원본 자료 (전부 git 저장소 밖, 로컬 Downloads 폴더)

```text
/Users/ziririt/Downloads/pixel-20260712/                     Pexels 원본 1,039장 + manifest.json
/Users/ziririt/Downloads/pixel-20260712-resized/              위 사진을 WebP 1920px로 리사이즈한 사본
/Users/ziririt/Downloads/firebase-summer-backgrounds/         Firebase Storage에서 재수집한 101장 (아래 3항 참고)
/Users/ziririt/Downloads/firebase-summer-backgrounds-resized/ 위 사진 WebP 리사이즈 사본
/Users/ziririt/Downloads/catalog.json                         두 소스를 합친 1,140장 메타데이터 (flat schema, 아래 4항)
/Users/ziririt/Downloads/flipgen-weather-assets/               catalog.json + background_selector.ts 사본
```

**주의**: `pixel-20260712` 폴더에는 한때 사용자 Desktop의 개인 사진(IMG_*.jpg) 136장이 실수로 섞였다가 즉시 발견하고 삭제했다. 현재는 `pexels-`로 시작하는 파일만 남아있음을 확인 완료. 다음 세션에서도 이 폴더에 `pexels-` 접두사가 아닌 파일이 있으면 절대 사용하지 말 것 — 사용자가 명시적으로 개인 사진 프라이버시를 강하게 우려함.

## 2. Pexels 원본 1,039장 — 분류 방식과 한계

`classify.py`로 각 사진을 축소(80x80)해서 HSV 밝기/채도/색상 통계만으로 시간대(`day`/`dawn_dusk`/`night`)와 날씨(`clear`/`partly_cloudy`/`cloudy`/`overcast`/`stormy`)를 규칙 기반으로 추정했다. **사람이 한 장씩 확인한 게 아니라 순수 통계 휴리스틱**이라 정확도가 완벽하지 않다. 특히:

- 밤 사진 중 "맑은 밤하늘(별 선명)"과 "흐린 밤"의 구분 정확도가 낮다(작은 별빛/달이 축소 과정에서 뭉개짐).
- 인물 사진, 도시/건물, 카페 창문 등 운영 repo가 선호하는 "무드"를 전혀 걸러내지 않았다. `CLAUDE_COWORK_HANDOVER.md` 1항에 명시된 "사람 얼굴/인물 중심 사진 배제" 기준을 이 1,039장에는 적용하지 않았으므로, 그대로 반영하면 인물 사진이 섞여 들어갈 수 있다.
- `moodTags`, `attribution`(촬영자명은 파일명에서 파싱해 `photographer` 필드로 있음), `license`, `photoPosition` 등 운영 manifest가 요구하는 필드는 채우지 않았다.

즉 이 1,039장은 **"1차 후보 풀"**이지 바로 반영 가능한 완성 데이터가 아니다.

## 3. Firebase Storage에서 재수집한 101장 — 사실은 새 데이터가 아님

`archive/time-backgrounds/summer/` 하위를 REST API로 전량 다운로드했는데, 이건 기존 `upload-time-background-storage.js`가 이미 업로드해 둔 것과 사실상 동일한 데이터로 보인다(`build-background-archive-page.js`의 `storagePath.startsWith("archive/time-backgrounds")` 조건과 경로가 정확히 일치). **새로 발견한 사진이 아니라 기존 파이프라인 산출물을 다시 내려받은 것**이니 참고용으로만 보고, 운영 manifest에 중복으로 추가하지 않도록 주의.

**중요한 보안 발견**: 이 Firebase Storage 버킷(`ezlong-541a8.firebasestorage.app`)이 **인증 없이 전체 목록 조회 + 다운로드가 가능한 상태**였다(`curl`로 토큰 없이 확인 완료). Storage 보안 규칙을 검토해서 필요하면 인증 조건을 추가하는 게 좋겠다.

## 4. catalog.json 스키마 (운영 manifest와 다름 — 변환 필요)

이 세션에서 만든 `catalog.json`은 flat schema다:

```json
{
  "id": "pexels_16255534",
  "filename": "pexels-ersin-basturk-399622110-16255534.jpg",
  "resized_filename": "pexels-ersin-basturk-399622110-16255534.webp",
  "source": "pexels",
  "photographer": "ersin-basturk-399622110",
  "season": "summer",
  "weather": "clear",
  "time_of_day": "night",
  "width": 1200,
  "height": 1800
}
```

운영 manifest(`time/data/background-manifest.json`)는 배열 기반 태그(`timeBuckets: []`, `weatherTags: []`)와 `moodTags`, `license`, `attribution`, `photoPosition` 등을 요구한다. **그대로 병합 불가** — `archive:time-backgrounds` 스크립트(`npm run archive:time-backgrounds -- <folder> --time=... --weather=... --season=...`)로 정식 태깅 절차를 거쳐야 한다.

## 5. background_selector.ts — 참고용으로만, 운영에 반영하지 않음

이 세션에서 셔플백(shuffle-bag) 방식 무반복 선택 알고리즘을 새로 설계하고 실제 catalog.json(1,140장)으로 테스트까지 마쳤다(낮/밤 패밀리 안전성 45개 조합 0건 위반, 무반복 속성 검증 완료). 코드는 `/Users/ziririt/Downloads/flipgen-weather-assets/background_selector.ts`에 있다.

**하지만 이걸 `time/app.js`의 기존 로직(`selectBackground()`, `refreshActivePhotoSet()` 등)에 반영하지 않았다.** 이유: `app.js`에는 이미 실제 사고 이력(벼락/폭풍 사진이 `cloudy` 태그를 겸해서 흐린 날씨에도 잘못 노출된 사고)을 반영한 `isDramaticStorm`, `moodSafe` 같은 안전장치가 있는데, 이 세션은 그 사고 맥락을 모르는 채로 독자적인 알고리즘을 짰다. 아이디어(셔플백 무반복, 낮/밤 패밀리 하드 분리)는 참고할 가치가 있지만, 실제 반영은 `app.js`를 잘 아는 세션에서 기존 로직에 점진적으로 통합하는 걸 권장.

## 6. 사용자가 요청한 것 — 다음 세션에서 이어가면 좋은 것

1. **사진 관리 도구(열람/삭제/태그 수정)**: `scripts/gallery-server.js`(현재 WORK 폴더 `/Users/ziririt/Documents/투자서 날씨 앱 2/scripts/gallery-server.js`에 있음, `node scripts/gallery-server.js` 후 `http://localhost:8787`)가 이미 열람+삭제는 지원한다. **단, 태그(계절/날씨/시간대) 드롭다운 수정 기능은 아직 없다** (grep으로 `edit`/`PATCH`/`select` 관련 코드 없음을 확인). 이 기능만 추가하면 사용자가 원하는 도구가 완성된다 — 완전히 새로 만들 필요 없음.
2. **얇은 카테고리 사진 추가 확보**: 사용자가 직접 Pexels에서 더 찾아서 채우겠다고 함. 우선순위는 이 세션에서 산출한 목록 참고(안개/폭풍은 여름철 낮은 우선순위, 오전/정오/오후는 "낮" 하나로 통합해도 무방, 이른아침/여명은 희귀하니 급하지 않음 — 사용자가 직접 확인해준 실사용 패턴: 데스크탑 대기화면 용도라 출퇴근/점심 시간대 체류가 짧음).
3. **1,039장 + 101장 원본을 운영 manifest에 정식 반영**: `archive:time-backgrounds` 스크립트로, 위 2항의 큐레이션(인물/무드 필터링)을 거쳐서 진행하는 게 안전.

## 7. 이 세션에서 만졌지만 원상복구한 것

- git 저장소(`투자서 날씨 앱 2`)의 `data/background-manifest.json`은 **읽기만 했고 수정하지 않았다.**
- `app.js` 등 운영 소스 코드는 **전혀 수정하지 않았다.**
- git commit/push는 **하지 않았다** (기존에 커밋되지 않은 다른 변경사항이 이미 작업 트리에 있어서, 이 세션의 산출물과 섞일까 봐 보수적으로 커밋을 보류함).
