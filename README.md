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

**Netlify 배포:**
[https://kaleidoscopic-gnome-c77113.netlify.app](https://kaleidoscopic-gnome-c77113.netlify.app)

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
