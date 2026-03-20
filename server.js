/**
 * 로컬 개발 서버 - 정적 파일 서빙 + /api/publish
 * npm run dev 로 실행
 *
 * 공용 지침: 환경변수 BS_GUIDELINES_ADMIN_SECRET 설정 시
 *   PUT /api/shared-guidelines + 헤더 X-Blog-Studio-Guidelines-Admin
 * 모든 클라이언트는 GET /api/shared-guidelines 로 조회 후 AI 프롬프트에 합칩니다.
 */
const path = require('path');
const fs = require('fs').promises;
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3333;
const GUIDELINES_PATH = path.join(__dirname, 'shared-guidelines.json');

async function readSharedGuidelinesFromDisk() {
  try {
    const raw = await fs.readFile(GUIDELINES_PATH, 'utf8');
    const j = JSON.parse(raw);
    return {
      text: String(j.text ?? ''),
      updatedAt: j.updatedAt != null ? j.updatedAt : null
    };
  } catch (e) {
    if (e.code === 'ENOENT') {
      const empty = { text: '', updatedAt: null };
      await fs.writeFile(
        GUIDELINES_PATH,
        JSON.stringify(empty, null, 2),
        'utf8'
      );
      return empty;
    }
    throw e;
  }
}

async function writeSharedGuidelinesToDisk(text) {
  const payload = {
    text: String(text ?? ''),
    updatedAt: new Date().toISOString()
  };
  await fs.writeFile(
    GUIDELINES_PATH,
    JSON.stringify(payload, null, 2),
    'utf8'
  );
  return payload;
}

// JSON body 파싱
app.use(express.json({ limit: '20mb' }));

// 정적 파일 (files (5) 폴더)
app.use(express.static(path.join(__dirname, 'files (5)')));

// SPA 폴백: 루트 등
app.get('/', (req, res) => res.redirect('/index.html'));
app.get('/blog-studio-v7.html', (req, res) =>
  res.sendFile(path.join(__dirname, 'files (5)', 'blog-studio-v7.html'))
);

/**
 * GET /api/shared-guidelines
 * 공용 지침 본문 (모든 회원 클라이언트가 AI 요청 전에 불러와 합침)
 */
app.get('/api/shared-guidelines', async (req, res) => {
  try {
    const data = await readSharedGuidelinesFromDisk();
    res.json({ ok: true, text: data.text, updatedAt: data.updatedAt });
  } catch (e) {
    console.error('[shared-guidelines GET]', e);
    res.status(500).json({ ok: false, error: e.message || '읽기 실패' });
  }
});

/**
 * PUT /api/shared-guidelines
 * body: { text: string }
 * 헤더 X-Blog-Studio-Guidelines-Admin: 환경변수 BS_GUIDELINES_ADMIN_SECRET 과 동일해야 함
 */
app.put('/api/shared-guidelines', async (req, res) => {
  try {
    const secret = (process.env.BS_GUIDELINES_ADMIN_SECRET || '').trim();
    if (!secret) {
      return res.status(503).json({
        ok: false,
        error:
          '서버에 BS_GUIDELINES_ADMIN_SECRET 이 설정되지 않았습니다. .env 또는 호스트 환경변수를 설정한 뒤 다시 시도하세요.'
      });
    }
    const hdr = (
      req.headers['x-blog-studio-guidelines-admin'] || ''
    ).trim();
    if (hdr !== secret) {
      return res.status(403).json({ ok: false, error: '관리자 비밀값 불일치' });
    }
    const text =
      typeof req.body?.text === 'string'
        ? req.body.text
        : String(req.body?.text ?? '');
    const saved = await writeSharedGuidelinesToDisk(text);
    res.json({ ok: true, ...saved });
  } catch (e) {
    console.error('[shared-guidelines PUT]', e);
    res.status(500).json({ ok: false, error: e.message || '저장 실패' });
  }
});

/**
 * POST /api/publish
 * 카드 + 미리보기 미디어를 받아 발행 요청 처리
 * body: { card, previewMedia, platform, channel }
 */
/**
 * POST /api/openai/chat
 * OpenAI Chat Completions 프록시 (브라우저 CORS 우회)
 * 헤더: X-OpenAI-Key: sk-... (우선) — 회원이 보낸 키로 호출 시 해당 OpenAI 계정으로 과금
 *        헤더가 없으면 서버 환경변수 OPENAI_API_KEY (관리자/기본 키)
 * body: { model?, messages, temperature? }
 * 응답: { ok, text } — assistant 메시지 본문만
 */
app.post('/api/openai/chat', async (req, res) => {
  try {
    const headerKey = (req.headers['x-openai-key'] || '').trim();
    const apiKey = headerKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error:
          'API 키 없음: 회원은 브라우저에 본인 키를 저장하거나, 관리자는 환경변수 OPENAI_API_KEY·config.js openaiKey를 설정하세요.'
      });
    }
    const {
      model = 'gpt-4o-mini',
      messages,
      temperature = 0.35,
      max_tokens: rawMax = 8192
    } = req.body || {};
    const max_tokens = Math.min(
      16384,
      Math.max(256, Math.floor(Number(rawMax) || 8192))
    );
    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: 'messages 배열 필요' });
    }
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
      return res.status(r.status).json({
        error: data.error?.message || data.error || 'OpenAI 요청 실패',
        detail: data
      });
    }
    const text = data.choices?.[0]?.message?.content || '';
    res.json({ ok: true, text });
  } catch (e) {
    console.error('[openai/chat]', e);
    res.status(500).json({ error: e.message || '서버 오류' });
  }
});

/**
 * POST /api/anthropic/messages
 * Anthropic Messages API 프록시
 * 헤더: X-Anthropic-Key: sk-ant-... (우선) → 회원 과금 분리
 *        없으면 ANTHROPIC_API_KEY
 * body: { model?, system?, messages, max_tokens? }
 * messages: [{ role: 'user', content: '...' }] (Claude 형식)
 * 응답: { ok, text } — 첫 텍스트 블록만
 */
app.post('/api/anthropic/messages', async (req, res) => {
  try {
    const headerKey = (req.headers['x-anthropic-key'] || '').trim();
    const apiKey = headerKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error:
          'Claude API 키 없음: 회원은 브라우저에 본인 키를 저장하거나, 관리자는 ANTHROPIC_API_KEY·config.js anthropicKey를 설정하세요.'
      });
    }
    const {
      model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      system = '',
      messages,
      max_tokens = 8192
    } = req.body || {};
    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: 'messages 배열 필요' });
    }
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
      return res.status(r.status).json({
        error:
          data.error?.message ||
          data.error?.type ||
          data.error ||
          'Anthropic 요청 실패',
        detail: data
      });
    }
    const blocks = data.content || [];
    let text = '';
    for (const b of blocks) {
      if (b.type === 'text' && b.text) {
        text += b.text;
      }
    }
    res.json({ ok: true, text });
  } catch (e) {
    console.error('[anthropic/messages]', e);
    res.status(500).json({ error: e.message || '서버 오류' });
  }
});

app.post('/api/publish', (req, res) => {
  const { card, previewMedia, platform, channel } = req.body || {};
  console.log('[publish]', {
    platform: platform || 'all',
    channel: channel || card?.channel,
    cardNo: card?.no,
    hasMedia: !!previewMedia && Object.keys(previewMedia || {}).length > 0
  });
  // 실제 발행 로직은 YouTube/Instagram 등 플랫폼 API 연동 시 구현
  res.json({
    ok: true,
    message: platform === 'all' ? '전체 발행 요청 수신' : `${platform} 발행 요청 수신`,
    platform: platform || 'all',
    cardNo: card?.no
  });
});

app.listen(PORT, () => {
  console.log(`Blog Studio dev server: http://localhost:${PORT}`);
  console.log(`  - 정적 파일: files (5)/`);
  console.log(
    `  - API: POST /api/publish, POST /api/openai/chat, POST /api/anthropic/messages`
  );
  console.log(`  - 공용 지침: GET /api/shared-guidelines, PUT (BS_GUIDELINES_ADMIN_SECRET)`);
});
