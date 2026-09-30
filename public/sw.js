const CACHE = 'desafia-v9-20260930-jogos';
const CACHE_PREFIX = 'desafia-';
const SHELL = [
  '/',
  '/pais/',
  '/privacidade/',
  '/termos/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

async function precache() {
  const cache = await caches.open(CACHE);
  const discovered = new Set();

  await Promise.all(SHELL.map(async (path) => {
    const response = await fetch(path, { cache: 'reload' });
    if (!response.ok) throw new Error(`Falha ao preparar cache: ${path}`);

    const copy = response.clone();
    await cache.put(path, copy);

    if ((response.headers.get('content-type') || '').includes('text/html')) {
      const html = await response.text();
      for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
        try {
          const asset = new URL(match[1], self.location.origin);
          if (asset.origin === self.location.origin && /\.(?:js|css|woff2?|ttf|svg|png|webp)$/.test(asset.pathname)) {
            discovered.add(asset.pathname);
          }
        } catch { /* URL inválida: ignora */ }
      }
    }
  }));

  // Segunda passada: os minijogos são carregados sob demanda (import dinâmico),
  // então procuramos os nomes dos pedaços dentro dos JS para deixá-los offline.
  const lazy = new Set();
  await Promise.all([...discovered].map(async (path) => {
    const response = await fetch(path, { cache: 'reload' });
    if (!response.ok) return;
    if (path.endsWith('.js')) {
      const text = await response.clone().text();
      for (const match of text.matchAll(/assets\/[\w.-]+\.(?:js|css)/g)) {
        const asset = `/${match[0]}`;
        if (!discovered.has(asset)) lazy.add(asset);
      }
    }
    await cache.put(path, response);
  }));

  await Promise.all([...lazy].map(async (path) => {
    try {
      const response = await fetch(path, { cache: 'reload' });
      if (response.ok) await cache.put(path, response);
    } catch { /* um jogo que falhar aqui é baixado no primeiro uso */ }
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

function offlinePage() {
  return new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#7658F5"><title>DesafIA — offline</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#ebe7ff;font-family:system-ui;color:#272043"><main style="max-width:360px;margin:24px;padding:28px;border-radius:24px;background:white;text-align:center"><div style="font-size:52px">🌟</div><h1>Sem internet por enquanto</h1><p>O mundo do seu personagem continua aqui. Reconecte-se para sincronizar missões e família.</p><a href="/" style="display:inline-block;border-radius:14px;padding:12px 18px;background:#7658F5;color:white;text-decoration:none;font-weight:800">Tentar novamente</a></main></body></html>`, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/.well-known/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
        }
        return response;
      } catch {
        return (await caches.match(request, { ignoreSearch: true })) || offlinePage();
      }
    })());
    return;
  }

  const immutable = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/fonts/');
  if (immutable) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
        }
        return response;
      } catch {
        return new Response('', { status: 504 });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
      }
      return response;
    } catch {
      return (await caches.match(request)) || new Response('', { status: 504 });
    }
  })());
});
