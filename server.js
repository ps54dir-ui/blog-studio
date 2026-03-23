require('dotenv').config();
/**
 * Blog Studio — 멀티테넌트 Express 서버
 * 정적 파일 + AI 프록시 + 자동발행 API (SQLite)
 */
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const express = require('express');
const multer = require('multer');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3333;
const GUIDELINES_PATH = path.join(__dirname, 'shared-guidelines.json');

app.use(express.json({ limit: '50mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-User-Id, X-OpenAI-Key, X-Anthropic-Key, X-Blog-Studio-Guidelines-Admin');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ================================================================
 *  Blog Studio 브라우저 로그인 — 공개 웹 클라이언트 ID (비밀값 아님)
 *  index.html 이 팀원 PC에서도 설정 없이 Google 로그인하도록 동일 출처에서 조회
 * ================================================================ */
app.get('/api/blog-studio/google-client-config', (req, res) => {
  const clientId = (
    process.env.BLOG_STUDIO_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    ''
  ).trim();
  const admins = (process.env.BLOG_STUDIO_GOOGLE_ADMINS || '').trim();
  /** Google Picker(폴더 선택)용 브라우저 키 — Drive와 동일 GCP 프로젝트, HTTP 리퍼러 제한 */
  const apiKey = (
    process.env.BLOG_STUDIO_GOOGLE_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''
  ).trim();
  res.json({ ok: true, clientId, admins, apiKey });
});

/**
 * 팀 전용: BLOG_STUDIO_ALLOWED_EMAILS 가 비어 있으면 제한 없음.
 * 값이 있으면(쉼표 구분) 해당 구글 이메일만 로그인 후 스튜디오 진입 허용. 목록은 응답에 노출하지 않음.
 */
app.post('/api/blog-studio/verify-team-email', express.json(), (req, res) => {
  try {
    const raw = (
      process.env.BLOG_STUDIO_ALLOWED_EMAILS ||
      process.env.BLOG_STUDIO_TEAM_EMAILS ||
      ''
    )
      .trim()
      .toLowerCase();
    if (!raw) {
      return res.json({ ok: true, restricted: false });
    }
    const allow = raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    if (!email) {
      return res.status(400).json({ ok: false, restricted: true, error: 'email required' });
    }
    const ok = allow.includes(email);
    return res.json({ ok, restricted: true });
  } catch (e) {
    return res.status(500).json({ ok: false, restricted: true, error: e.message });
  }
});

/* ================================================================
 *  정적 파일
 * ================================================================ */
app.use(express.static(path.join(__dirname, 'files (5)')));
app.use('/guidelines', express.static(path.join(__dirname, 'guidelines')));
app.use('/storage', express.static(path.join(__dirname, 'storage')));
app.get('/', (req, res) => res.redirect('/index.html'));
app.get('/blog-studio-v7.html', (req, res) =>
  res.sendFile(path.join(__dirname, 'files (5)', 'blog-studio-v7.html'))
);

/* ================================================================
 *  간이 인증 미들웨어
 *  헤더 X-User-Id 로 현재 사용자 식별 (실 서비스 시 JWT/세션으로 교체)
 * ================================================================ */
function requireUser(req, res, next) {
  const userId = (req.headers['x-user-id'] || '').trim();
  if (!userId) return res.status(401).json({ ok: false, error: '인증 필요: X-User-Id 헤더' });
  const user = db.userGet(userId);
  if (!user || user.status !== 'active') return res.status(403).json({ ok: false, error: '유효하지 않은 사용자' });
  req.userId = userId;
  req.user = user;
  next();
}

/* ================================================================
 *  공용 지침 (기존 유지)
 * ================================================================ */
async function readGuidelines() {
  try {
    const raw = await fs.readFile(GUIDELINES_PATH, 'utf8');
    const j = JSON.parse(raw);
    return { text: String(j.text ?? ''), updatedAt: j.updatedAt ?? null };
  } catch (e) {
    if (e.code === 'ENOENT') {
      const empty = { text: '', updatedAt: null };
      await fs.writeFile(GUIDELINES_PATH, JSON.stringify(empty, null, 2), 'utf8');
      return empty;
    }
    throw e;
  }
}
async function writeGuidelines(text) {
  const payload = { text: String(text ?? ''), updatedAt: new Date().toISOString() };
  await fs.writeFile(GUIDELINES_PATH, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

app.get('/api/shared-guidelines', async (req, res) => {
  try { const d = await readGuidelines(); res.json({ ok: true, ...d }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});
app.put('/api/shared-guidelines', async (req, res) => {
  try {
    const secret = (process.env.BS_GUIDELINES_ADMIN_SECRET || '').trim();
    if (!secret) return res.status(503).json({ ok: false, error: 'BS_GUIDELINES_ADMIN_SECRET 미설정' });
    if ((req.headers['x-blog-studio-guidelines-admin'] || '').trim() !== secret)
      return res.status(403).json({ ok: false, error: '관리자 비밀값 불일치' });
    const saved = await writeGuidelines(req.body?.text);
    res.json({ ok: true, ...saved });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

/* ================================================================
 *  AI 프록시 (기존 유지)
 * ================================================================ */
app.post('/api/openai/chat', async (req, res) => {
  try {
    const apiKey = (req.headers['x-openai-key'] || '').trim() || process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(400).json({ error: 'API 키 없음' });
    const { model = 'gpt-4o-mini', messages, temperature = 0.35, max_tokens: rawMax = 8192 } = req.body || {};
    const max_tokens = Math.min(16384, Math.max(256, Math.floor(Number(rawMax) || 8192)));
    if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'messages 필요' });

    const payload = { model, messages, temperature, max_tokens };
    let bodyStr;
    try { bodyStr = JSON.stringify(payload); }
    catch (serErr) {
      console.error('[OpenAI proxy] JSON.stringify failed:', serErr.message);
      return res.status(400).json({ error: 'JSON 직렬화 실패: ' + serErr.message });
    }
    console.log(`[OpenAI proxy] model=${model} msgs=${messages.length} bodyLen=${bodyStr.length}`);

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: bodyStr
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error(`[OpenAI proxy] ${r.status}`, JSON.stringify(data).slice(0, 500));
      return res.status(r.status).json({ error: data.error?.message || 'OpenAI 실패', detail: data });
    }
    res.json({
      ok: true,
      text: data.choices?.[0]?.message?.content || '',
      usage: data.usage || null,
      model: data.model || model
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/anthropic/messages', async (req, res) => {
  try {
    const apiKey = (req.headers['x-anthropic-key'] || '').trim() || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(400).json({ error: 'Claude API 키 없음' });
    const { model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514', system = '', messages, max_tokens: rawMax = 8192 } = req.body || {};
    const max_tokens = Math.min(16384, Math.max(256, Math.floor(Number(rawMax) || 8192)));
    if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'messages 필요' });
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens, ...(system ? { system } : {}), messages })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || 'Anthropic 실패', detail: data });
    let text = '';
    for (const b of (data.content || [])) { if (b.type === 'text') text += b.text; }
    res.json({
      ok: true,
      text,
      usage: data.usage || null,
      model: data.model || model
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ================================================================
 *  /api/auth — 간이 인증
 * ================================================================ */
app.post('/api/auth/register', (req, res) => {
  try {
    const { email, name, password, company_name } = req.body || {};
    if (!email) return res.status(400).json({ ok: false, error: 'email 필요' });
    if (db.userGetByEmail(email)) return res.status(409).json({ ok: false, error: '이미 등록된 이메일' });
    const user = db.userCreate({ email, name, password_hash: password || '', company_name });
    res.json({ ok: true, user });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = db.userGetByEmail(email);
    if (!user) return res.status(404).json({ ok: false, error: '사용자 없음' });
    if (user.password_hash && user.password_hash !== (password || ''))
      return res.status(401).json({ ok: false, error: '비밀번호 불일치' });
    res.json({ ok: true, user });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/api/users/me', requireUser, (req, res) => {
  res.json({ ok: true, user: req.user });
});

app.patch('/api/users/me', requireUser, (req, res) => {
  try {
    const user = db.userUpdate(req.userId, req.body);
    res.json({ ok: true, user });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

/* ================================================================
 *  /api/projects
 * ================================================================ */
app.get('/api/projects', requireUser, (req, res) => {
  try { res.json({ ok: true, items: db.projectList(req.userId) }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/projects', requireUser, (req, res) => {
  try {
    const item = db.projectCreate({ ...req.body, user_id: req.userId });
    res.json({ ok: true, item });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.patch('/api/projects/:id', requireUser, (req, res) => {
  try {
    const p = db.projectGet(req.params.id);
    if (!p || p.user_id !== req.userId) return res.status(404).json({ ok: false, error: '프로젝트 없음' });
    const item = db.projectUpdate(req.params.id, req.body);
    res.json({ ok: true, item });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

/* ================================================================
 *  /api/accounts — 계정 관리 (내 회사, 클라이언트 A, …)
 * ================================================================ */
app.get('/api/accounts', requireUser, (req, res) => {
  try {
    const items = db.accountList(req.userId);
    res.json({ ok: true, items });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/api/accounts/with-channels', requireUser, (req, res) => {
  try {
    const items = db.accountGetWithChannels(req.userId);
    res.json({ ok: true, items });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/accounts', requireUser, (req, res) => {
  try {
    const item = db.accountCreate({ ...req.body, user_id: req.userId });
    res.json({ ok: true, item });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.patch('/api/accounts/:id', requireUser, (req, res) => {
  try {
    const a = db.accountGet(req.params.id);
    if (!a || a.user_id !== req.userId) return res.status(404).json({ ok: false, error: '계정 없음' });
    const item = db.accountUpdate(req.params.id, req.body);
    res.json({ ok: true, item });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.delete('/api/accounts/:id', requireUser, (req, res) => {
  try {
    const a = db.accountGet(req.params.id);
    if (!a || a.user_id !== req.userId) return res.status(404).json({ ok: false, error: '계정 없음' });
    db.accountDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

/* ================================================================
 *  /api/channel-connections
 * ================================================================ */
app.get('/api/channel-connections', requireUser, (req, res) => {
  try {
    const items = db.channelConnList(req.userId, {
      platform: req.query.platform,
      account_id: req.query.account_id
    });
    res.json({ ok: true, items });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/channel-connections', requireUser, (req, res) => {
  try {
    const item = db.channelConnCreate({ ...req.body, user_id: req.userId });
    res.json({ ok: true, item });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.patch('/api/channel-connections/:id', requireUser, (req, res) => {
  try {
    const cc = db.channelConnGet(req.params.id);
    if (!cc || cc.user_id !== req.userId) return res.status(404).json({ ok: false, error: '채널 연결 없음' });
    const item = db.channelConnUpdate(req.params.id, req.body);
    res.json({ ok: true, item });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.delete('/api/channel-connections/:id', requireUser, (req, res) => {
  try {
    const cc = db.channelConnGet(req.params.id);
    if (!cc || cc.user_id !== req.userId) return res.status(404).json({ ok: false, error: '채널 연결 없음' });
    db.channelConnDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

/* ================================================================
 *  /api/contents
 * ================================================================ */
app.get('/api/contents', requireUser, (req, res) => {
  try {
    const items = db.contentList({
      user_id: req.userId,
      project_id: req.query.project_id,
      status: req.query.status,
      channel: req.query.channel,
      limit: Number(req.query.limit) || 200
    });
    res.json({ ok: true, items });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/api/contents/:id', requireUser, (req, res) => {
  try {
    const c = db.contentGet(req.params.id);
    if (!c || c.user_id !== req.userId) return res.status(404).json({ ok: false, error: '콘텐츠 없음' });
    res.json({ ok: true, item: c });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/contents', requireUser, (req, res) => {
  try {
    const item = db.contentUpsert({ ...req.body, user_id: req.userId });
    res.json({ ok: true, item });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.put('/api/contents/:id', requireUser, (req, res) => {
  try {
    const item = db.contentUpsert({ ...req.body, id: req.params.id, user_id: req.userId });
    res.json({ ok: true, item });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.delete('/api/contents/:id', requireUser, (req, res) => {
  try {
    const c = db.contentGet(req.params.id);
    if (!c || c.user_id !== req.userId) return res.status(404).json({ ok: false, error: '콘텐츠 없음' });
    db.contentDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/contents/:id/confirm-final', requireUser, (req, res) => {
  try {
    const c = db.contentGet(req.params.id);
    if (!c || c.user_id !== req.userId) return res.status(404).json({ ok: false, error: '콘텐츠 없음' });
    const item = db.contentConfirmFinal(req.params.id);
    res.json({ ok: true, item });
  } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
});

app.post('/api/contents/batch', requireUser, (req, res) => {
  try {
    const items = (req.body.items || []).map(c => db.contentUpsert({ ...c, user_id: req.userId }));
    res.json({ ok: true, items, count: items.length });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

/* ================================================================
 *  /api/assets — 파일 업로드
 * ================================================================ */
const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      const dir = db.ensureStorageDir(req.userId, req.body.project_id, req.body.content_id);
      cb(null, dir);
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname);
      cb(null, db.uid() + ext);
    }
  }),
  limits: { fileSize: 500 * 1024 * 1024 }
});

app.post('/api/assets/upload', requireUser, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: '파일 없음' });
    const relPath = path.relative(__dirname, req.file.path).replace(/\\/g, '/');
    const asset = db.assetCreate({
      user_id: req.userId,
      content_id: req.body.content_id || '',
      asset_type: req.body.asset_type || 'image',
      file_name: req.file.originalname,
      file_path: relPath,
      file_url: '/' + relPath,
      mime_type: req.file.mimetype,
      size_bytes: req.file.size
    });
    res.json({ ok: true, asset });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/api/assets/:contentId', requireUser, (req, res) => {
  try {
    const items = db.assetList(req.params.contentId);
    res.json({ ok: true, items });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/assets/upload-base64', requireUser, (req, res) => {
  try {
    const { content_id, slot_key, asset_type, data_url, file_name } = req.body || {};
    if (!content_id || !data_url) return res.status(400).json({ ok: false, error: 'content_id와 data_url 필요' });

    const match = data_url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return res.status(400).json({ ok: false, error: '유효한 data URL이 아닙니다' });
    const mime = match[1];
    const buffer = Buffer.from(match[2], 'base64');

    const extMap = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
                     'video/mp4': '.mp4', 'video/webm': '.webm', 'audio/mpeg': '.mp3', 'audio/wav': '.wav' };
    const ext = extMap[mime] || '.bin';
    const safeName = db.uid() + ext;

    const dir = db.ensureStorageDir(req.userId, req.body.project_id || '_default', content_id);
    const absPath = path.join(dir, safeName);
    fsSync.writeFileSync(absPath, buffer);

    const relPath = path.relative(__dirname, absPath).replace(/\\/g, '/');
    const guessType = mime.startsWith('video/') ? 'video'
      : mime.startsWith('audio/') ? 'audio'
      : mime.startsWith('image/') ? (asset_type || 'image')
      : (asset_type || 'other');

    const asset = db.assetCreate({
      user_id: req.userId,
      content_id,
      asset_type: guessType,
      file_name: file_name || safeName,
      file_path: relPath,
      file_url: '/' + relPath,
      mime_type: mime,
      size_bytes: buffer.length
    });

    res.json({ ok: true, asset });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

/* ================================================================
 *  /api/publish — 발행 큐 + 실행
 * ================================================================ */
app.get('/api/publish/queue', requireUser, (req, res) => {
  try {
    const items = db.queueList({
      user_id: req.userId,
      status: req.query.status,
      content_id: req.query.content_id,
      limit: Number(req.query.limit) || 200
    });
    res.json({ ok: true, items });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/api/publish/queue/stats', requireUser, (req, res) => {
  try { res.json({ ok: true, stats: db.queueStats(req.userId) }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/publish/queue', requireUser, (req, res) => {
  try {
    const { content_id, channel_connection_id, platform, publish_mode, publish_at, max_retry_count } = req.body;
    if (!content_id) return res.status(400).json({ ok: false, error: 'content_id 필요' });
    const item = db.queueAdd({ content_id, channel_connection_id, platform, publish_mode, publish_at, max_retry_count });
    res.json({ ok: true, item });
  } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
});

app.post('/api/publish/now', requireUser, async (req, res) => {
  try {
    const { content_id, channel_connection_id, platform } = req.body;
    if (!content_id) return res.status(400).json({ ok: false, error: 'content_id 필요' });
    const qi = db.queueAdd({ content_id, channel_connection_id, platform, publish_mode: 'now' });
    const result = await db.executePublish(qi.id);
    res.json({ ok: true, ...result });
  } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
});

app.post('/api/publish/schedule', requireUser, (req, res) => {
  try {
    const { content_id, channel_connection_id, platform, publish_at } = req.body;
    if (!content_id) return res.status(400).json({ ok: false, error: 'content_id 필요' });
    if (!publish_at) return res.status(400).json({ ok: false, error: 'publish_at 필요' });
    const item = db.queueAdd({ content_id, channel_connection_id, platform, publish_mode: 'scheduled', publish_at });
    res.json({ ok: true, item });
  } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
});

app.post('/api/publish/retry/:queueId', requireUser, async (req, res) => {
  try {
    const q = db.queueGet(req.params.queueId);
    if (!q || q.user_id !== req.userId) return res.status(404).json({ ok: false, error: '큐 항목 없음' });
    if (q.status !== 'failed') return res.status(400).json({ ok: false, error: '실패 상태만 재시도 가능' });
    const ts = db.now();
    db.getDb().prepare("UPDATE publish_queue SET status = 'queued', updated_at = ? WHERE id = ?").run(ts, q.id);
    const result = await db.executePublish(q.id);
    res.json({ ok: true, ...result });
  } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
});

app.post('/api/publish/cancel/:queueId', requireUser, (req, res) => {
  try {
    const q = db.queueGet(req.params.queueId);
    if (!q || q.user_id !== req.userId) return res.status(404).json({ ok: false, error: '큐 항목 없음' });
    const item = db.queueCancel(req.params.queueId);
    res.json({ ok: true, item });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.patch('/api/publish/queue/:queueId', requireUser, (req, res) => {
  try {
    const q = db.queueGet(req.params.queueId);
    if (!q || q.user_id !== req.userId) return res.status(404).json({ ok: false, error: '큐 항목 없음' });
    const { channel_connection_id, platform, publish_at, status } = req.body;
    const sets = [];
    const params = [];
    if (channel_connection_id !== undefined) { sets.push('channel_connection_id = ?'); params.push(channel_connection_id || null); }
    if (platform !== undefined) { sets.push('platform = ?'); params.push(platform); }
    if (publish_at !== undefined) { sets.push('publish_at = ?'); params.push(publish_at); }
    const ALLOWED_STATUS = ['queued', 'published', 'failed', 'canceled'];
    if (status !== undefined && ALLOWED_STATUS.includes(status)) { sets.push('status = ?'); params.push(status); }
    if (sets.length) {
      sets.push('updated_at = ?');
      params.push(db.now());
      params.push(req.params.queueId);
      db.getDb().prepare(`UPDATE publish_queue SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    }
    res.json({ ok: true, item: db.queueGet(req.params.queueId) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/publish/batch', requireUser, async (req, res) => {
  try {
    const { content_ids, publish_mode, publish_at, channel_connection_id, platform } = req.body;
    if (!Array.isArray(content_ids)) return res.status(400).json({ ok: false, error: 'content_ids 배열 필요' });
    const results = [];
    for (const cid of content_ids) {
      try {
        const qi = db.queueAdd({ content_id: cid, channel_connection_id, platform, publish_mode: publish_mode || 'now', publish_at });
        if (publish_mode !== 'scheduled') results.push(await db.executePublish(qi.id));
        else results.push({ queue: qi });
      } catch (e) { results.push({ error: e.message, content_id: cid }); }
    }
    res.json({ ok: true, results });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

/* ================================================================
 *  /api/publish/history — 발행 이력
 * ================================================================ */
app.get('/api/publish/history', requireUser, (req, res) => {
  try {
    const items = db.historyList({
      user_id: req.userId,
      content_id: req.query.content_id,
      queue_id: req.query.queue_id,
      result: req.query.result,
      limit: Number(req.query.limit) || 200
    });
    res.json({ ok: true, items });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

/* ================================================================
 *  /api/admin — 관리자 통계
 * ================================================================ */
app.get('/api/admin/stats', (req, res) => {
  try { res.json({ ok: true, stats: db.adminStats() }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/api/admin/users', (req, res) => {
  try { res.json({ ok: true, users: db.userList() }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

/* ================================================================
 *  레거시 호환: POST /api/publish (queue_id 기반)
 * ================================================================ */
app.post('/api/publish', async (req, res) => {
  try {
    const { queue_id, content_id } = req.body;
    if (queue_id) {
      const result = await db.executePublish(queue_id);
      return res.json({ ok: true, ...result });
    }
    if (content_id) {
      const qi = db.queueAdd({ content_id, publish_mode: 'now' });
      const result = await db.executePublish(qi.id);
      return res.json({ ok: true, ...result });
    }
    res.status(400).json({ ok: false, error: 'queue_id 또는 content_id 필요' });
  } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
});

/* ================================================================
 *  /api/oauth — 플랫폼 OAuth 콜백
 * ================================================================ */
const youtubePublisher = require('./publishers/youtube');
const naverPublisher = require('./publishers/naver-blog');

app.get('/api/oauth/google/start', requireUser, (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/api/oauth/google/callback`;
  if (!clientId || !clientSecret) return res.status(500).json({ ok: false, error: 'GOOGLE_CLIENT_ID/SECRET 미설정' });
  const state = Buffer.from(JSON.stringify({ user_id: req.userId })).toString('base64url');
  const url = youtubePublisher.getAuthUrl(clientId, clientSecret, redirectUri, state);
  res.json({ ok: true, url });
});

app.get('/api/oauth/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).send('Authorization code 없음');
    const stateData = JSON.parse(Buffer.from(state || '', 'base64url').toString());
    const userId = stateData.user_id;
    if (!userId) return res.status(400).send('state에 user_id 없음');

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/api/oauth/google/callback`;

    const tokens = await youtubePublisher.exchangeCode(clientId, clientSecret, redirectUri, code);

    db.channelConnCreate({
      user_id: userId,
      platform: 'youtube',
      account_name: 'YouTube Channel',
      access_token: tokens.access_token || '',
      refresh_token: tokens.refresh_token || '',
      token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      metadata_json: { client_id: clientId, client_secret: clientSecret, scope: tokens.scope }
    });

    res.send('<html><body><h2>YouTube 채널 연결 완료!</h2><p>이 창을 닫고 Blog Studio로 돌아가세요.</p><script>window.close()</script></body></html>');
  } catch (e) {
    res.status(500).send(`OAuth 오류: ${e.message}`);
  }
});

app.get('/api/oauth/naver/start', requireUser, (req, res) => {
  const clientId = process.env.NAVER_CLIENT_ID;
  if (!clientId) return res.status(500).json({ ok: false, error: 'NAVER_CLIENT_ID 미설정' });
  const redirectUri = process.env.NAVER_REDIRECT_URI || `http://localhost:${PORT}/api/oauth/naver/callback`;
  const state = Buffer.from(JSON.stringify({ user_id: req.userId })).toString('base64url');
  const url = naverPublisher.getAuthUrl(clientId, redirectUri, state);
  res.json({ ok: true, url });
});

app.get('/api/oauth/naver/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).send('Authorization code 없음');
    const stateData = JSON.parse(Buffer.from(state || '', 'base64url').toString());
    const userId = stateData.user_id;
    if (!userId) return res.status(400).send('state에 user_id 없음');

    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;

    const tokens = await naverPublisher.exchangeCode(clientId, clientSecret, code, state);

    if (tokens.error) {
      return res.status(400).send(`네이버 토큰 오류: ${tokens.error_description || tokens.error}`);
    }

    db.channelConnCreate({
      user_id: userId,
      platform: 'naver_blog',
      account_name: '네이버 블로그',
      access_token: tokens.access_token || '',
      refresh_token: tokens.refresh_token || '',
      token_expires_at: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null,
      metadata_json: { token_type: tokens.token_type }
    });

    res.send('<html><body><h2>네이버 블로그 연결 완료!</h2><p>이 창을 닫고 Blog Studio로 돌아가세요.</p><script>window.close()</script></body></html>');
  } catch (e) {
    res.status(500).send(`OAuth 오류: ${e.message}`);
  }
});

/* ================================================================
 *  예약 발행 스케줄러 (30초마다)
 * ================================================================ */
const SCHEDULER_INTERVAL = 30_000;
let schedulerTimer = null;

function startScheduler() {
  schedulerTimer = setInterval(async () => {
    try {
      const results = await db.processScheduledItems();
      if (results.length) console.log(`[scheduler] 예약 발행 ${results.length}건 처리`);
    } catch (e) { console.error('[scheduler]', e); }
  }, SCHEDULER_INTERVAL);
}

/* ================================================================
 *  서버 시작
 * ================================================================ */
app.listen(PORT, () => {
  console.log(`\nBlog Studio dev server: http://localhost:${PORT}`);
  console.log(`  DB: data/blog-studio.db (SQLite)`);
  console.log(`  Storage: storage/users/{user_id}/...`);
  console.log(`  API:`);
  console.log(`    Auth:     POST /api/auth/register, /api/auth/login, GET /api/users/me`);
  console.log(`    Projects: GET/POST /api/projects, PATCH /api/projects/:id`);
  console.log(`    Accounts: GET/POST/PATCH/DELETE /api/accounts, GET /api/accounts/with-channels`);
  console.log(`    Channels: GET/POST/PATCH/DELETE /api/channel-connections`);
  console.log(`    Contents: GET/POST/PUT/DELETE /api/contents, POST confirm-final, batch`);
  console.log(`    Assets:   POST /api/assets/upload, GET /api/assets/:contentId`);
  console.log(`    Publish:  POST /api/publish/now, /schedule, /retry, /cancel, /batch`);
  console.log(`    Queue:    GET /api/publish/queue, /queue/stats`);
  console.log(`    History:  GET /api/publish/history`);
  console.log(`    Admin:    GET /api/admin/stats, /api/admin/users`);
  console.log(`    AI:       POST /api/openai/chat, /api/anthropic/messages`);
  console.log(`  Scheduler: ${SCHEDULER_INTERVAL / 1000}초 간격 예약 발행`);
  startScheduler();
});

process.on('SIGINT', () => {
  if (schedulerTimer) clearInterval(schedulerTimer);
  db.closeDb();
  process.exit(0);
});
