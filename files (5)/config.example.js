/**
 * Blog Studio API 설정 예시
 * 이 파일을 config.js로 복사한 뒤 API 키를 입력하세요.
 * config.js는 .gitignore에 추가하여 커밋하지 마세요.
 *
 * 콘텐츠 스튜디오 AI 분류 (npm run dev):
 * - OpenAI: OPENAI_API_KEY 또는 openaiKey · /api/openai/chat
 * - Claude: ANTHROPIC_API_KEY 또는 anthropicKey · /api/anthropic/messages (헤더 키 우선 → 회원별 과금 분리)
 * - 화면에서 엔진 선택(OpenAI/Claude). 회원은 각 키를 로컬에 저장.
 *
 * 서버 공용 지침(선택): 루트 shared-guidelines.json + GET /api/shared-guidelines
 * - 운영 호스트에 환경변수 BS_GUIDELINES_ADMIN_SECRET 설정 후 PUT 으로 본문 갱신
 * - 헤더: X-Blog-Studio-Guidelines-Admin: (동일 비밀값), 본문 JSON: { "text": "…" }
 */
window.BS_CONFIG = {
  openaiKey: '',
  anthropicKey: '',
  /** (선택) Google Picker용 브라우저 API 키 — 비우면 드라이브 연결 시 폴더 URL 입력으로만 지정 */
  googlePickerApiKey: '',
  anthropicModel: 'claude-sonnet-4-20250514', // API에 없으면 claude-3-5-sonnet-20241022 등으로 변경
  /**
   * 로컬 개발 전용: localhost에서만 비로그인 AI 호출 허용 (운영 배포 시 false 유지).
   * 또는 URL에 ?devAi=1 을 붙여도 동일하게 허용됩니다.
   */
  devAllowAiWithoutLogin: false
};
