// Місток між стором і синхронізацією (щоб store.ts не імпортував progressSync.ts по колу).
// Стор повідомляє про кожну зміну серверного ядра операцією; синхронізація кладе її в чергу на пристрої.
import { CLOUD_MODE } from './config';
import type { Op } from './shared/progressOps';

type Sink = (op: Op) => Promise<void>;
let sink: Sink | null = null;
let buffer: Op[] = []; // операції, створені до входу (напр. добовий бонус енергії при запуску)

// Проміс завершується, коли операцію ЗАПИСАНО у сховище пристрою; відхиляється, якщо запис не вдався
export function emitOp(op: Op): Promise<void> {
  if (sink) return sink(op);
  if (CLOUD_MODE !== 'off' && buffer.length < 200) buffer.push(op);
  return Promise.resolve();
}

// Повертає операції, накопичені без приймача
export function setOpSink(next: Sink | null): Op[] {
  sink = next;
  const pending = buffer;
  buffer = [];
  return pending;
}
