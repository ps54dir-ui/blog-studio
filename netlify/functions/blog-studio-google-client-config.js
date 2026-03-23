/**
 * GET /api/blog-studio/google-client-config (netlify.toml 리다이렉트)
 * 웹 OAuth 클라이언트 ID만 반환 (비밀 아님). Netlify 대시보드에 환경 변수 설정 필요.
 */
exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ ok: false, error: 'GET only' }),
    };
  }
  const clientId = (
    process.env.BLOG_STUDIO_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    ''
  ).trim();
  const admins = (process.env.BLOG_STUDIO_GOOGLE_ADMINS || '').trim();
  const apiKey = (
    process.env.BLOG_STUDIO_GOOGLE_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''
  ).trim();
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ ok: true, clientId, admins, apiKey }),
  };
};
