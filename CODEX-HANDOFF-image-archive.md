# Codex 인수인계 문서 — ezlong.com 사진 이미지 아카이브 시스템

작성: Claude (Cowork) / 2026-07-06(월)
목적: Claude가 설계·초기 구축한 "고용량 사진 아카이브" 시스템을 ChatGPT Codex가 이어받아
      완성·테스트·운영할 수 있도록 컨텍스트를 전달한다. 이 문서만 읽고도 작업을 이어갈 수
      있게 배경부터 서술한다.

---

## 1. 프로젝트 배경

ezlong.com은 미국주식투자자를 위한 유틸리티 웹앱 모음 사이트다(운영자: 김성동).
GitHub 저장소를 Firebase Hosting에 연결해서 쓰고 있고, **main 브랜치에 push하면
`firebase-hosting.yml` GitHub Actions가 자동으로 배포한다.** 즉 "push = 배포"다.
Firebase 프로젝트 ID는 `ezlong-541a8`.

프로젝트 루트의 `CLAUDE.md`와 `EZLONG_GUIDE.md`에 이 저장소의 전체 운영 규칙(배포 절차,
git 워크플로우, 위험한 패턴 금지 목록 등)이 정리되어 있다. **Codex가 이 저장소에서 작업할
때는 반드시 이 두 파일을 먼저 읽을 것.** 특히 아래 규칙은 이번 작업과 직결된다.

- `git add -A` 금지, 파일 명시해서 add할 것
- `git reset --hard`, `git pull --rebase` 금지 (2026-06-14 대형 데이터 유실 사고 원인)
- 이미지·에셋은 코드 수정과 분리해서 단독 커밋
- 배포 전 `git pull origin main` 먼저 실행 — 순서 어기면 운영 서버가 구버전으로 덮어써짐

## 2. 문제 상황 — 왜 이 작업을 시작했나

기존 방식은 사진 이미지를 프로젝트 루트에 원본 그대로 두고 git으로 커밋해왔다
(book01.png, book02_1.png, wallstreet.png, logo류, hero류 등). 2026-07-06 점검 시점 기준:

- 워킹 디렉토리의 이미지 실물 총합: 약 17MB (git 추적 이미지 30개)
- 반면 `.git` 폴더 자체 용량: **2.8GB**

이 격차는 원본 그대로(리사이즈·압축 없이) 여러 버전이 git 히스토리에 누적된 결과다.
book02_1.png 한 장이 4.4MB(2000x3585px)에 달하는 등, 웹에 쓰기엔 과도하게 무거운 원본이
그대로 커밋되어 왔다.

운영자(김성동)는 이제 **고용량 고화질 사진을 수백 장 이상 규모로 미리 저장해두고,
앞으로도 계속 추가**하려고 한다. 이걸 기존 방식(git 저장소 안에 원본 그대로)으로 계속하면
저장소가 감당 안 되는 크기로 불어난다. 그래서 **이미지 실물은 git 밖으로 완전히 분리**하는
구조로 새로 설계했다.

## 3. 결정된 방향 (운영자 승인 완료)

운영자에게 3가지를 확인받았다:

1. **용도**: 웹사이트 게시용 (나중에 실제로 ezlong.com 페이지에 올라갈 이미지)
2. **저장 위치**: Firebase Storage 별도 버킷 — git 저장소와 완전히 분리
3. **예상 규모**: 수백 장 이상

이에 따라 "이미지 실물은 Firebase Storage에, git에는 URL 인덱스(manifest)만" 구조로
결정했다.

## 4. Claude가 이미 만들어둔 것 (현재 상태)

아래 파일들은 이미 프로젝트 루트에 생성/수정 완료된 상태다. **git 커밋은 아직 안 됐다** —
운영자가 검토 후 직접 터미널에서 커밋해야 한다(이 저장소 규칙상 git 쓰기 명령은 사람이
직접 실행).

### 신규 생성 파일

- `storage.rules`
  Firebase Storage 보안 규칙. `archive/**` 경로는 읽기 전체 공개(`allow read: if true`),
  쓰기는 전면 차단(`allow write: if false`). 업로드는 Admin SDK(서비스 계정)로만 하므로
  규칙 자체를 우회해서 정상 동작한다. 그 외 경로는 화이트리스트 방식으로 전부 차단.

- `scripts/upload-image-archive.js`
  Node.js 업로드 스크립트. 사용법:
  `node scripts/upload-image-archive.js <로컬원본폴더경로>`
  로컬 폴더 안 카테고리별 하위 폴더(hero/, book-covers/, backgrounds/, logos/, blog/, misc/)를
  그대로 미러링해서 Firebase Storage `archive/{카테고리}/{파일명}`으로 업로드하고,
  결과를 `data/image-archive-manifest.json`에 append한다. 이미 업로드된 경로는 건너뛰므로
  재실행해도 중복 업로드 안 됨. `image-size` 패키지로 가로/세로 픽셀도 자동 기록.
  파일 상단 주석에 사전 준비 절차(서비스 계정 키 발급 등)가 상세히 적혀 있다.

- `data/image-archive-manifest.json`
  스키마만 잡아둔 빈 초기 상태 (`images: []`). 업로드 스크립트가 실행될 때마다
  자동으로 채워진다. 각 항목: `fileName`, `category`, `storagePath`, `publicUrl`,
  `sizeKB`, `width`, `height`, `uploadedAtKST`.

### 기존 파일 수정

- `firebase.json` — `"storage": { "rules": "storage.rules" }` 키 추가
  (기존 `"hosting"` 설정은 그대로 유지)
- `package.json` — dependencies에 `firebase-admin` (^12.7.0), `image-size` (^1.1.1) 추가.
  **아직 `npm install` 실행 전이다.** Codex가 실행해서 `node_modules`, `package-lock.json`
  갱신할 것.
- `.gitignore` — 아래 패턴 추가:
  ```
  _image-archive-staging/
  firebase-service-account*.json
  *serviceAccountKey*.json
  ```
- `EZLONG_GUIDE.md` — 섹션 7에 "7-1. 대용량 사진 아카이브 — Firebase Storage" 항목 신설.
  전체 절차(최초 설정 5단계, 반복 작업 3단계, 웹페이지에서 URL 쓰는 법)가 문서화되어 있다.
  **이 프로젝트는 EZLONG_GUIDE.md를 유일한 절차 문서로 취급한다 — Codex도 별도 문서를
  새로 만들지 말고 이 섹션을 계속 갱신하는 방식으로 작업할 것.**

## 5. Codex가 이어서 해야 할 일

### 5-1. 환경 준비 (사람 개입 필요 — Codex가 대신 못 하는 부분)

- Firebase 콘솔(console.firebase.google.com) → `ezlong-541a8` 프로젝트 → Storage 섹션에서
  Storage 활성화 여부 확인. **Cloud Storage는 Blaze(종량제) 요금제가 필요할 수 있다** —
  현재 이 프로젝트가 Blaze인지 Spark(무료)인지 Codex는 API로 확인 불가능하므로,
  운영자에게 직접 확인 요청할 것.
- 프로젝트 설정 → 서비스 계정 탭 → "새 비공개 키 생성"으로 JSON 다운로드 →
  프로젝트 루트에 정확히 `firebase-service-account.json` 이름으로 저장 필요
  (이 파일은 절대 git에 올라가면 안 됨 — `.gitignore`에 이미 등록돼 있으니 실수로
  `git add -f` 하지 않도록 주의).

### 5-2. Codex가 직접 할 수 있는 부분

- 저장소 루트에서 `npm install` 실행 → `firebase-admin`, `image-size` 설치 확인
- `firebase deploy --only storage --project ezlong-541a8` 로 `storage.rules` 최초 배포
  (단, 이 저장소는 "push = 자동 배포" 구조이므로 **hosting까지 같이 배포되지 않도록
  `--only storage`를 반드시 명시할 것** — 실수로 `firebase deploy`만 실행하면 로컬의
  미추적/드래프트 파일이 함께 올라갈 위험이 있다는 경고가 CLAUDE.md에 명시돼 있다)
- 로컬 테스트용 스테이징 폴더(예: `~/Documents/ezlong-image-archive/`)를 만들고
  하위에 `hero/`, `book-covers/`, `backgrounds/`, `logos/`, `blog/`, `misc/` 폴더 구조를
  잡은 뒤, 샘플 이미지 1~2장으로 업로드 스크립트를 시험 실행해서 다음을 확인:
  - `data/image-archive-manifest.json`에 정상적으로 항목이 추가되는가
  - 생성된 `publicUrl`을 브라우저에서 직접 열었을 때 이미지가 뜨는가 (토큰 없이 접근 가능해야 정상)
  - 재실행 시 중복 업로드 없이 건너뛰는지
- 검증 완료 후 `git add data/image-archive-manifest.json firebase.json package.json
  package-lock.json .gitignore storage.rules scripts/upload-image-archive.js
  EZLONG_GUIDE.md` 로 **파일을 명시해서** 커밋 (git add -A 금지). 커밋·푸시는
  운영자 본인 터미널에서 실행하는 게 이 저장소의 원칙이지만, Codex 환경 정책에 따라
  다를 수 있으니 운영자와 확인 후 진행할 것.
- (선택, 여유 있으면) 사이트 어딘가에 실제로 아카이브 이미지 하나를 시범적으로 박아 넣어
  전체 파이프라인이 end-to-end로 동작하는지 확인 — `data/image-archive-manifest.json`을
  fetch해서 `fileName`으로 찾아 `publicUrl`을 `<img src>`에 꽂는 간단한 예시 스니펫을
  만들어보는 정도로 충분.

### 5-3. 이번 범위에 포함하지 않은 것 (건드리지 말 것)

- 기존에 이미 git 히스토리에 쌓인 대용량 원본(book02_1.png 등)을 히스토리에서 제거해서
  `.git` 2.8GB 자체를 줄이는 작업(`git-filter-repo` 등)은 **별도의 고위험 작업**이다.
  강제 push가 필요하고 히스토리를 재작성하므로 되돌리기 어렵다. 이번 작업 범위가 아니며,
  운영자가 별도로 요청하지 않는 한 손대지 말 것.
- 프로젝트 루트에 이미 있는 브랜드 자산(로고, 히어로 배경, 책 표지 등 소수 파일)을
  이 아카이브 구조로 마이그레이션하는 것도 이번 범위 밖이다. 그 파일들은 기존 방식
  (`EZLONG_GUIDE.md` 섹션 7의 "새 이미지 추가 시 절차")을 그대로 유지한다.

## 6. 요약 — 한 줄로

git 저장소는 가볍게 유지하고(URL 인덱스만), 사진 실물은 Firebase Storage
`archive/{카테고리}/` 아래 무제한으로 쌓는다. 업로드는
`node scripts/upload-image-archive.js <로컬폴더>` 한 줄로 끝나고, 결과 URL은
`data/image-archive-manifest.json`에서 찾아 쓴다. Codex는 이 파이프라인이 실제로
끝까지 동작하는지 확인하고, 서비스 계정 발급 등 사람 손이 필요한 부분은 운영자에게
명확히 요청하면 된다.
