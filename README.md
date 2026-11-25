# paseo-plugins

개인용 [Paseo](https://paseo.sh) 플러그인 모음이다. 플러그인 하나당 폴더 하나를 둔다.

| 플러그인 | 하는 일 |
|---|---|
| [`worktree-sibling-placement`](./worktree-sibling-placement) | 새 worktree를 원본 저장소 옆 `<저장소명>__worktrees/<브랜치명>`에 만든다 |

## worktree-sibling-placement

Paseo는 기본적으로 worktree를 `~/.paseo/worktrees/<해시>/<랜덤 slug>/`에 만든다. 이 플러그인은 `worktree.create.before` 훅에서 경로를 바꿔, 원본 저장소 옆의 `__worktrees` 폴더에 브랜치명으로 만든다. 브랜치명의 `/`는 `-`로 바꾼다.

```
~/Documents/github/fan-maum/
  fanplus-api/                         ← 원본 저장소
  fanplus-api__worktrees/
    feat-cms-star-many-to-many/        ← 브랜치 feat/cms-star-many-to-many
    feat-cms-person-api/               ← 브랜치 feat/cms-person-api
```

- 앱, CLI, MCP, 에이전트 생성 등 Paseo가 worktree를 만드는 모든 경로에 적용된다. 이 daemon에 등록된 모든 프로젝트가 대상이다.
- When a worktree is created with a first prompt but no branch name, the plugin asks `claude -p --model haiku` for a branch name (e.g. `fix-worktree-auto-branch-name`) before the worktree exists, and uses it for both the branch and the folder. If a local branch or folder with that name already exists, it appends `-2`, `-3`, and so on.
  - Paseo also names branches with AI, but it first creates the worktree under a random name (e.g. `tranquil-newt`) and then renames only the branch. Without this plugin, the folder keeps the random name.
  - If the daemon cannot find the `claude` CLI, the call takes longer than 20 seconds, or the reply is not a usable name, the folder gets Paseo's random branch name. The reason is logged as a `branch name from first prompt skipped: …` line in `paseo plugin logs worktree-sibling-placement`.
  - No name is generated when there is no first prompt, or when an existing branch or PR is checked out.
- 같은 경로가 이미 있으면 worktree 생성이 실패한다. Paseo는 플러그인이 정한 경로에 접미사를 붙여 주지 않는다. 같은 브랜치로 다시 만들려면 기존 worktree를 먼저 정리한다.
- Besides the disk path, the only thing the plugin changes is the branch name above. The workspace name shown in the app keeps Paseo's default (the branch name, e.g. `feat/worktree`). To change it, run `paseo workspace rename <workspace-id> <name>`.
- 요구 버전: Paseo `>=0.17.4` (`paseo-plugin.json`의 `requirements.paseo`).

## 이 PC에 설치

플러그인은 daemon 단위로 설치한다. 플러그인 기능은 daemon마다 한 번 켜야 한다. 플러그인 코드는 샌드박스 없이 daemon 머신의 파일, 프로세스, 자격증명에 접근할 수 있으니 직접 확인한 코드만 설치한다.

```bash
# 플러그인 기능 켜기. 앱의 Settings → Plugins → Enable plugins와 같다
#   ~/.paseo/config.json 최상위에 "pluginsEnabled": true 를 넣고
paseo reload --json          # appliedPaths에 pluginsEnabled가 있으면 적용된 것이다

# 플러그인 설치. 반드시 절대경로를 준다
cd ~/Documents/github/crookedbot/crookedsystem/paseo-plugins/worktree-sibling-placement
npm install                  # 타입 검사용 개발 의존성이다. 실행에는 필요 없다
npm run typecheck
paseo plugin install "$PWD"

paseo plugin ls              # STATUS가 running이면 된다
```

로컬 경로로 설치하면 Paseo는 이 폴더의 코드를 복사하지 않고 그 자리에서 실행한다(`paseo plugin ls`의 DIRECTORY가 이 폴더다).

이 저장소도 Paseo 프로젝트로 등록해 두면 앱에서 에이전트로 수정할 수 있다.

```bash
paseo project create ~/Documents/github/crookedbot/crookedsystem/paseo-plugins
```

## 다른 PC에서 쓰기

먼저 그 PC가 worktree를 만드는 daemon이 어디인지 확인한다. 훅은 worktree를 만드는 daemon에서만 실행된다.

### 그 PC가 자기 daemon을 쓰는 경우

그 PC의 daemon에도 설치해야 한다. 플러그인을 고칠 생각이 있으면 clone한 뒤 로컬 경로로 설치하는 방법을 권한다.

```bash
git clone git@github.com:crookedsystem/paseo-plugins.git ~/Documents/github/crookedbot/crookedsystem/paseo-plugins
cd ~/Documents/github/crookedbot/crookedsystem/paseo-plugins/worktree-sibling-placement
npm install && npm run typecheck
paseo plugin install "$PWD"
paseo project create ~/Documents/github/crookedbot/crookedsystem/paseo-plugins   # 선택
```

그 PC에서도 위의 `pluginsEnabled` 설정과 `paseo reload`가 필요하다. 이후 변경은 `git pull` 후 `paseo plugin reload worktree-sibling-placement`로 반영한다.

고칠 일이 없다면 git 소스로 바로 설치할 수도 있다. 이 방법은 Paseo가 관리하는 폴더(`~/.paseo/plugins/` 아래)에 내려받는다. 그 폴더는 `update`나 `remove`를 할 때 덮어쓰이거나 지워지므로 거기서 수정하지 않는다.

```bash
paseo plugin add git:crookedsystem/paseo-plugins:worktree-sibling-placement
paseo plugin update worktree-sibling-placement   # 이후 변경 반영
```

비공개 저장소라면 그 PC의 daemon이 git으로 접근할 수 있어야 한다(SSH 키 등).

`paseo plugin add roundreddot/better-paseo`처럼 `owner/slug`만 쓰는 형식은 [Paseo 플러그인 레지스트리](https://paseo.sh/plugins)에 등록된 플러그인에만 쓸 수 있다. 이 플러그인은 레지스트리에 등록하지 않았으므로 위의 `git:` 형식을 쓴다.

### 그 PC가 이 Mac의 daemon에 원격으로 접속하는 경우

설치할 것이 없다. worktree는 이 Mac의 daemon에서 만들어지고 훅도 여기서 실행된다.

## 수정과 반영

daemon을 재시작하지 않는다. 재시작하면 실행 중인 에이전트가 끊긴다.

```bash
cd ~/Documents/github/crookedbot/crookedsystem/paseo-plugins/worktree-sibling-placement
# index.server.ts 수정
npm run typecheck
paseo plugin reload worktree-sibling-placement
paseo plugin ls                                    # running인지 확인
paseo plugin logs worktree-sibling-placement       # "worktree path: <브랜치> → <경로>" 로그로 동작을 확인
```

플러그인 수정은 이 저장소의 원본 폴더(local 워크스페이스)에서 한다. 설치된 플러그인은 원본 폴더의 코드로 실행된다. 이 저장소의 Paseo worktree에서 고친 내용은 원본 폴더에 머지하고 reload해야 반영된다.

## 문제가 생겼을 때

훅이 예외를 던지면 worktree 생성 자체가 중단된다. 플러그인에 문제가 생기면 모든 프로젝트에서 worktree를 만들 수 없게 된다. 그럴 때는 먼저 플러그인을 끄고 원인을 본다.

```bash
paseo plugin disable worktree-sibling-placement    # 끄면 Paseo 기본 위치로 돌아간다
paseo plugin logs worktree-sibling-placement       # 오류 출력 확인
paseo plugin ls                                    # ERROR 열 확인
# 원본 폴더에서 고친 뒤
npm run typecheck
paseo plugin enable worktree-sibling-placement
```

완전히 지우려면 `paseo plugin remove worktree-sibling-placement`를 실행한다. 로컬 경로로 설치했다면 소스 폴더는 지워지지 않는다.

## 참고 문서

- [Plugin hooks](https://paseo.sh/docs/plugins/hooks.md)
- [Plugins](https://paseo.sh/docs/plugins.md)
- [Publishing](https://paseo.sh/docs/plugins/publishing.md)
- [Worktrees](https://paseo.sh/docs/worktrees.md)
