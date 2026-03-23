/**
 * POST /api/blog-studio/verify-team-email
 * Body: { "email": "user@company.com" }
 * Env: BLOG_STUDIO_ALLOWED_EMAILS (또는 BLOG_STUDIO_TEAM_EMAILS) — 쉼표 구분, 비우면 제한 없음
 */
exports.handler = async (event) => {
  const headersJson = { 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: headersJson, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: headersJson,
      body: JSON.stringify({ error: 'POST only' })
    };
  }
  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_) {
    return {
      statusCode: 400,
      headers: headersJson,
      body: JSON.stringify({ ok: false, restricted: true, error: 'Invalid JSON' })
    };
  }
  const raw = (
    process.env.BLOG_STUDIO_ALLOWED_EMAILS ||
    process.env.BLOG_STUDIO_TEAM_EMAILS ||
    ''
  )
    .trim()
    .toLowerCase();
  if (!raw) {
    return {
      statusCode: 200,
      headers: headersJson,
      body: JSON.stringify({ ok: true, restricted: false })
    };
  }
  const allow = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const email = String(body.email || '')
    .trim()
    .toLowerCase();
  if (!email) {
    return {
      statusCode: 400,
      headers: headersJson,
      body: JSON.stringify({ ok: false, restricted: true, error: 'email required' })
    };
  }
  const ok = allow.includes(email);
  return {
    statusCode: 200,
    headers: headersJson,
    body: JSON.stringify({ ok, restricted: true })
  };
};
