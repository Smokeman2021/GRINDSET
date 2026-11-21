// Автотести логіки погоди й часу доби для сцен. Запуск: node --test supabase/tests/*.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { dayPart, forecastUrl, grade, mapWmo, parseForecast, resolveScene } from '../../app-mvp/src/art/weatherLogic.ts';

test('WMO-коди → спрощена погода', () => {
  assert.equal(mapWmo(0), 'clear');
  assert.equal(mapWmo(3), 'overcast');
  assert.equal(mapWmo(45), 'fog');
  assert.equal(mapWmo(61), 'rain');
  assert.equal(mapWmo(81), 'rain');
  assert.equal(mapWmo(95), 'rain');
  assert.equal(mapWmo(73), 'snow');
  assert.equal(mapWmo(86), 'snow');
});

test('час доби за годинником', () => {
  const at = (h: number) => dayPart(new Date(2026, 10, 2, h, 0, 0));
  assert.equal(at(23), 'night');
  assert.equal(at(3), 'night');
  assert.equal(at(6), 'dawn');
  assert.equal(at(13), 'day');
  assert.equal(at(20), 'dusk');
});

test('розбір відповіді Open-Meteo і URL для Києва', () => {
  assert.equal(parseForecast({ current: { weather_code: 71 } }), 'snow');
  assert.equal(parseForecast({ current: {} }), null);
  assert.equal(parseForecast(null), null);
  assert.match(forecastUrl(), /latitude=50\.45&longitude=30\.52/);
});

test('ручний режим бере гору над реальною погодою, off вимикає', () => {
  const noon = new Date(2026, 10, 2, 13);
  assert.equal(resolveScene('off', 'rain', noon), null);
  assert.deepEqual(resolveScene('auto', 'rain', noon), { weather: 'rain', part: 'day' });
  assert.deepEqual(resolveScene('auto', null, noon), { weather: 'clear', part: 'day' });
  assert.deepEqual(resolveScene('snow', 'rain', noon), { weather: 'snow', part: 'day' });
  assert.deepEqual(resolveScene('night', 'rain', noon), { weather: 'clear', part: 'night' });
});

test('колір-корекція: ясний день без накладки, ніч і дощ з нею', () => {
  assert.equal(grade({ weather: 'clear', part: 'day' }), null);
  assert.ok(grade({ weather: 'clear', part: 'night' })!.opacity >= 0.4);
  assert.ok(grade({ weather: 'rain', part: 'day' })!.opacity > 0);
  assert.equal(grade(null), null);
});
