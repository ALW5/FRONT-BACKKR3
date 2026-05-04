// ==================== DOM элементы ====================
const contentDiv = document.getElementById('app-content');
const homeBtn = document.getElementById('home-btn');
const aboutBtn = document.getElementById('about-btn');
const enablePushBtn = document.getElementById('enable-push');
const disablePushBtn = document.getElementById('disable-push');

// WebSocket подключение
const socket = io();

// ==================== Навигация ====================
function setActiveButton(activeId) {
  [homeBtn, aboutBtn].forEach(btn => btn.classList.remove('active'));
  document.getElementById(activeId).classList.add('active');
}

async function loadContent(page) {
  try {
    const response = await fetch(`/content/${page}.html`);
    const html = await response.text();
    contentDiv.innerHTML = html;
    
    if (page === 'home') {
      initNotes();
    }
  } catch (err) {
    contentDiv.innerHTML = '<p class="is-center text-error">❌ Ошибка загрузки страницы</p>';
    console.error(err);
  }
}

homeBtn.addEventListener('click', () => {
  setActiveButton('home-btn');
  loadContent('home');
});

aboutBtn.addEventListener('click', () => {
  setActiveButton('about-btn');
  loadContent('about');
});

// ==================== Заметки ====================
function initNotes() {
  const form = document.getElementById('note-form');
  const input = document.getElementById('note-input');
  const reminderForm = document.getElementById('reminder-form');
  const reminderText = document.getElementById('reminder-text');
  const reminderTime = document.getElementById('reminder-time');
  const list = document.getElementById('notes-list');
  
  // Загрузка заметок
  function loadNotes() {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    list.innerHTML = notes.map(note => {
      let reminderHtml = '';
      if (note.reminder) {
        const date = new Date(note.reminder);
        reminderHtml = `<div class="reminder-info">⏰ Напоминание: ${date.toLocaleString()}</div>`;
      }
      return `
        <li class="card">
          <strong>${escapeHtml(note.text)}</strong>
          ${reminderHtml}
          <small style="color: #999; display: block; margin-top: 0.5rem;">
            🕐 ${new Date(note.datetime).toLocaleString()}
          </small>
        </li>
      `;
    }).join('');
  }
  
  // Сохранение обычной заметки
  function addNote(text) {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    const newNote = { 
      id: Date.now(), 
      text, 
      datetime: new Date().toISOString(),
      reminder: null
    };
    notes.push(newNote);
    localStorage.setItem('notes', JSON.stringify(notes));
    loadNotes();
    
    // Отправляем через WebSocket
    socket.emit('newTask', { id: newNote.id, text: text });
  }
  
  // Сохранение заметки с напоминанием
  function addReminder(text, reminderTimestamp) {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    const newNote = { 
      id: Date.now(), 
      text, 
      datetime: new Date().toISOString(),
      reminder: reminderTimestamp
    };
    notes.push(newNote);
    localStorage.setItem('notes', JSON.stringify(notes));
    loadNotes();
    
    // Отправляем на сервер для планирования push
    socket.emit('newReminder', {
      id: newNote.id,
      text: text,
      reminderTime: reminderTimestamp
    });
  }
  
  // Обычная форма
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (text) {
        addNote(text);
        input.value = '';
      }
    });
  }
  
  // Форма с напоминанием
  if (reminderForm) {
    reminderForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = reminderText.value.trim();
      const timeValue = reminderTime.value;
      
      if (text && timeValue) {
        const timestamp = new Date(timeValue).getTime();
        if (timestamp > Date.now()) {
          addReminder(text, timestamp);
          reminderText.value = '';
          reminderTime.value = '';
        } else {
          alert('⚠️ Время напоминания должно быть в будущем');
        }
      }
    });
  }
  
  // WebSocket: получение новой задачи от другого клиента
  socket.on('taskAdded', (task) => {
    showToast(`📝 Новая заметка: ${task.text}`);
    loadNotes();
  });
  
  loadNotes();
}

// ==================== Push-уведомления ====================
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('Push-уведомления не поддерживаются');
    return;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array('BGqR6RzQ9XpL5wY8vN3mJ7kL2pO9iU4yT1eA5sD7fG8hJ9kL0zX1cV2bN3mM4')
    });
    
    await fetch('/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });
    
    console.log('✅ Подписка на push отправлена');
    return true;
  } catch (err) {
    console.error('❌ Ошибка подписки:', err);
    return false;
  }
}

async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  
  if (subscription) {
    await fetch('/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint })
    });
    await subscription.unsubscribe();
    console.log('🔕 Отписка выполнена');
  }
}

// ==================== Вспомогательные функции ====================
function escapeHtml(str) {
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ==================== Регистрация Service Worker ====================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ Service Worker зарегистрирован:', registration.scope);
      
      // Настройка кнопок push
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        enablePushBtn.style.display = 'none';
        disablePushBtn.style.display = 'inline-block';
      } else {
        enablePushBtn.style.display = 'inline-block';
        disablePushBtn.style.display = 'none';
      }
      
      enablePushBtn.addEventListener('click', async () => {
        if (Notification.permission === 'denied') {
          alert('⚠️ Уведомления запрещены. Разрешите их в настройках браузера.');
          return;
        }
        
        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            alert('⚠️ Необходимо разрешить уведомления');
            return;
          }
        }
        
        const success = await subscribeToPush();
        if (success) {
          enablePushBtn.style.display = 'none';
          disablePushBtn.style.display = 'inline-block';
          showToast('🔔 Уведомления включены');
        }
      });
      
      disablePushBtn.addEventListener('click', async () => {
        await unsubscribeFromPush();
        disablePushBtn.style.display = 'none';
        enablePushBtn.style.display = 'inline-block';
        showToast('🔕 Уведомления отключены');
      });
      
    } catch (err) {
      console.error('❌ Ошибка регистрации SW:', err);
    }
  });
}

// ==================== Загрузка начальной страницы ====================
loadContent('home');