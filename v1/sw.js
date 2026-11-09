// WHY: installable means the shelf still opens when the network is gone. This worker answers one
//      question - what to serve when nobody can be asked - and it holds no game knowledge at all.
// PACK: loopworks-installable
// 2026-11-08 qoder-agent: written on the learner's direction, "turn into a pwa and make it
//      installable", under delegated authority; the design notes are in the pack's PRD-TRD.

const CACHE = 'loopworks-v1-r2';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(request.mode === 'navigate' ? freshPage(request) : keptCopy(request));
});

// WHY: a page asks the network first, because a deploy has to reach a player on the next open; the
//      last good copy is the answer only when the network fails.
async function freshPage(request) {
  try {
    const response = await fetch(request);
    if (response.ok) keep(request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    return cached || caches.match('./index.html') || Response.error();
  }
}

// WHY: an asset asks the network first for the same reason the page does. While this worker served the
//      shelf first, the first open after a deploy paired a fresh page with the previous stylesheet and
//      the input area broke (docs/drift.md D-20). The shelf is still the answer when the network is
//      gone, so offline is kept; it just no longer wins over a live deploy.
async function keptCopy(request) {
  try {
    const response = await fetch(request);
    if (response.ok) keep(request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    return cached || Response.error();
  }
}

async function keep(request, response) {
  try {
    const cache = await caches.open(CACHE);
    await cache.put(request, response);
  } catch (error) {
    // WHY: a full or private-mode cache must not turn a working page into a failed one.
  }
}
