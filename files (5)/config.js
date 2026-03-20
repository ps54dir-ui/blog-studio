/**
 * Blog Studio API 설정
 * config.example.js를 참고하여 API 키를 입력하세요.
 */
window.BS_CONFIG = {
  /** 관리자/비로그인 개발용: 비어 있으면 서버만 OPENAI_API_KEY 사용 (권장). */
  openaiKey: '',
  /** Claude(Anthropic): 비어 있으면 ANTHROPIC_API_KEY */
  anthropicKey: '',
  /** 예: claude-sonnet-4-20250514, claude-3-5-sonnet-20241022 */
  anthropicModel: 'claude-sonnet-4-20250514',
  /** localhost에서 비로그인 AI 허용. 배포 전 false 권장. (또는 ?devAi=1) */
  devAllowAiWithoutLogin: true
};
