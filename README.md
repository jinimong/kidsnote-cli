# kidsnote-cli

키즈노트 알림장과 공지사항 데이터를 JSON 형식으로 조회하는 명령줄 도구입니다. AI 에이전트와 연동하여 자녀의 유치원 소식을 요약하거나 분석하는 용도로 설계되었습니다.

> **면책 조항**: 이 프로젝트는 키즈노트(주)와 무관한 비공식 개인 프로젝트입니다. 본인 자녀의 데이터를 개인적으로 조회하는 용도로만 사용하세요.

---

## 빠른 시작

1. **설치**: 터미널에서 아래 명령어를 실행하세요.
   ```bash
   curl -fsSL https://raw.githubusercontent.com/jinimong/kidsnote-cli/refs/heads/main/install.sh | bash
   ```
2. **로그인**: 아이디와 비밀번호를 입력하여 인증을 완료하세요.
   ```bash
   kidsnote login
   ```
3. **데이터 조회**: 이번 주의 알림장을 조회해 보세요.
   ```bash
   kidsnote report --this-week
   ```

---

## 설치

### 사전 요건

| 항목 | 버전 |
| --- | --- |
| Node.js | v18 이상 (내장 `fetch` 지원) |
| npm | v9 이상 |

Playwright chromium은 설치 과정에서 자동으로 함께 설치됩니다.

### 설치 경로

설치 스크립트는 다음과 같이 구성합니다:

- 소스 및 런타임: `~/.kidsnote/` 디렉토리에 클론 및 빌드
- 실행 래퍼: `~/.kidsnote/bin/kidsnote` 생성
- 심볼릭 링크: `~/.local/bin/kidsnote` → `~/.kidsnote/bin/kidsnote`

심볼릭 링크 경로는 `KIDSNOTE_BIN` 환경변수로 변경할 수 있습니다. 설치 스크립트가 사용 중인 셸의 설정 파일(`.zshrc`, `.bashrc` 등)에 PATH를 자동 추가합니다.

### 업데이트
최신 버전으로 업데이트하려면 아래 명령어를 사용하세요.
```bash
kidsnote update
```

### 제거

설치 디렉토리(`~/.kidsnote/`), 캐시, 세션 데이터, Playwright 브라우저까지 모두 삭제합니다.

```bash
curl -fsSL https://raw.githubusercontent.com/jinimong/kidsnote-cli/main/uninstall.sh | bash
```

---

## 인증

### 로그인 방식
- **대화형**: `kidsnote login` 실행 후 안내에 따라 입력합니다.
- **비대화형**: `--password-stdin` 옵션을 사용하여 비밀번호를 전달합니다.
  ```bash
  echo "your_password" | kidsnote login -u user@email.com --password-stdin
  ```
- **환경변수**: `KIDSNOTE_USERNAME`, `KIDSNOTE_PASSWORD`를 설정하여 사용할 수 있습니다.

**자격증명 우선순위**: CLI 옵션 → 저장된 아이디 → 환경변수

### 세션 관리

로그인 시 세션 쿠키가 암호화되어 `~/.kidsnote/data/session.enc`에 저장됩니다. 비밀번호는 저장하지 않으며, 아이디만 `credentials.json`에 보관됩니다.

세션에는 서버로부터 받은 유효 기간(TTL)이 설정됩니다:
- 만료된 세션은 다음 사용 시 자동 삭제되고 재로그인을 요청합니다.
- API 호출 중 인증 실패(401/403) 응답을 받으면 즉시 세션을 삭제합니다.
- TTL 정보가 없는 세션은 서버가 만료시킬 때까지 유지됩니다.

### 상태 확인 및 로그아웃
```bash
kidsnote login --status  # 현재 세션 유효 여부 확인
kidsnote logout          # 로컬 세션 데이터 즉시 삭제
```

---

## 명령어

모든 명령어는 결과를 JSON으로 stdout에 출력합니다. 에러 시 `{"error":"..."}` 형태로 stderr에 출력하고 종료 코드 1을 반환합니다.

### login

인증을 수행합니다.

| 옵션 | 설명 |
| --- | --- |
| `-u, --username <id>` | 아이디 지정 |
| `-p, --password <pw>` | 비밀번호 지정 (프로세스 목록에 노출되므로 비권장) |
| `--password-stdin` | 표준 입력으로 비밀번호 수신 (CI/자동화 권장) |
| `--status` | 현재 로그인 상태를 JSON으로 출력 |

```bash
kidsnote login                                                    # 대화형
echo "$KIDSNOTE_PASSWORD" | kidsnote login -u user@email.com --password-stdin  # CI용
kidsnote login --status                                           # 상태 확인
```

### logout

저장된 자격증명과 세션을 모두 삭제합니다.

```bash
kidsnote logout
```

### report

알림장을 조회합니다. 날짜 옵션은 하나만 선택할 수 있습니다.

| 옵션 | 설명 |
| --- | --- |
| `--today` | 오늘 데이터만 조회 |
| `--this-week` | 이번 주 월요일부터 오늘까지 조회 |
| `--from <YYYY-MM-DD>` | 시작 날짜 |
| `--to <YYYY-MM-DD>` | 종료 날짜 |
| `--no-cache` | 캐시를 무시하고 새로 가져오기 |

```bash
kidsnote report --today
kidsnote report --this-week
kidsnote report --from 2026-03-10 --to 2026-03-14
kidsnote report --this-week --no-cache
```

출력 예시:

```json
[
  { "date": "2026-03-10", "items": [...] },
  { "date": "2026-03-11", "items": [...] }
]
```

### notice

공지사항을 조회합니다. 옵션은 `report`와 동일합니다.

```bash
kidsnote notice --today
kidsnote notice --this-week
kidsnote notice --from 2026-03-10 --to 2026-03-14
```

### archive

수집된 JSON 데이터를 날짜별 마크다운으로 아카이빙합니다.

| 옵션 | 설명 |
| --- | --- |
| `--reports <path>` | 알림장 JSON 파일 경로 (기본: `./data/reports.json`) |
| `--albums <path>` | 앨범 JSON 파일 경로 (기본: `./data/albums.json`) |
| `--days <path>` | 일자별 병합 데이터 경로 |
| `--output <path>` | 출력 디렉토리 (기본: `./archive`) |
| `--no-download` | 미디어 파일 다운로드 건너뛰기 |
| `--cookie <value>` | 세션 쿠키 직접 전달 (미지정 시 `KIDSNOTE_COOKIE` 환경변수 사용) |

### update

최신 버전으로 업데이트합니다.

```bash
kidsnote update
```

### plugin

플러그인을 관리합니다.

```bash
kidsnote plugin install <초대코드>   # base64 초대 코드로 플러그인 설치
kidsnote plugin list                # 설치된 플러그인 목록 확인
kidsnote plugin remove <이름>       # 플러그인 삭제
```

---

## 캐싱

`report`와 `notice` 명령어는 날짜별로 캐시 파일을 생성합니다.

- 저장 위치: `~/.kidsnote/cache/daily/`
- 파일명: `reports-2026-03-21.json`, `notices-2026-03-21.json`

**부분 적중(Partial Hits)**: 요청한 기간 중 이미 캐시된 날짜는 재사용하고, 누락된 날짜만 서버에서 가져옵니다. 예를 들어 월~금 조회 시 월~수가 캐시되어 있으면 목~금만 새로 요청합니다.

`--no-cache` 옵션으로 캐시를 무시하고 전체를 새로 가져올 수 있습니다.

---

## 플러그인

`~/.kidsnote/plugins/` 디렉토리에 `.js` 파일을 설치하여 기능을 확장할 수 있습니다. 초대 코드를 전달받은 경우 아래 명령어로 설치합니다:

```bash
kidsnote plugin install <초대코드>
kidsnote plugin list
kidsnote plugin remove <이름>
```

---

## 파일 구조

사용자 데이터는 모두 홈 디렉토리의 `.kidsnote` 폴더에서 관리됩니다.

```
~/.kidsnote/
├── bin/kidsnote          ← 실행 래퍼 파일
├── data/
│   ├── credentials.json  ← 저장된 아이디 (비밀번호 미포함)
│   ├── session.enc       ← 암호화된 세션 데이터
│   └── session.key       ← 세션 복호화 키
├── cache/
│   └── daily/
│       ├── reports-2026-03-21.json
│       └── notices-2026-03-21.json
├── plugins/              ← 설치된 확장 플러그인
├── dist/                 ← 실행 소스 코드
└── node_modules/         ← 관련 라이브러리
```

---

## 에이전트 연동

kidsnote-cli는 AI 에이전트나 자동화 스크립트에서 활용하기 최적화되어 있습니다. 모든 출력이 JSON이므로 `jq` 같은 도구와 조합하여 필요한 정보만 추출하기 쉽습니다.

```bash
# 이번 주 알림장 내용만 텍스트로 추출
kidsnote report --this-week | jq -r '.[].items[].content'
```

---

## 문제 해결

| 증상 | 해결 방법 |
| :--- | :--- |
| `Executable doesn't exist` | `npx playwright install chromium` 실행 |
| `인증이 만료되었습니다` | `kidsnote login` 재실행 (세션이 자동 삭제된 상태) |
| 날짜 형식 에러 | `YYYY-MM-DD` 형식인지 확인 |
| `센터 ID를 찾을 수 없습니다` | `kidsnote logout` 후 다시 로그인 |
| `kidsnote: command not found` | `~/.local/bin`이 PATH에 포함되어 있는지 확인 |
| 세션이 자동 삭제됨 | 만료 기간 경과 또는 서버 인증 실패로 정리된 것이므로 재로그인 |

---

## 개발 환경

소스 코드를 직접 수정하거나 기여하려면 아래 절차를 따르세요.
```bash
git clone https://github.com/jinimong/kidsnote-cli.git
cd kidsnote-cli
npm install
npm test
```

---

## 라이선스

[MIT](LICENSE)
