/**
 * Netlify [build] command와 동일한 산출물: dist = files (5) 전체 + guidelines/v10 복사
 * 사용: npm run build:dist
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcApp = path.join(root, 'files (5)');
const srcGuidelines = path.join(root, 'guidelines', 'v10');
const dist = path.join(root, 'dist');
const destGuidelines = path.join(dist, 'guidelines', 'v10');

if (!fs.existsSync(srcApp)) {
  console.error('없음:', srcApp);
  process.exit(1);
}
if (!fs.existsSync(srcGuidelines)) {
  console.error('없음:', srcGuidelines);
  process.exit(1);
}

fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(srcApp, dist, { recursive: true });
fs.mkdirSync(destGuidelines, { recursive: true });
fs.cpSync(srcGuidelines, destGuidelines, { recursive: true });

console.log('완료:', dist);
console.log('  +', destGuidelines);
