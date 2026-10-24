// ═══════════════════════════════════════════════════════
// DUENDE QUEST — service worker (app instalable desde el navegador)
//
// Hace que la web se pueda instalar como app (Chrome, Edge, Android) y que
// abra rapido: guarda los archivos con version (?v=N) y las imagenes, y si no
// hay conexion muestra /offline en vez del dinosaurio. NUNCA guarda:
// el WebSocket del MMO, /api/ ni nada que no sea GET del propio sitio.
// Al subir CACHE se borra lo viejo. El script de publicacion lo sube junto con
// el ?v= de cada version (si se publica a mano, subirlo tambien a mano); las
// imagenes/sonidos se revalidan solos.
// ═══════════════════════════════════════════════════════
const CACHE = 'dq-v286';
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
  // Media con Range (audio/video por trozos): que lo maneje el navegador.
  if (req.headers.has('range')) return;
  // JS/CSS con ?v=N: de la cache si ya estan (la URL cambia en cada version).
  // Imagenes/sonidos: de la cache al momento y se revisan en segundo plano
  // (pasa por la cache HTTP de 1 dia de worker.js), asi un PNG regenerado
  // con el mismo nombre llega aunque nadie suba CACHE.
  const versionado = url.searchParams.has('v') && /\.(js|css)$/.test(url.pathname);
  const recurso = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/audio/');
  if (!versionado && !recurso) return;
  // Solo 200 propios y nunca HTML (el fallback de una ruta que no existe).
  const guardable = r => r.status === 200 && r.type === 'basic' && !(r.headers.get('Content-Type') || '').includes('text/html');
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req);
    if (hit && versionado) return hit;
    const red = fetch(req).then(r => { if (guardable(r)) c.put(req, r.clone()).catch(() => {}); return r; });
    if (hit) { e.waitUntil(red.catch(() => {})); return hit; }
    return red;
  }));
});
