// Перевірка свіжості веб-збірки (cache-busting). Telegram Mini App і мобільні браузери агресивно кешують index.html,
// тож тестери можуть бачити стару версію. Механіка:
//  1) /version.json віддається з Cache-Control: no-store (vercel.json) і містить номер актуальної збірки;
//  2) при запуску й при поверненні у вкладку застосунок порівнює його з власним UI_BUILD;
//  3) якщо на сервері новіше: скидаємо Cache Storage та service worker (якщо є) і відкриваємо адресу з параметром ?v=<збірка>:
//     нова адреса обходить кешований index.html. hash (#tgWebAppData…) зберігається, тож Mini App лишається авторизованим.
// Захист від циклу: один перезапуск на номер збірки (sessionStorage).
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { UI_BUILD } from './version';

const GUARD = 'grindset-reloaded-for';
const MIN_GAP_MS = 5 * 60 * 1000;
let lastCheck = 0;

async function check(): Promise<void> {
  if (typeof window === 'undefined' || Date.now() - lastCheck < MIN_GAP_MS) return;
  lastCheck = Date.now();
  let remote = 0;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const j = (await res.json()) as { build?: unknown };
    remote = typeof j.build === 'number' ? j.build : 0;
  } catch {
    return; // немає мережі або dev-сервер без version.json
  }
  if (remote <= UI_BUILD) return;
  try {
    if (window.sessionStorage.getItem(GUARD) === String(remote)) return; // вже перезавантажувались заради цієї збірки
    window.sessionStorage.setItem(GUARD, String(remote));
  } catch {
    // без sessionStorage лишаємо один перезапуск за життя сторінки (lastCheck не скидається)
  }
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    const keys = (await window.caches?.keys?.()) ?? [];
    await Promise.all(keys.map((k) => window.caches.delete(k)));
  } catch {
    // не критично
  }
  const url = new URL(window.location.href);
  url.searchParams.set('v', String(remote));
  window.location.replace(url.toString()); // hash лишається в url.hash
}

export function useWebVersionGuard(): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    void check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
}
