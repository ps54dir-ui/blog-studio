/**
 * Netlify Function — GET /api/shared-guidelines
 * 선택: 환경변수 BS_SHARED_GUIDELINES_TEXT (긴 문자열), BS_SHARED_GUIDELINES_UPDATED_AT (ISO 문자열)
 * 미설정 시 빈 text → 클라이언트는 v10 정적 파일만 사용
 */
exports.handler = async (event) => {
  const headersJson = { 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: headersJson, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: headersJson,
      body: JSON.stringify({ ok: false, error: 'Method not allowed' })
    };
  }
  const text = String(process.env.BS_SHARED_GUIDELINES_TEXT || '').trim();
  const updatedAt =
    process.env.BS_SHARED_GUIDELINES_UPDATED_AT != null &&
    String(process.env.BS_SHARED_GUIDELINES_UPDATED_AT).trim() !== ''
      ? String(process.env.BS_SHARED_GUIDELINES_UPDATED_AT).trim()
      : null;
  return {
    statusCode: 200,
    headers: headersJson,
    body: JSON.stringify({ ok: true, text, updatedAt })
  };
};
