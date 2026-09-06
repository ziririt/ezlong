# 새 맥에서 30분 안에 다시 시작하기: ezlong.com

맥을 잃어버렸거나, 새 맥으로 바꿨거나, 다른 사람이 이어받는다. 이 문서 하나로 다시 일할 수 있게 쓴다.
**맥에는 원본이 없다.** 진실은 GitHub에 있고 맥은 사본이다(`docs/BACKUP.md` 1장). 그래서 복구는 짧다.

최종 갱신: 2026-09-06

---

## 0. 필요한 것

- GitHub 계정 `ziririt`에 로그인할 수 있어야 한다. 없으면 `docs/SUCCESSION.md`로 간다.
- 맥에 클로드 데스크톱 앱(Cowork). 개발은 클라우드 세션에서 하고 맥은 손발이다(CLAUDE.md 28항, HANDOFF 7-2).

## 1. 맥 준비 (10분)

```bash
xcode-select --install          # git 포함. 이미 있으면 그냥 넘어간다
brew --version || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install gh node python@3.12
gh auth login                   # 브라우저로 GitHub 로그인. 여기서 사람이 한다
```

## 2. 저장소 (5분)

```bash
mkdir -p ~/Developer && cd ~/Developer
git clone https://github.com/ziririt/ezlong.git      # 전체 이력. 봇 커밋이 많아 수 분 걸린다
cd ezlong && git log --oneline -3 && git tag -l 'stable-*' | tail -3
```
원격 URL에 토큰을 박지 않는다. `gh auth login`이 자격 증명을 키체인에 맡긴다.
경로가 `~/Developer/ezlong`이면 HANDOFF·CLAUDE.md의 경로 표기가 그대로 맞는다.

## 3. 맥에만 있던 파일 다시 만들기 (5분)

- `~/.config/ezlong/gemini-key`: 사진 분류 스크립트가 로컬 실행 때 읽는 Gemini 키 사본.
  Google AI Studio에서 키를 **새로 발급**해 넣는다(옛 맥의 키는 분실 시 폐기한다).
  ```bash
  mkdir -p ~/.config/ezlong && printf '%s' '<새 키>' > ~/.config/ezlong/gemini-key && chmod 600 ~/.config/ezlong/gemini-key
  ```
  그리고 GitHub 시크릿 `GEMINI_API_KEY`도 같은 새 키로 바꾼다. **두 곳이 한 벌이다.**
- 그 밖에 맥에만 있어야 하는 파일은 **없다.** 있다면 그게 버그다. 저장소나 시크릿으로 옮긴다.

## 4. 클로드(Cowork) 연결 (5분)

1. 클로드 데스크톱 앱 로그인(클로드 계정: `ziririt@aladin.co.kr`).
2. 새 작업 만들기. 실행 위치 **클라우드**, 이 컴퓨터에 연결.
3. 폴더 추가 → **Command+Shift+G** → `/Users/<사용자>/Developer/ezlong`.
   (사이드바에서 고르면 이름만 같은 다른 폴더가 잡힐 수 있다. 실제 경험이다.)
4. 첫 메시지는 `HANDOFF.md` 맨 끝의 "다음 계정에서 붙여넣을 문장"을 그대로.
5. 배포용 GitHub fine-grained 토큰을 새로 발급한다(저장소 하나, Contents 쓰기, 90일).
   클라우드 세션의 클로드가 맥 쪽 셸에 클론을 만들고 그 토큰으로 push한다(HANDOFF 7-2).
   옛 맥에서 쓰던 토큰은 폐기한다.

## 5. 잃어버린 맥 뒷정리 (사람이, 당일)

- GitHub → Settings → Developer settings → 토큰 전부 폐기 후 재발급
- Google AI Studio → 옛 Gemini 키 폐기, 시크릿 교체
- GitHub → Settings → Sessions 에서 옛 기기 세션 로그아웃
- 클로드·구글·Firebase 계정 비밀번호 변경, 2단계 인증 확인
- `docs/api-keys.md`의 날짜를 오늘로 다시 적는다

## 6. 잘 됐는지 확인

- `git push --dry-run origin main` 이 `Everything up-to-date`면 쓰기 권한이 산 것이다
- GitHub Actions에서 최근 24시간 실행이 초록이면 파이프라인은 맥과 무관하게 돌고 있다
- https://ezlong.com 첫 화면 시각이 최근이면 라이브는 멀쩡하다

맥은 없어도 사이트는 돈다. 봇은 GitHub에서 돌고 배포는 Firebase가 한다.
**서두를 것은 토큰 폐기 하나다.** 나머지는 천천히 해도 된다.
