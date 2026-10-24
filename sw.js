// ═══════════════════════════════════════════════════════
// DUENDE QUEST — service worker (app instalable desde el navegador)
//
// Hace que la web se pueda instalar como app (Chrome, Edge, Android) y que
// abra rapido: guarda los archivos con version (?v=N) y las imagenes, y si no
// hay conexion muestra /offline en vez del dinosaurio. NUNCA guarda:
// el WebSocket del MMO, /api/ ni nada que no sea GET del propio sitio.
// Al subir CACHE (lo hace tools/release al cambiar de version) se borra lo viejo.
// ═══════════════════════════════════════════════════════
const CACHE = 'dq-v282';
const OFFLINE = '/offline';   // Cloudflare sirve /offline.html como /offline (sin redirigir)
const PRECARGA = [OFFLINE, '/assets/ui/icon-192.png', '/assets/ui/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECARGA)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('dq-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/mmo/ws') || url.pathname === '/sw.js') return;
  // Paginas: siempre de la red (cada version nueva llega al momento); sin red, la pagina offline.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }
  // Archivos con version e imagenes/sonidos: de la cache si ya estan, y si no de la red (y se guardan).
  const versionado = url.searchParams.has('v') && /\.(js|css)$/.test(url.pathname);
  const recurso = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/audio/');
  if (!versionado && !recurso) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req);
    if (hit) return hit;
    const r = await fetch(req);
    if (r.ok && r.type === 'basic') c.put(req, r.clone()).catch(() => {});
    return r;
  }));
});
