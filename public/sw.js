// Service worker do Desafia: deixa o jogo abrir mesmo sem internet.
// Não guarda nada do Supabase (dados sempre vêm frescos do servidor).
const CACHE = 'desafia-v1';
const SHELL = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/fonts/Grandstander.ttf',
  '/fonts/AtkinsonHyperlegible-Regular.ttf',
  '/fonts/AtkinsonHyperlegible-Bold.ttf'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // Supabase e outros domínios: direto na rede
  if (url.pathname.startsWith('/pais')) return;             // portal dos pais sempre online
  if (url.pathname.startsWith('/.well-known')) return;

  if (req.mode === 'navigate') {
    // Página: tenta a rede primeiro, cai no cache sem internet.
    event.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); return res; })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Arquivos: usa o cache e atualiza em segundo plano.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })
        .catch(() => cached);
      return cached || network;
    })
  );
});
