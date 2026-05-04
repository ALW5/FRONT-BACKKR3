Практические занятия 13-17 — PWA, Service Worker, Push-уведомления
Стек технологий
Бэкенд: Node.js, Express.js, Socket.io, web-push

Фронтенд: HTML5, CSS, JavaScript (ES6+)

PWA технологии: Service Worker, Web App Manifest, App Shell

Данные: localStorage

Сетевое взаимодействие: WebSocket, Push-уведомления

Практика 13 — Service Worker (офлайн-доступ)
Что сделано:
Реализовано веб-приложение для управления заметками, которое использует Service Worker для обеспечения работы в офлайн-режиме. При первом посещении все статические ресурсы (HTML, CSS, JS, иконки) кэшируются в Cache Storage. При повторных визитах или отсутствии сети страница загружается из кэша.

Service Worker перехватывает fetch-запросы и возвращает ответы из кэша (стратегия Cache First), что делает приложение полностью работоспособным без интернета. Данные заметок сохраняются в localStorage, поэтому они не теряются при перезагрузке.

Что сделано:

Регистрация Service Worker через navigator.serviceWorker.register()

Событие install — кэширование статических ресурсов

Событие fetch — перехват запросов и возврат из кэша

Событие activate — очистка старых кэшей

Хранение заметок в localStorage

Как реализовано:
// sw.js — кэширование статики
const CACHE_NAME = 'notes-cache-v1';
const ASSETS = ['/', '/index.html', '/app.js'];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});

Практика 14 — Web App Manifest (установка PWA)
Что сделано:
Приложение превращено в прогрессивное веб-приложение (PWA) с возможностью установки на устройство. Создан файл manifest.json, который содержит метаданные: имя приложения, иконки разных размеров, цвет темы, режим отображения (standalone).

В index.html добавлены мета-теги для iOS и Android, а также ссылка на манифест. Иконки подготовлены в размерах 16×16, 32×32, 48×48, 64×64, 128×128, 256×256, 512×512 пикселей.

Что сделано:

Создан manifest.json с полями: name, short_name, start_url, display, background_color, theme_color, icons

Подготовлен набор иконок в формате PNG (7 размеров)

Добавлены мета-теги для мобильных платформ:

mobile-web-app-capable (Android)

apple-touch-icon (iOS)

apple-mobile-web-app-status-bar-style (iOS)

Service Worker обновлён для кэширования иконок и манифеста

Как реализовано:
{
  "name": "Мои Заметки",
  "short_name": "Заметки",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#4285f4",
  "icons": [
    { "src": "icons/icon-48x48.png", "sizes": "48x48", "type": "image/png" },
    { "src": "icons/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}

Практика 15 — HTTPS + App Shell (мгновенная загрузка)
Что сделано:
Настроено безопасное соединение через HTTPS с использованием утилиты mkcert (самоподписанный сертификат для локальной разработки). Это требование для работы Service Worker и push-уведомлений.

Реализована архитектура App Shell — каркас приложения (шапка, меню, основной контейнер) кэшируется при первом посещении и загружается мгновенно при последующих запусках. Динамический контент (главная страница, страница "О приложении") подгружается через fetch и кэшируется отдельно.

Стратегии кэширования:

Статика (App Shell) — Cache First (сначала из кэша)

Динамические страницы — Network First (сначала сеть, потом кэш с fallback)

Что сделано:

Настройка HTTPS через mkcert (локальный сертификат)

Разделение приложения на каркас (index.html) и динамические страницы (content/home.html, content/about.html)

Реализация навигации без перезагрузки страницы

Кэширование статики и динамики в разные хранилища

При офлайн-режиме каркас загружается всегда, а контент — из кэша

Как реализовано:
// sw.js — разные стратегии для статики и динамики
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Динамические страницы — Network First
    if (url.pathname.startsWith('/content/')) {
        event.respondWith(
            fetch(event.request)
                .then(res => { caches.open(DYNAMIC_CACHE).put(event.request, res.clone()); return res; })
                .catch(() => caches.match(event.request))
        );
    } else {
        // Статика — Cache First
        event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
    }
});

Практика 16 — WebSocket + Push-уведомления
Что сделано:
Реализована двусторонняя связь в реальном времени через WebSocket (библиотека socket.io). Когда один пользователь добавляет заметку, всем остальным подключённым клиентам мгновенно приходит уведомление.

Добавлена поддержка push-уведомлений через сервис Web Push. Пользователь может подписаться на уведомления (кнопка "Включить уведомления"). При добавлении новой заметки сервер отправляет push-уведомление всем подписанным клиентам — даже если вкладка с приложением закрыта.

Что сделано:

Сервер на Node.js с Socket.io и web-push

Генерация VAPID-ключей для идентификации сервера

Клиентская подписка на push через PushManager

Хранение подписок на сервере (в памяти)

Отправка push-уведомлений при создании задачи

Всплывающие уведомления через WebSocket для активных клиентов

Как реализовано:
// server.js — WebSocket + Push
io.on('connection', (socket) => {
    socket.on('newTask', (task) => {
        io.emit('taskAdded', task);  // Рассылка через WebSocket
        
        // Отправка push всем подписанным
        subscriptions.forEach(sub => {
            webpush.sendNotification(sub, JSON.stringify({
                title: 'Новая задача',
                body: task.text
            }));
        });
    });
});

// app.js — подписка на push
async function subscribeToPush() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    await fetch('/subscribe', { method: 'POST', body: JSON.stringify(subscription) });
}

Практика 17 — Детализация Push (откладывание напоминаний)
Что сделано:
Добавлена возможность создавать напоминания — заметки с указанием даты и времени. На сервере реализовано планирование push-уведомлений с помощью setTimeout. Когда наступает время напоминания, пользователь получает push-уведомление.

В уведомление добавлена кнопка "Отложить на 5 минут". При нажатии сервер получает запрос, отменяет текущий таймер и устанавливает новый на 5 минут. Через 5 минут уведомление повторяется.

Что сделано:

Форма для создания заметки с напоминанием (текст + datetime-local)

Структура заметки: id, text, reminder (timestamp)

Серверное хранилище активных напоминаний (Map)

Планирование push через setTimeout (вычисление задержки)

Эндпоинт /snooze для откладывания напоминания

Обработка notificationclick в Service Worker (распознавание кнопки "Отложить")

Формирование payload с reminderId для идентификации

Как реализовано:
// server.js — планирование напоминаний
socket.on('newReminder', (reminder) => {
    const delay = reminder.reminderTime - Date.now();
    const timeoutId = setTimeout(() => {
        const payload = JSON.stringify({ title: 'Напоминание', body: reminder.text, reminderId: reminder.id });
        subscriptions.forEach(sub => webpush.sendNotification(sub, payload));
        reminders.delete(reminder.id);
    }, delay);
    reminders.set(reminder.id, { timeoutId, text: reminder.text });
});

// sw.js — обработка кнопки "Отложить"
self.addEventListener('notificationclick', (event) => {
    if (event.action === 'snooze') {
        fetch(`/snooze?reminderId=${event.notification.data.reminderId}`, { method: 'POST' });
    }
    event.notification.close();
});
Практика 17 — Детализация Push (откладывание напоминаний)
Что сделано:
Добавлена возможность создавать напоминания — заметки с указанием даты и времени. На сервере реализовано планирование push-уведомлений с помощью setTimeout. Когда наступает время напоминания, пользователь получает push-уведомление.

В уведомление добавлена кнопка "Отложить на 5 минут". При нажатии сервер получает запрос, отменяет текущий таймер и устанавливает новый на 5 минут. Через 5 минут уведомление повторяется.

Что сделано:

Форма для создания заметки с напоминанием (текст + datetime-local)

Структура заметки: id, text, reminder (timestamp)

Серверное хранилище активных напоминаний (Map)

Планирование push через setTimeout (вычисление задержки)

Эндпоинт /snooze для откладывания напоминания

Обработка notificationclick в Service Worker (распознавание кнопки "Отложить")

Формирование payload с reminderId для идентификации

Как реализовано:
// server.js — планирование напоминаний
socket.on('newReminder', (reminder) => {
    const delay = reminder.reminderTime - Date.now();
    const timeoutId = setTimeout(() => {
        const payload = JSON.stringify({ title: 'Напоминание', body: reminder.text, reminderId: reminder.id });
        subscriptions.forEach(sub => webpush.sendNotification(sub, payload));
        reminders.delete(reminder.id);
    }, delay);
    reminders.set(reminder.id, { timeoutId, text: reminder.text });
});

// sw.js — обработка кнопки "Отложить"
self.addEventListener('notificationclick', (event) => {
    if (event.action === 'snooze') {
        fetch(`/snooze?reminderId=${event.notification.data.reminderId}`, { method: 'POST' });
    }
    event.notification.close();
});  
Запуск проекта
1. Установка зависимостей
bash
npm install
2. Генерация VAPID-ключей (для push-уведомлений)
bash
npx web-push generate-vapid-keys
Скопируйте ключи в server.js и app.js

3. Запуск сервера
bash
npm start
Сервер запустится на http://localhost:3001
