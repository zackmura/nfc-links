const CACHE_NAME = 'novera-erp-v4.2';
// Arquivos essenciais usando caminhos relativos
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './logo-192.png',
  './logo-512.png'
];

// Instala o Service Worker
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Força a atualização imediata se houver novo código
});

// Ativa e limpa caches antigos
self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// Intercepta as requisições (mantendo sempre online para buscar os dados frescos do Google)
self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});
