const CACHE_NAME = 'notes-cache-v3';
const DYNAMIC_CACHE_NAME = 'dynamic-content-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
  '/content/home.html',
  '/content/about.html',
  '/icons/favicon-16x16.png',
  '/icons/favicon-32x32.png',
  '/icons/favicon-48x48.png',
  '/icons/favicon-64x64.png',
  '/icons/favicon-128x128.png',
  '/icons/favicon-256x256.png',
  '/icons/favicon-512x512.png'
];

// Установка — кэшируем статику
self.addEventListener('install', (event) => {
  console.log('✅ Service Worker установлен');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Активация — удаляем старые кэши
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker активирован');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== DYNAMIC_CACHE_NAME)
          .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Перехват запросов
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Пропускаем запросы к другим источникам
  if (url.origin !== location.origin) return;
  
  // Динамические страницы (content/*) — сначала сеть, потом кэш
  if (url.pathname.startsWith('/content/')) {
    event.respondWith(
      fetch(event.request)
        .then(networkRes => {
          const resClone = networkRes.clone();
          caches.open(DYNAMIC_CACHE_NAME).then(cache => {
            cache.put(event.request, resClone);
          });
          return networkRes;
        })
        .catch(() => {
          return caches.match(event.request)
            .then(cached => cached || caches.match('/content/home.html'));
        })
    );
    return;
  }
  
  // Статика — Cache First
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
  );
});

// Обработка push-уведомлений
self.addEventListener('push', (event) => {
  let data = { title: '🔔 Новое уведомление', body: '', reminderId: null };
  
  if (event.data) {
    data = event.data.json();
  }
  
  const options = {
    body: data.body,
    icon: '/icons/favicon-128x128.png',
    badge: '/icons/favicon-48x48.png',
    vibrate: [200, 100, 200],
    data: { reminderId: data.reminderId },
    tag: 'reminder',
    renotify: true
  };
  
  // Добавляем кнопку для напоминаний
  if (data.reminderId) {
    options.actions = [
      { action: 'snooze', title: '⏰ Отложить на 5 минут' },
      { action: 'close', title: '✖️ Закрыть' }
    ];
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  
  event.notification.close();
  
  if (action === 'snooze') {
    const reminderId = notification.data.reminderId;
    if (reminderId) {
      event.waitUntil(
        fetch(`/snooze?reminderId=${reminderId}`, { method: 'POST' })
          .then(() => console.log('✅ Напоминание отложено'))
          .catch(err => console.error('❌ Ошибка откладывания:', err))
      );
    }
  } else {
    // Открываем приложение
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});