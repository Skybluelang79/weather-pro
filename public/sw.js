const CACHE_NAME = 'weatherpro-v4';
const PRECACHE = ['/', '/index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => {
        const hadOldCache = keys.some((key) => key.startsWith('weatherpro-') && key !== CACHE_NAME);
        return Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))).then(() => hadOldCache);
      })
      .then((hadOldCache) => self.clients.claim().then(() => hadOldCache))
      .then((hadOldCache) => {
        if (!hadOldCache) return undefined;
        return self.clients.matchAll({ type: 'window' }).then((clients) => {
          clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED' }));
        });
      })
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  const request = e.request;

  // API: stale-while-revalidate
  const liveApi = [
    '/api/alerts', '/api/subscription', '/api/billing', '/api/favorites', '/api/history',
    '/api/auth', '/api/plans',
  ];
  if (url.pathname.startsWith('/api/') && !liveApi.some(prefix => url.pathname.startsWith(prefix))) {
    e.respondWith(swr(request));
    return;
  }

  // Navigations (HTML): network-first, cache fallback only when offline
  if (request.mode === 'navigate') {
    e.respondWith(networkFirst(request));
    return;
  }

  // Static assets: stale-while-revalidate
  e.respondWith(swr(request));
});

function swr(request) {
  return caches.open(CACHE_NAME).then((cache) =>
    cache.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached || new Response(JSON.stringify({ error: 'Offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }));
      return cached || fetchPromise;
    })
  );
}

function networkFirst(request) {
  return caches.open(CACHE_NAME).then((cache) =>
    fetch(request)
      .then((res) => {
        if (res.ok) cache.put(request, res.clone());
        return res;
      })
      .catch(() => cache.match(request))
  );
}

self.addEventListener('push', (e) => {
  let payload = {};
  try {
    payload = e.data ? e.data.json() : {};
  } catch {
    payload = { body: e.data ? e.data.text() : 'A weather alert was triggered.' };
  }

  const title = payload.title || 'WeatherPro alert';
  const options = {
    body: payload.body || 'A weather alert was triggered.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || 'weatherpro-alert',
    data: { url: payload.url || '/' },
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  let target;
  try {
    target = new URL(e.notification.data?.url || '/', self.location.origin);
  } catch {
    target = new URL('/', self.location.origin);
  }
  if (target.origin !== self.location.origin) target = new URL('/', self.location.origin);
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).pathname === target.pathname && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target.href);
      return undefined;
    })
  );
});