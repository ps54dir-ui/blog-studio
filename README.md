# Blog Studio v7

팀 블로그·원고 및 회원 배정 관리를 위한 웹 앱.

---

## 사용 방법

### 1. 실행

**로컬:**
```bash
cd "c:\blog-studio\files (5)"
npx serve -p 8080
```
브라우저에서 http://localhost:8080 접속

또는 레포 루트에서 `npm run serve`(또는 `npx serve -l 3333 -c serve.json`)로 `files (5)`를 사이트에 올립니다. 루트의 `serve.json`은 폴더명 `(5)`가 `serve`의 path-to-regexp와 충돌하지 않도록 이스케이프해 두었습니다.

**Netlify 배포:**
[https://kaleidoscopic-gnome-c77113.netlify.app](https://kaleidoscopic-gnome-c77113.netlify.app)

**Netlify에서 AI(`/api/openai/chat` 등) 쓰기:** 저장소의 `netlify/functions/`가 배포에 포함되어야 합니다. 대시보드 **Site configuration → Environment variables**에 최소 **`OPENAI_API_KEY`**(또는 회원이 각자 키를 넣는 모드만 쓸 경우 생략 가능) / Claude 사용 시 **`ANTHROPIC_API_KEY`** 를 설정하세요. **서비스 공용 지침**을 Functions로 내려주려면(선택) `BS_SHARED_GUIDELINES_TEXT`, `BS_SHARED_GUIDELINES_UPDATED_AT` 를 넣을 수 있습니다. 미설정이면 GET은 빈 `text`로 200을 반환합니다.

배포는 `netlify.toml`에서 `files (5)`를 사이트 루트로 쓰고, 빌드 시 레포 루트의 `guidelines/v10/`을 그 안으로 복사합니다. 배포 후 `…/guidelines/v10/SKILL-v10.md`가 열리면 블로그 스튜디오 AI 번들 fetch가 정상입니다.

**Netlify에서 분류·AI(OpenAI/Claude):** 정적 호스팅만 있으면 `/api/openai/chat`가 없어 오류가 납니다. 레포의 **Netlify Functions**(`netlify/functions/`)가 같은 경로로 프록시합니다. Netlify 대시보드 → **Site configuration → Environment variables** 에 최소 **`OPENAI_API_KEY`**(및 Claude 사용 시 **`ANTHROPIC_API_KEY`**)를 넣고 재배포하세요. 회원이 앱 설정에 본인 API 키를 넣으면 그 키로 호출됩니다(관리자 기본 키는 비워도 됨).

**로컬에서 Netlify와 같은 폴더 만들기:** 레포 루트에서 `npm run build:dist` → `dist/`에 `files (5)` 전본 + `dist/guidelines/v10/`이 생깁니다. 미리보기는 `npm run serve:dist`(또는 `npx serve dist -l 3333`).

**지침을 빠짐없이 넣기:** 앱은 기본적으로 v10·공용 지침을 잘라내지 않고 주입합니다(`BS_*_INJECT_MAX_CHARS = 0`). 공용 지침이 매우 길면 모델 컨텍스트 한도 또는 요금에 걸릴 수 있으니, 필요할 때만 `blog-studio-v7.html`에서 상한을 숫자로 설정하세요. **v10 파일을 못 불러오면에도 AI가 도는 것을 막으려면** `?strictGuidelines=1` 또는 `localStorage bs_strict_guidelines=1`을 켭니다. (모델이 지침을 100% 위반 없이 따른다는 보장은 기술적으로 불가능합니다—인간 검수·체크리스트 자동화 등이 별도로 필요합니다.)

---

### 2. 처음 설정 (Google 로그인 사용 시)

1. 로그인 페이지에서 **⚙ Google API 설정 안내** 클릭
2. [Google Cloud Console](https://console.cloud.google.com)에서:
   - **Google Drive API**, **Google Identity Services** 활성화
   - OAuth 동의 화면 설정 (외부 사용자)
   - OAuth 클라이언트 ID 발급 (웹 애플리케이션)
   - **승인된 JavaScript 원본**에 `https://kaleidoscopic-gnome-c77113.netlify.app` 또는 `http://localhost:8080` 추가
3. 발급된 **클라이언트 ID**를 설정 모달에 입력 후 저장
4. **Google 계정으로 로그인** 클릭

---

### 3. 메인 화면 사용법

#### 좌측: 회원 콘텐츠 관리
- **온라인 채널 추가**: 회원별 채널명, URL 등록
- **원고 입력**: 제목·내용 입력 후 **저장** → 원고가 가운데 카드로 추가
- **파일 업로드**: .txt, .md, .docx, .json 지원 (드래그 또는 클릭)

#### 가운데: 원고별 회원 배정
- 원고 카드 **제목 클릭** → 내용 미리보기
- 각 원고 카드 아래에서 **회원 배정**:
  - **회원명** 입력
  - **캐릭터** 선택 (전문가형, 친근한 이웃형, 스토리텔러형, 멘토형, 분석가형 + 커스텀)
  - **채널** 선택 (유튜브, 스레드, 블로그 등)
  - **유형** 선택 (숏츠, 글, 릴스 등)
- 행마다 **저장** / **수정** / **삭제**: 해당 회원 배정을 저장·수정·삭제
- **취합 복사**: 원고 제목과 배정 정보를 클립보드에 복사

#### 커스텀 캐릭터
- **+ 커스텀 캐릭터** 클릭 → 이름·페르소나 입력 후 저장

---

### 4. 로그아웃

톱바 우측 **로그아웃** 클릭 → 로그인 페이지로 이동

---

## 화면 구성

| 파일 | 설명 |
|------|------|
| `index.html` | 로그인 (Google) |
| `blog-studio-v7.html` | 메인 대시보드 (원고 & 회원 배정) |
| `admin.html` | 관리자 (팀 전체 데이터 열람) |

---

## 데이터 저장

- **비로그인**: 브라우저 localStorage
- **로그인**: 구글 드라이브 (사용자별 폴더)

---

## 요구사항

- 모던 브라우저 (Chrome, Edge, Firefox, Safari)
- Google API 사용 시: Drive API, Identity Services 활성화 필요
