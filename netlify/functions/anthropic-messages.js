/**
 * Netlify Function — POST /api/anthropic/messages
 * 환경변수: ANTHROPIC_API_KEY. 회원 키는 X-Anthropic-Key
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
    hdr['x-anthropic-key'] || hdr['X-Anthropic-Key'] || ''
  ).trim();
  const apiKey = headerKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 400,
      headers: headersJson,
      body: JSON.stringify({
        error:
          'Claude API 키 없음: Netlify에 ANTHROPIC_API_KEY를 설정하거나 회원 키를 저장하세요.'
      })
    };
  }

  const model =
    body.model ||
    process.env.ANTHROPIC_MODEL ||
    'claude-sonnet-4-20250514';
  const system = body.system || '';
  const messages = body.messages;
  const max_tokens =
    typeof body.max_tokens === 'number' ? body.max_tokens : 8192;

  if (!Array.isArray(messages) || !messages.length) {
    return {
      statusCode: 400,
      headers: headersJson,
      body: JSON.stringify({ error: 'messages 배열 필요' })
    };
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens,
        ...(system ? { system } : {}),
        messages
      })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return {
        statusCode: r.status,
        headers: headersJson,
        body: JSON.stringify({
          error:
            data.error?.message ||
            data.error?.type ||
            data.error ||
            'Anthropic 요청 실패',
          detail: data
        })
      };
    }
    const blocks = data.content || [];
    let text = '';
    for (const b of blocks) {
      if (b.type === 'text' && b.text) text += b.text;
    }
    return {
      statusCode: 200,
      headers: headersJson,
      body: JSON.stringify({ ok: true, text })
    };
  } catch (e) {
    console.error('[anthropic-messages]', e);
    return {
      statusCode: 500,
      headers: headersJson,
      body: JSON.stringify({ error: e.message || '서버 오류' })
    };
  }
};
