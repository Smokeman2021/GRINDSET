// Service worker-«очисник» (cache-busting для Telegram Mini App і мобільних браузерів).
// Нічого не кешує й не перехоплює запити: усе завжди з мережі. Його єдина робота: при оновленні відразу стати активним (skipWaiting),
// забрати керування відкритими вкладками (clients.claim) і видалити ВСІ старі кеші попередніх збірок, щоб стара b23 не показувалась.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});
