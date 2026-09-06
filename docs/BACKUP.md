# 백업과 원복: ezlong.com

한 문장으로: **진실은 GitHub에 있고, 맥은 사본이며, 라이브는 결과물이다.**
맥이 사라져도, 내가 사고를 쳐도, 어제 아침으로 돌아갈 수 있어야 한다. 이 문서가 그 방법이다.

최종 갱신: 2026-09-06

---

## 1. 무엇이 어디에 있나

- **코드·화면·데이터(JSON)·문서**: 전부 `github.com/ziririt/ezlong` (private). 봇이 하루 200번 커밋한다.
  저장소가 곧 백업이다. 커밋 하나하나가 되감기 지점이다.
- **라이브 사이트**: Firebase Hosting. main에 push되면 2~3분 뒤 배포된다.
  Firebase는 **배포 릴리스 이력을 따로 갖고 있다.** 콘솔에서 한 번 눌러 이전 릴리스로 되돌릴 수 있다.
- **비밀(API 키)**: GitHub 저장소 시크릿에만. 값은 어디에도 백업하지 않는다.
  잃으면 **재발급**한다. 무엇을 재발급해야 하는지는 `docs/api-keys.md`가 안다.
- **맥에만 있는 것**: `~/.config/ezlong/gemini-key`(키 사본), git 자격 증명. 둘 다 재발급으로 복구된다.
  **맥에만 있어서 잃으면 끝인 것은 없다.** 그렇게 유지한다.

## 2. 되감기 지점 (자동)

`.github/workflows/daily-backup.yml`이 찍는다. 태그라서 저장소 크기에 영향이 없다.

- `backup/YYYY-MM-DD`: 매일 **KST 00:00**. 10일 보존
- `backup/YYYY-MM-DD-am`: 매일 **KST 09:00**. 10일 보존. **"어제 아침 버전"이 이것이다**
- `backup/w-YYYY-Www`: 매주 월요일. 8주 보존
- `backup/m-YYYY-MM`: 매월 1일. 12개월 보존
- `stable-YYYYMMDD[-slug]`: **중요한 판.** 사람이 손으로 찍는다. **영구 보존.** 큰 작업 전후에 찍는다
- `cp-YYYYMMDD-slug`: 작업 단위 체크포인트. 사람이 찍는다. 영구 보존

**보존 규칙 요약.** 자동 태그는 일간 10 + 아침 10 + 주간 8 + 월간 12. 사람이 찍은 `stable-*`·`cp-*`는
자동 정리가 **절대 건드리지 않는다.** 성동님이 말씀하신 "중요한 버전은 직전 2회까지"는
`stable-*`을 최소 셋(지금 판 + 직전 둘) 남기면 된다. 셋 넘게 남아도 해롭지 않으니 지우지 않는다.

같은 워크플로가 **전체 사본**도 남긴다. `git bundle`(모든 브랜치·태그) + HTML·scripts·docs를
GitHub Actions 아티팩트로 **30일** 보존. GitHub 웹 → Actions → Daily Backup → 실행 → Artifacts.

## 3. 외부 사본 (GitHub 밖) : 시크릿 하나면 켜진다

GitHub 계정이 잠기거나 저장소가 삭제되는 경우에 대비한다. 워크플로에 이미 단계가 들어 있고,
시크릿 `MIRROR_GIT_URL`이 있으면 매일 두 번 `git push --mirror`로 통째로 복사한다.

켜는 법(10분, 성동님 손):
1. GitLab(gitlab.com) 무료 계정을 만든다. **GitHub과 다른 회사**여야 의미가 있다.
2. 빈 private 프로젝트 `ezlong-mirror`를 만든다.
3. GitLab → Settings → Access Tokens → 토큰 발급(scope: `write_repository`, 만료 1년).
4. GitHub → ziririt/ezlong → Settings → Secrets → Actions → New secret
   이름 `MIRROR_GIT_URL`, 값 `https://oauth2:<토큰>@gitlab.com/<계정>/ezlong-mirror.git`
5. Actions → Daily Backup → Run workflow. 로그 끝에 "외부 미러 push 완료"가 뜨면 끝.
6. `docs/api-keys.md`에 이 토큰의 만료일을 적는다.

시크릿이 없으면 그 단계는 건너뛰고 나머지는 정상 동작한다. 켜지 않았다면 이 문서 맨 위 날짜 옆에
"외부 미러 미설정"이라고 적어 두는 것이 정직하다. **2026-09-06 현재: 미설정.**

## 4. 원복하는 법 (세 가지, 빠른 것부터)

### 4-1. 라이브가 망가졌다. 5분 안에 되돌려야 한다
Firebase 콘솔 → Hosting → 릴리스 기록 → 직전 릴리스 옆 메뉴 → **롤백.** 코드는 그대로 두고
라이브만 이전 판으로 돌아간다. 봇의 다음 push가 다시 덮어쓰니, 그 사이에 4-2를 한다.

### 4-2. 코드를 어제 아침으로 되감는다 (표준 절차)
force push는 금지다. **되감기도 새 커밋으로 한다.** 이력이 남고, 봇 데이터와 충돌하지 않는다.

```bash
# 맥 쪽 셸 작업용 클론에서 (HANDOFF 7-2)
cd $HOME/ezpush && git fetch --tags origin && git reset --hard origin/main
git tag -l 'backup/*' | tail -5                 # 되감을 지점 고르기
git checkout backup/2026-09-05-am -- . ':!data'  # 코드·화면만 어제 아침으로. data/는 봇 것이라 놔둔다
git status --short | head                        # 무엇이 바뀌는지 눈으로 본다
git add -u && git add .
git commit -m "revert: backup/2026-09-05-am 시점으로 되감기 (사유: ...)"
git push origin main
```
2~3분 뒤 라이브가 그 시점으로 돌아간다. `data/`까지 되감아야 하면 `':!data'`를 빼되,
그 다음 정규 실행이 데이터를 다시 채운다는 것을 안다.

### 4-3. 파일 하나만 되돌린다
```bash
git checkout backup/2026-09-05-am -- atmr-dashboard.html
git commit -am "revert: atmr-dashboard.html 을 09-05 아침 판으로" && git push origin main
```

### 4-4. 저장소가 통째로 사라졌다
GitLab 미러(3장)가 있으면 `git clone https://gitlab.com/<계정>/ezlong-mirror.git`로 끝.
없으면 30일 안의 Actions 아티팩트 bundle을 내려받아 `git clone ezlong-YYYY-MM-DD.bundle ezlong`.
그것도 없으면 성동님 맥의 `/Users/ziririt/Developer/ezlong`이 마지막 사본이다(`git pull`을 안 했다면 그만큼 낡았다).

## 5. 사람이 지킬 규칙

- **큰 작업 전에 `stable-YYYYMMDD-slug` 태그를 찍는다.** 되감을 곳을 먼저 만들고 손댄다.
- **force push 금지, `git add -A` 금지, `git reset --hard`는 샌드박스 동기화용으로만.** (CLAUDE.md 2·16·28항)
- **원복도 커밋이다.** 이력을 지우는 방식으로 되감지 않는다.
- **비밀은 백업하지 않는다. 재발급한다.** `docs/api-keys.md`를 최신으로 유지한다.
- 백업 워크플로가 이틀 연속 실패하면 그것부터 고친다. 백업이 죽어 있는 줄 모르는 것이 가장 나쁘다.

## 6. 점검

- 매일 09:00 KST 자동 점검(클라우드 예약 작업)이 파이프라인 정지와 키 만료를 본다.
- 이 워크플로 자체의 성공 여부는 GitHub → Actions → Daily Backup 에서 본다.
- 분기마다 한 번, **실제로 되감아 본다.** 4-3으로 파일 하나를 어제 판으로 돌리고 다시 원래대로. 연습 안 한 복구 절차는 없는 것과 같다.
