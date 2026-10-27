// Автотести CSV-вивантаження. Запуск: node --test supabase/tests/*.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, toCsv } from '../../app-mvp/src/cloud/shared/csv.ts';

test('лапки, коми й переноси екрануються', () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('кажу "привіт"'), '"кажу ""привіт"""');
  assert.equal(csvCell('рядок1\nрядок2'), '"рядок1\nрядок2"');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(5), '5');
});

test('формули не виконуються: небезпечний початок отримує апостроф', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell('+1'), `'+1`);
  assert.equal(csvCell('@cmd'), `'@cmd`);
  assert.equal(csvCell('-2+3'), `'-2+3`);
  assert.equal(csvCell(-3), '-3'); // справжнє від'ємне число лишається числом
});

test('toCsv збирає заголовок і рядки', () => {
  assert.equal(toCsv(['a', 'b'], [[1, 'x,y']]), 'a,b\r\n1,"x,y"\r\n');
});
