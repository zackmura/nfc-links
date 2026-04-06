const CACHE_NAME = 'novera-erp-v1';
// Arquivos essenciais para o app carregar rápido
const urlsToCache = [
  '/novera/',
  '/novera/index.html',
  '/novera/manifest.json'
];

// Instala o Service Worker e guarda os arquivos no cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Intercepta as requisições (se estiver sem internet, ele tenta carregar do cache)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retorna o cache se achar, senão faz a requisição normal pela rede
        return response || fetch(event.request);
      })
  );
});
