// Збирає ОДИН файл supabase/functions/telegram-auth/index.ts (його вставляють у Supabase → Edge Functions) із двох частин:
//  - app-mvp/src/cloud/shared/telegramAuth.ts (чиста логіка, яку перевіряють автотести і яку використовує режим-імітація),
//  - supabase/functions/telegram-auth/handler.template.ts (мережева частина).
// Запуск: node scripts/build-edge-function.mjs      Перевірка актуальності: node scripts/build-edge-function.mjs --check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shared = fs.readFileSync(path.join(root, 'app-mvp', 'src', 'cloud', 'shared', 'telegramAuth.ts'), 'utf8').replace(/\r\n/g, '\n');
const handler = fs.readFileSync(path.join(root, 'supabase', 'functions', 'telegram-auth', 'handler.template.ts'), 'utf8').replace(/\r\n/g, '\n');
const out = path.join(root, 'supabase', 'functions', 'telegram-auth', 'index.ts');

const text =
  '// ЗГЕНЕРОВАНО скриптом scripts/build-edge-function.mjs: не редагуй вручну.\n' +
  '// Правки логіки: app-mvp/src/cloud/shared/telegramAuth.ts; мережева частина: handler.template.ts. Потім запусти скрипт.\n' +
  '// Як розгорнути: Supabase → Edge Functions → Create function (назва telegram-auth) → вставити весь вміст цього файлу → Deploy.\n' +
  '// Вимкни «Verify JWT» для цієї функції (її викликають до входу).\n\n' +
  shared.trimEnd() +
  '\n\n' +
  handler;

if (process.argv.includes('--check')) {
  const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').replace(/\r\n/g, '\n') : '';
  if (cur !== text) {
    console.error('index.ts застарів: запусти node scripts/build-edge-function.mjs');
    process.exit(1);
  }
  console.log('index.ts актуальний');
} else {
  fs.writeFileSync(out, text);
  console.log('записано', path.relative(root, out));
}
