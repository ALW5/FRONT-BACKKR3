    const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

// ==================== VAPID КЛЮЧИ ====================
// Сгенерируйте свои через команду: npx web-push generate-vapid-keys
const vapidKeys = {
  publicKey: 'BL7LxEnfvSi8kBnGvllWA1rhDMkachBQUaIb5MptSdUqfTyLOfpXRDfYi9VNzWQF2DdG559JPL2JGrzQ0xMKiaQ',
  privateKey: 'YDofJq2R0DjM_twF4KHrvSnBo53jwPfDIFVqVe77_-U'
};

webpush.setVapidDetails(
  'mailto:your-email@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Хранилище push-подписок
let subscriptions = [];

// Хранилище активных напоминаний
const reminders = new Map();

const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// ==================== WebSocket ====================
io.on('connection', (socket) => {
  console.log('✅ Клиент подключён:', socket.id);

  // Обработка новой задачи (обычной)
  socket.on('newTask', (task) => {
    console.log('📝 Новая задача:', task);
    io.emit('taskAdded', task);
  });

  // Обработка напоминания
  socket.on('newReminder', (reminder) => {
    const { id, text, reminderTime } = reminder;
    const delay = reminderTime - Date.now();
    
    if (delay <= 0) return;
    
    console.log(`⏰ Напоминание "${text}" через ${Math.round(delay / 60000)} мин`);
    
    const timeoutId = setTimeout(() => {
      const payload = JSON.stringify({
        title: '🔔 Напоминание',
        body: text,
        reminderId: id
      });
      
      subscriptions.forEach(sub => {
        webpush.sendNotification(sub, payload).catch(err => {
          console.error('❌ Push error:', err);
        });
      });
      
      reminders.delete(id);
    }, delay);
    
    reminders.set(id, { timeoutId, text, reminderTime });
  });

  socket.on('disconnect', () => {
    console.log('❌ Клиент отключён:', socket.id);
  });
});

// ==================== Push-подписки ====================
app.post('/subscribe', (req, res) => {
  subscriptions.push(req.body);
  console.log('📢 Новый push-подписчик, всего:', subscriptions.length);
  res.status(201).json({ message: 'Подписка сохранена' });
});

app.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint);
  console.log('🔕 Отписка, осталось:', subscriptions.length);
  res.status(200).json({ message: 'Подписка удалена' });
});

// ==================== Откладывание напоминания ====================
app.post('/snooze', (req, res) => {
  const reminderId = parseInt(req.query.reminderId, 10);
  
  if (!reminderId || !reminders.has(reminderId)) {
    return res.status(400).json({ error: 'Reminder not found' });
  }
  
  const reminder = reminders.get(reminderId);
  clearTimeout(reminder.timeoutId);
  
  const snoozeDelay = 5 * 60 * 1000; // 5 минут
  const newTimeoutId = setTimeout(() => {
    const payload = JSON.stringify({
      title: '🔔 Напоминание (отложено)',
      body: reminder.text,
      reminderId: reminderId
    });
    
    subscriptions.forEach(sub => {
      webpush.sendNotification(sub, payload).catch(err => {
        console.error('❌ Push error:', err);
      });
    });
    
    reminders.delete(reminderId);
  }, snoozeDelay);
  
  reminders.set(reminderId, {
    timeoutId: newTimeoutId,
    text: reminder.text,
    reminderTime: Date.now() + snoozeDelay
  });
  
  console.log(`⏰ Напоминание "${reminder.text}" отложено на 5 минут`);
  res.status(200).json({ message: 'Reminder snoozed for 5 minutes' });
});

// ==================== Запуск сервера ====================
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
  console.log(`📚 PWA приложение доступно по адресу: http://localhost:${PORT}`);
});