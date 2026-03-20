# 콘텐츠 지침 번들 (v10 / v9 / v3 / workbench)

이 폴더는 OneDrive의 동일 파일 복사본입니다. Cursor·`blog-studio` 개발 시 단일 진실 원천으로 쓰세요.

| 파일 | 역할 |
|------|------|
| **SKILL-v10.md** | 검수 **실행 흐름**: 언제 자동/수동 검수할지, F→C→L→Q→A 순서, 블로그 분기(C-08 + C-08A/B/C), 리포트 형식, 심각도 분류. `checklist-v9.md`를 규격으로 참조. |
| **checklist-v9.md** | 검수 **항목 정의**: F-01~11, C-01~C-13(블로그 C-08 공통·C-08A/B/C), L, Q, A, 발행 타이밍. |
| **template-library-v3.json** | 채널별 **템플릿 라이브러리** (T-BLG 네이버, T-TS 티스토리, T-WP 워드프레스 등). 구조·훅·씬·이미지 전략 참조. |
| **content_workbench-v1.json** | **UI 작업 JSON**: 채널 트리·요약·필터용. Master JSON과 스키마가 다름 — 프로그램에서 “워크벤치 뷰” 전용. |

## 도구와의 대응

- **`files (5)/blog-editor-layout.html`**: `checklist-v9`의 C-08 계열을 자동 검수 일부로 반영 가능. Master JSON `items[]` 블로그 항목 전제.
- **`files (5)/blog-studio-v7.html`**: 카드·배치도·미리보기; Master/워크벤치와 완전 동기화는 추가 연동 필요.

## Cursor 스킬로 쓰려면

`SKILL-v10.md` 내용을 Cursor **Agent Skill** 또는 **Rules**에 넣고, 법적(L) 항목은 스킬에 적힌 대로 웹 검색을 우선하세요.

## `blog-studio-v7.html`에서 AI에 넣기

스튜디오·분류·리뉴얼 AI 호출 전에 브라우저가 `../guidelines/v10/SKILL-v10.md` 등을 **fetch**합니다. **`file://`로 HTML만 열면 보통 실패**하므로, 저장소 **루트** 또는 `files (5)` 상위에서 정적 서버로 띄우세요 (예: 루트가 `c:\blog-studio`이면 `guidelines/v10/` 이 URL로 노출됨).
