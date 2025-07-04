const CACHE_NAME = 'suquinho-cache-v2'; // Incremented version to force update
const OFFLINE_PAGE = '/index.html';

const urlsToCache = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/manifest.json',
  '/calendario/index.html',
  '/calendario/script.js',
  '/Catalogo1/catalogo.js',
  '/Catalogo1/index.html',
  '/Hyper/hyper.html',
  '/Hyper/Script.js',
  '/js/script.js',
  '/links/links.html',
  '/links/links.txt',
  '/links/pluto_br_final.m3u',
  '/links/vi.mp4',
  '/sorteio/index.html',
  '/sorteio/script.js',
  '/update/index.html',
  '/Yt/script.js',
  '/Yt/yt.html',
  '/themes/anime/calendario.css',
  '/themes/anime/catálogo.css',
  '/themes/anime/integration.css',
  '/themes/anime/ocultos.css',
  '/themes/anime/sidebar.css',
  '/themes/anime/sorteio.css',
  '/themes/anime/update.css',
  '/themes/default/calendario.css',
  '/themes/default/catálogo.css',
  '/themes/default/integration.css',
  '/themes/default/ocultos.css',
  '/themes/default/sidebar.css',
  '/themes/default/sorteio.css',
  '/themes/default/update.css',
  '/themes/dracula/calendario.css',
  '/themes/dracula/catálogo.css',
  '/themes/dracula/integration.css',
  '/themes/dracula/ocultos.css',
  '/themes/dracula/sidebar.css',
  '/themes/dracula/sorteio.css',
  '/themes/dracula/update.css',
  OFFLINE_PAGE
];

// Instala e armazena os arquivos
self.addEventListener('install', event => {
  self.skipWaiting();  // Ativação mais rápida
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Limpa caches antigos
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();  // Controle imediato das páginas
});

// Estratégia de cache
self.addEventListener('fetch', event => {
  // Ignora requisições não-GET
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request).then(response => {
      // Retorna do cache se disponível
      if (response) return response;
      
      // Busca na rede
      return fetch(event.request).then(networkResponse => {
        // Filtra respostas inválidas
        if (!networkResponse || 
            networkResponse.status !== 200 || 
            networkResponse.type !== 'basic') {
          return networkResponse;
        }
        
        // Armazena no cache
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        
        return networkResponse;
      }).catch(() => {
        // Fallback para navegação offline
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_PAGE);
        }
        // Fallback genérico
        return new Response('Offline - Conteúdo não disponível');
      });
    })
  );
});