# ezlong.com 안전 매뉴얼
## 재발방지책 · 백업 시스템 · 사고 대응

> 작성일: 2026-06-14 (토)  
> 배경: HTML·이미지·알고리즘 전체 유실 → 14시간 재구축 사고 이후 수립

---

## 1. 사고 원인 분석

### 이번 사고 (2026-06-14) 발생 메커니즘

HTML 파일들을 2026-05-27에 GitHub 웹 UI로 직접 업로드했다 (`Add files via upload`).
이후 로컬에서 수정한 파일들이 **git에 커밋되지 않은 채** 로컬에만 존재했다.
`git pull --rebase` 실행 시 git이 "로컬 변경 없음, 원격이 최신"으로 판단해
5월 27일 버전으로 로컬 파일을 덮어씌웠다.
백업이 없었기 때문에 복구 불가능했고, 14시간 재구축이 필요했다.

### 핵심 교훈

- 로컬에 파일이 있어도 git에 커밋하지 않으면 언제든 삭제·덮어씌워질 수 있다.
- git은 미커밋 파일을 보호하지 않는다.
- 백업 없이는 어떤 작업도 안전하지 않다.

---

## 2. 재발방지책 — Claude 작업 규칙

### 규칙 1: 세션 시작 전 백업 확인 (절대 생략 불가)

Claude가 파일 수정을 시작하기 전에 반드시 백업 스크립트 실행 여부를 확인한다.
백업 완료 메시지 확인 전까지 파일 수정을 시작하지 않는다.

```bash
sh ~/Documents/Claude/Projects/미국주식투자자를\ 위한\ ezlong.com/backup-before-session.sh
```

### 규칙 2: Claude는 sandbox에서 git 쓰기 명령을 실행하지 않는다

Claude의 bash 샌드박스에서는 `git log`, `git status`, `git diff`(읽기 전용)만 허용.
`git add`, `git commit`, `git push`, `git pull`, `git rebase`, `git stash`는 반드시
유저가 터미널에서 직접 실행한다.

이유: 샌드박스 git은 lock file, Bus error, 부분 실패가 반복된다.
"Everything up-to-date" 메시지가 떠도 실제로 push가 안 된 채 배포가 실행되는 사고가 발생한다.

### 규칙 3: 이미지/에셋은 추가 즉시 단독 커밋

새 이미지를 프로젝트 폴더에 추가하면 다른 코드 작업과 분리해서 먼저 커밋·push한다.

```bash
git add wallstreet.png logo.png [새이미지파일]
git commit -m "assets: 이미지 파일 추가"
git push origin main
```

이미지가 로컬에 있어도 git에 없으면 Firebase에서 엑박으로 표시된다.

### 규칙 4: push 순서 — pull-first 철칙

GitHub Actions가 30분마다 `data/*.json`을 자동 커밋하기 때문에
항상 원격이 로컬보다 앞서 있을 수 있다.

```bash
git pull origin main                    # 1. 반드시 먼저
git add [수정한 파일명만 명시적으로]    # 2. git add -A 금지
git commit -m "설명"                    # 3. 커밋
git push origin main                    # 4. push
firebase deploy --only hosting          # 5. push 성공 확인 후에만 배포
```

### 규칙 5: 대형 작업 전 git tag (롤백 포인트)

파일 10개 이상 동시 수정 또는 핵심 알고리즘 변경 전 실행:

```bash
git tag -f "stable-$(date +%Y%m%d)"
git push origin --tags
```

### 규칙 6: 배포 후 백업 실행

작업 완료 → 배포 확인 → 반드시 백업 스크립트 실행.

```bash
sh ~/Documents/Claude/Projects/미국주식투자자를\ 위한\ ezlong.com/backup-before-session.sh
```

---

## 3. 3중 백업 시스템

### Layer 0 · Layer 1 — 로컬 Mac 하드디스크 (+ iCloud 자동 동기화)

저장 위치:
```
~/Documents/ezlong-backups/session_YYYYMMDD_HHMMSS/
```

백업 내용: 핵심 HTML 파일 전체 + scripts/ + wallstreet.png / logo.png / logo-darkmode.png

실행 방법:
- Layer 0 (수동): 세션 시작 전 / 배포 후 직접 실행
  ```bash
  sh ~/Documents/Claude/Projects/미국주식투자자를\ 위한\ ezlong.com/backup-before-session.sh
  ```
- Layer 1 (자동): macOS launchd가 매일 오후 12:30에 자동 실행
  설치 위치: `~/Library/LaunchAgents/com.ezlong.daily-backup.plist`

보존 기간: 10일치 자동 유지, 11일 이상 된 폴더는 스크립트가 자동 삭제

iCloud 연동: `~/Documents/`가 iCloud Drive 동기화 중이면 이 폴더도 자동으로 iCloud에 업로드됨 → 사실상 클라우드 백업 겸용

### Layer 2-A — GitHub git 태그 (자동)

저장 위치:
```
https://github.com/ziririt/ezlong
태그: backup/2026-06-14  (날짜별 자동 생성)
```

GitHub Actions `daily-backup.yml`이 매일 KST 00:00에 자동 실행.
그날의 git HEAD 커밋에 `backup/YYYY-MM-DD` 태그를 붙인다.
보존 기간: 10일치, 11일 지난 태그는 Actions가 자동 삭제.

태그 목록 확인:
```bash
git tag -l "backup/*"
```

특정 날짜 파일 1개만 복구:
```bash
git checkout backup/2026-06-07 -- analyst-reports.html
```

### Layer 2-B — GitHub Actions Artifact (자동)

저장 위치:
```
https://github.com/ziririt/ezlong/actions
워크플로우: Daily Backup — HTML + Scripts + Images
각 Run의 Artifacts 탭
파일명 예시: ezlong-backup-2026-06-14.zip
```

HTML 전체 + scripts/ + 이미지를 zip으로 다운로드 가능.
GitHub 사이트에서 마우스 클릭으로 다운로드.
보존 기간: 10일.

---

## 4. 사고 발생 시 복구 절차

### Step 1 — 로컬 백업에서 즉시 복구 (가장 빠름)

```bash
# 백업 목록 확인
ls ~/Documents/ezlong-backups/

# 가장 최근 백업에서 특정 파일 복구
cp ~/Documents/ezlong-backups/session_가장최근폴더/analyst-reports.html \
   ~/Documents/Claude/Projects/미국주식투자자를\ 위한\ ezlong.com/

# 전체 HTML 복구
cp ~/Documents/ezlong-backups/session_가장최근폴더/*.html \
   ~/Documents/Claude/Projects/미국주식투자자를\ 위한\ ezlong.com/
```

### Step 2 — git 태그로 특정 날짜 파일 복구

```bash
# 사용 가능한 태그 확인
git tag -l "backup/*"

# 특정 날짜의 특정 파일만 복구
git checkout backup/2026-06-13 -- atmr-dashboard.html

# 여러 파일 동시 복구
git checkout backup/2026-06-13 -- analyst-reports.html atmr-dashboard.html chart-analysis.html
```

### Step 3 — GitHub Actions Artifact 전체 다운로드

1. https://github.com/ziririt/ezlong/actions 접속
2. 왼쪽 `Daily Backup — HTML + Scripts + Images` 클릭
3. 복구하려는 날짜의 Run 클릭
4. 하단 Artifacts 섹션 → `ezlong-backup-YYYY-MM-DD` 클릭해서 zip 다운로드
5. 압축 해제 후 필요한 파일을 프로젝트 폴더에 복사

### Step 4 — git 커밋 이력에서 복구 (최후 수단)

```bash
# 최근 커밋 이력 확인
git log --oneline -20

# 특정 커밋 시점의 파일 복구 (파일명 지정 필수)
git checkout [커밋해시] -- analyst-reports.html

# git reset --hard 는 절대 사용 금지 → 현재 작업 전체 삭제됨
```

---

## 5. 백업 위치 전체 요약

| 레이어 | 저장 위치 | 실행 시점 | 보존 |
|--------|-----------|-----------|------|
| Layer 0 | `~/Documents/ezlong-backups/session_*/` | 세션 전·배포 후 수동 | 10일 |
| Layer 1 | `~/Documents/ezlong-backups/session_*/` | 매일 12:30 자동 (launchd) | 10일 |
| Layer 2-A | GitHub 태그 `backup/YYYY-MM-DD` | 매일 00:00 KST 자동 (Actions) | 10일 |
| Layer 2-B | GitHub Actions Artifact (zip) | 매일 00:00 KST 자동 (Actions) | 10일 |

iCloud Drive Documents 동기화 시 Layer 0·1은 자동으로 iCloud에도 저장됨.

---

## 6. 매 세션 체크리스트 (Claude에게 요청할 순서)

```
1. 백업 스크립트 실행 확인 요청
2. Claude 파일 수정 작업
3. 유저가 터미널에서 git pull → add → commit → push 실행
4. firebase deploy --only hosting
5. 브라우저에서 변경 내용 확인 (Cmd+Shift+R)
6. 배포 후 백업 스크립트 재실행
```

---

*이 문서는 EZLONG_GUIDE.md 섹션 0 및 Claude 메모리에도 동기화되어 있다.*  
*Claude는 매 세션 시작 시 EZLONG_GUIDE.md를 읽고 이 규칙들을 자동으로 참조한다.*
