/**
 * Netlify Function — 동일 오리진 POST /api/openai/chat
 * 환경변수: OPENAI_API_KEY (관리자·기본). 회원 키는 요청 헤더 X-OpenAI-Key
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
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_) {
    return {
      statusCode: 400,
      headers: headersJson,
      body: JSON.stringify({ error: 'Invalid JSON' })
    };
  }

  const hdr = event.headers || {};
  const headerKey = String(
    hdr['x-openai-key'] || hdr['X-OpenAI-Key'] || ''
  ).trim();
  const apiKey = headerKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 400,
      headers: headersJson,
      body: JSON.stringify({
        error:
          'API 키 없음: Netlify에 OPENAI_API_KEY를 설정하거나, 설정 패널에서 회원 OpenAI 키를 저장하세요.'
      })
    };
  }

  const model = body.model || 'gpt-4o-mini';
  const messages = body.messages;
  const temperature =
    typeof body.temperature === 'number' ? body.temperature : 0.35;
  /** 짧을수록 응답·과금 빠름. Netlify 무료 Functions ~10s 제한에 자주 걸림 → 기본 보수적 */
  let max_tokens = 4096;
  if (typeof body.max_tokens === 'number' && Number.isFinite(body.max_tokens)) {
    max_tokens = Math.min(16384, Math.max(256, Math.floor(body.max_tokens)));
  }
  if (!Array.isArray(messages) || !messages.length) {
    return {
      statusCode: 400,
      headers: headersJson,
      body: JSON.stringify({ error: 'messages 배열 필요' })
    };
  }

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return {
        statusCode: r.status,
        headers: headersJson,
        body: JSON.stringify({
          error: data.error?.message || data.error || 'OpenAI 요청 실패',
          detail: data
        })
      };
    }
    const text = data.choices?.[0]?.message?.content || '';
    return {
      statusCode: 200,
      headers: headersJson,
      body: JSON.stringify({
        ok: true,
        text,
        usage: data.usage || null,
        model: data.model || model
      })
    };
  } catch (e) {
    console.error('[openai-chat]', e);
    return {
      statusCode: 500,
      headers: headersJson,
      body: JSON.stringify({ error: e.message || '서버 오류' })
    };
  }
};
