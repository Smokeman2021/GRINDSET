// Запобіжник для Edge Function invite-login: у b18 коментар у рядку проковтнув `.eq('id', r.id)`, і оновлення входу пішло б без фільтра.
// Запуск: node --test supabase/tests/*.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../functions/invite-login/index.ts', import.meta.url), 'utf8');

test('жоден ланцюжок викликів Supabase не схований у рядковому коментарі', () => {
  const bad = src.split('\n').filter((l) => /\/\/[^\n]*\.(eq|neq|update|select|insert|delete|rpc)\(/.test(l) && !/https?:\/\//.test(l));
  assert.deepEqual(bad, []);
});

test('кожне оновлення таблиці allowed_users має фільтр .eq(...)', () => {
  const lines = src.split('\n');
  lines.forEach((l, i) => {
    if (!l.includes(".update(")) return;
    // фільтр має бути в цьому ж або в наступних 2 рядках
    const window = lines.slice(i, i + 3).join(' ');
    assert.match(window, /\.eq\(/, `оновлення без фільтра біля рядка ${i + 1}`);
  });
});
