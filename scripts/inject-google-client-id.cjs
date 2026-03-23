/**
 * Netlify 빌드 시 GOOGLE_CLIENT_ID → files (5)/index.html 의 SITE_GOOGLE_CLIENT_ID 에 주입.
 * 웹 OAuth 클라이언트 ID는 공개 값이며, Functions 404·미배포여도 로그인 페이지가 동작하도록 함.
 */
const fs = require('fs');
const path = require('path');

const id = (
  process.env.BLOG_STUDIO_GOOGLE_CLIENT_ID ||
  process.env.GOOGLE_CLIENT_ID ||
  ''
).trim();

const target = path.join(__dirname, '..', 'files (5)', 'index.html');
let html = fs.readFileSync(target, 'utf8');
const needle = /const SITE_GOOGLE_CLIENT_ID = '';/;

if (!id) {
  console.warn(
    '[inject-google-client-id] GOOGLE_CLIENT_ID / BLOG_STUDIO_GOOGLE_CLIENT_ID 비어 있음 — 주입 생략'
  );
  process.exit(0);
}

if (!needle.test(html)) {
  console.warn('[inject-google-client-id] index.html 패턴 불일치 — 주입 생략');
  process.exit(0);
}

html = html.replace(needle, `const SITE_GOOGLE_CLIENT_ID = ${JSON.stringify(id)};`);
fs.writeFileSync(target, html);
console.log('[inject-google-client-id] SITE_GOOGLE_CLIENT_ID 빌드 주입 완료');
