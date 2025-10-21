// --- ИМПОРТ И ИНИЦИАЛИЗАЦИЯ ---
import firebaseConfig from './firebase-config.js';

const { 
    initializeApp, 
    getAuth, getFirestore,
    onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword,
    doc, getDoc, setDoc, collection, getDocs, addDoc, deleteDoc, updateDoc
} = window.firebase;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const logoutButton = document.getElementById('logout-button');
const contentArea = document.getElementById('content-area');
const userInfoSpan = document.getElementById('user-info');

let currentUser = null;
let usersCache = [];
let coursesCache = [];

// --- THEME TOGGLE ---
const themeToggle = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeIcon();

themeToggle?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon();
});

function updateThemeIcon() {
    const theme = document.documentElement.getAttribute('data-theme');
    if (themeToggle) {
        themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
}

// --- NOTIFICATIONS ---
const notifBtn = document.getElementById('notifications-btn');
const notifPanel = document.getElementById('notifications-panel');

notifBtn?.addEventListener('click', () => {
    notifPanel.style.display = notifPanel.style.display === 'none' ? 'block' : 'none';
});

document.querySelector('.close-notif')?.addEventListener('click', () => {
    notifPanel.style.display = 'none';
});

// Close panel when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('#notifications-btn') && !e.target.closest('#notifications-panel')) {
        if (notifPanel) notifPanel.style.display = 'none';
    }
});

// --- ГЛАВНАЯ ЛОГИКА (АУТЕНТИФИКАЦИЯ) ---
onAuthStateChanged(auth, async user => {
    if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            currentUser = { uid: user.uid, email: user.email, ...userDocSnap.data() };
            console.log("✅ Пользователь вошел:", currentUser);
            showAppUI();
            renderContentByRole();
        } else {
            console.error("❌ Нет данных для пользователя в Firestore.");
            signOut(auth);
        }
    } else {
        currentUser = null;
        console.log("👋 Пользователь вышел.");
        showLoginUI();
    }
});

// --- ЛОГИКА ВХОДА И ВЫХОДА ---
loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    const errorEl = document.getElementById('login-error');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    errorEl.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Вход...';
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error('Ошибка входа:', error);
        errorEl.textContent = 'Неверный email или пароль.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Войти';
    }
});

logoutButton.addEventListener('click', () => {
    if (confirm('Вы уверены, что хотите выйти?')) {
        signOut(auth);
    }
});

// --- ФУНКЦИИ ОТОБРАЖЕНИЯ ИНТЕРФЕЙСА ---
function showLoginUI() {
    loginContainer.style.display = 'flex';
    appContainer.style.display = 'none';
}

function showAppUI() {
    userInfoSpan.textContent = `${currentUser.name} (${currentUser.role})`;
    loginContainer.style.display = 'none';
    appContainer.style.display = 'flex';
}

function renderContentByRole() {
    contentArea.innerHTML = '';
    switch (currentUser.role) {
        case 'admin':
            renderAdminDashboard();
            break;
        case 'mentor':
            renderMentorDashboard();
            break;
        case 'intern':
            renderInternDashboard();
            break;
        default:
            contentArea.innerHTML = `<h1>⚠️ Неизвестная роль</h1>`;
    }
}

// --- 👑 СЕКЦИЯ АДМИНИСТРАТОРА ---
async function renderAdminDashboard() {
    const template = document.getElementById('admin-panel-template');
    contentArea.appendChild(template.content.cloneNode(true));
    
    // Обновляем статистику
    await updateAdminStats();
    
    // Переключение вкладок
    contentArea.querySelector('.tabs').addEventListener('click', e => {
        if (e.target.classList.contains('tab-button')) {
            contentArea.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            const tab = e.target.dataset.tab;
            
            switch(tab) {
                case 'users': renderUsersTab(); break;
                case 'courses': renderCoursesTab(); break;
                case 'analytics': renderAnalyticsTab(); break;
                case 'settings': renderSettingsTab(); break;
            }
        }
    });
    
    renderUsersTab();
}

async function updateAdminStats() {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const coursesSnapshot = await getDocs(collection(db, 'courses'));
        
        document.getElementById('stat-users').textContent = usersSnapshot.size;
        document.getElementById('stat-courses').textContent = coursesSnapshot.size;
        document.getElementById('stat-progress').textContent = '78%'; // TODO: Реальный расчет
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

async function renderUsersTab() {
    const adminContent = contentArea.querySelector('#admin-content');
    adminContent.innerHTML = `
        <div class="controls">
            <button id="add-user-btn" class="btn btn-add">➕ Добавить пользователя</button>
            <input type="text" id="search-users" placeholder="🔍 Поиск..." 
                   style="padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); 
                   background: var(--background-color); color: var(--text-color); margin-left: 16px; width: 300px;">
        </div>
        <table class="content-table">
            <thead>
                <tr>
                    <th>Имя</th>
                    <th>Email</th>
                    <th>Роль</th>
                    <th>Статус</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody id="users-table-body">
                <tr><td colspan="5" style="text-align: center;">Загрузка...</td></tr>
            </tbody>
        </table>
        ${getModalHtml('user-modal', 'Новый пользователь')}
    `;

    const usersTableBody = adminContent.querySelector('#users-table-body');
    
    try {
        const usersCollection = collection(db, 'users');
        const userSnapshot = await getDocs(usersCollection);
        usersCache = userSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        renderUsersTable(usersCache);
        
        // Поиск пользователей
        document.getElementById('search-users').addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = usersCache.filter(u => 
                u.name.toLowerCase().includes(query) || 
                u.email.toLowerCase().includes(query)
            );
            renderUsersTable(filtered);
        });
        
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        usersTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--error-color);">Ошибка загрузки данных</td></tr>';
    }

    adminContent.querySelector('#add-user-btn').addEventListener('click', showAddUserModal);
}

function renderUsersTable(users) {
    const usersTableBody = document.querySelector('#users-table-body');
    
    if (users.length === 0) {
        usersTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Пользователи не найдены</td></tr>';
        return;
    }
    
    usersTableBody.innerHTML = users.map(user => `
        <tr>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td><span class="role-badge">${getRoleText(user.role)}</span></td>
            <td><span class="status-badge ${user.blocked ? 'blocked' : 'active'}">${user.blocked ? 'Заблокирован' : 'Активен'}</span></td>
            <td>
                <button class="btn-small" onclick="editUser('${user.id}')">✏️ Редактировать</button>
                <button class="btn-small ${user.blocked ? '' : 'btn-danger'}" onclick="toggleBlockUser('${user.id}', ${!user.blocked})">
                    ${user.blocked ? '🔓 Разблокировать' : '🔒 Блокировать'}
                </button>
                <button class="btn-small btn-danger" onclick="deleteUser('${user.id}')">🗑️ Удалить</button>
            </td>
        </tr>
    `).join('');
}

function getRoleText(role) {
    const roles = {
        admin: '👑 Администратор',
        mentor: '🧑‍🏫 Наставник',
        intern: '🧑‍💻 Стажёр'
    };
    return roles[role] || role;
}

function renderCoursesTab() {
    const adminContent = contentArea.querySelector('#admin-content');
    adminContent.innerHTML = `
        <div class="controls">
            <button id="add-course-btn" class="btn btn-add">➕ Создать курс</button>
        </div>
        <div class="courses-grid" id="courses-grid">
            <div class="course-card">
                <div class="course-header">
                    <div class="course-icon">💻</div>
                    <span class="course-badge">Активен</span>
                </div>
                <h3>JavaScript Basics</h3>
                <p class="course-desc">Основы программирования на JavaScript</p>
                <div class="course-stats">
                    <span>👥 8 студентов</span>
                    <span>📚 12 уроков</span>
                </div>
                <button class="btn btn-small">Управлять курсом</button>
            </div>
            <div class="course-card">
                <div class="course-header">
                    <div class="course-icon">🎨</div>
                    <span class="course-badge">Активен</span>
                </div>
                <h3>UI/UX Design</h3>
                <p class="course-desc">Основы дизайна интерфейсов</p>
                <div class="course-stats">
                    <span>👥 4 студента</span>
                    <span>📚 8 уроков</span>
                </div>
                <button class="btn btn-small">Управлять курсом</button>
            </div>
        </div>
    `;
}

function renderAnalyticsTab() {
    const adminContent = contentArea.querySelector('#admin-content');
    adminContent.innerHTML = `
        <h2>📊 Аналитика платформы</h2>
        <div class="analytics-container">
            <div class="stat-card">
                <h3>Общая статистика</h3>
                <p>Средний прогресс обучения: <strong>78%</strong></p>
                <p>Курсы завершены: <strong>45/60</strong></p>
                <p>Активных стажёров: <strong>12</strong></p>
            </div>
            <div class="stat-card">
                <h3>Топ курсов</h3>
                <ol style="margin: 0; padding-left: 20px; color: var(--text-light);">
                    <li>JavaScript Basics (8 студентов)</li>
                    <li>UI/UX Design (4 студента)</li>
                    <li>Git & GitHub (6 студентов)</li>
                </ol>
            </div>
        </div>
        <button class="btn" style="margin-top: 20px; width: auto;">📥 Экспортировать отчет (PDF)</button>
    `;
}

function renderSettingsTab() {
    const adminContent = contentArea.querySelector('#admin-content');
    adminContent.innerHTML = `
        <h2>⚙️ Настройки системы</h2>
        <div class="settings-section">
            <h3>🎨 Внешний вид</h3>
            <div class="input-group">
                <label>Логотип платформы</label>
                <input type="text" placeholder="🎓" style="width: 100px;">
            </div>
            <div class="input-group">
                <label>Название платформы</label>
                <input type="text" value="Платформа Обучения">
            </div>
        </div>
        <div class="settings-section" style="margin-top: 24px;">
            <h3>📢 Уведомления</h3>
            <button class="btn" style="width: auto;">Отправить уведомление всем пользователям</button>
        </div>
        <button class="btn btn-add" style="margin-top: 24px; width: auto;">💾 Сохранить настройки</button>
    `;
}

function showAddUserModal() {
    const modal = contentArea.querySelector('#user-modal');
    const modalContent = modal.querySelector('.modal-body');
    modalContent.innerHTML = `
        <form id="add-user-form">
            <div class="input-group">
                <label for="new-name">Имя *</label>
                <input type="text" id="new-name" required placeholder="Иван Иванов">
            </div>
            <div class="input-group">
                <label for="new-email">Email *</label>
                <input type="email" id="new-email" required placeholder="ivan@company.com">
            </div>
            <div class="input-group">
                <label for="new-password">Пароль *</label>
                <input type="password" id="new-password" required minlength="6" placeholder="Минимум 6 символов">
            </div>
            <div class="input-group">
                <label for="new-role">Роль *</label>
                <select id="new-role">
                    <option value="intern">🧑‍💻 Стажёр</option>
                    <option value="mentor">🧑‍🏫 Наставник</option>
                    <option value="admin">👑 Администратор</option>
                </select>
            </div>
            <button type="submit" class="btn">Создать пользователя</button>
        </form>
    `;
    modal.style.display = 'flex';

    modal.querySelector('.close-button').onclick = () => modal.style.display = 'none';
    modal.querySelector('#add-user-form').addEventListener('submit', handleCreateUser);
}

async function handleCreateUser(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Создание...';
    
    // TODO: Это нужно перенести в Cloud Functions
    alert('⚠️ Создание пользователя через клиентский код отключено в Firebase из-за безопасности.\n\nДля production нужно:\n1. Создать Cloud Function для регистрации\n2. Или создавать пользователей через Firebase Console\n\nПока данные сохраняются только в Firestore.');
    
    const name = document.getElementById('new-name').value;
    const email = document.getElementById('new-email').value;
    const role = document.getElementById('new-role').value;
    
    try {
        // Временно сохраняем только в Firestore (без аутентификации)
        await setDoc(doc(db, 'users', 'temp_' + Date.now()), {
            name,
            email,
            role,
            blocked: false,
            createdAt: new Date().toISOString()
        });
        
        alert('✅ Данные пользователя сохранены в Firestore');
        document.querySelector('#user-modal').style.display = 'none';
        renderUsersTab();
    } catch (error) {
        console.error('Ошибка:', error);
        alert('❌ Ошибка: ' + error.message);
    }
    
    submitBtn.disabled = false;
    submitBtn.textContent = 'Создать пользователя';
}

// Глобальные функции для кнопок
window.editUser = (id) => {
    alert('Редактирование пользователя: ' + id);
};

window.toggleBlockUser = async (id, block) => {
    if (confirm(`Вы уверены, что хотите ${block ? 'заблокировать' : 'разблокировать'} этого пользователя?`)) {
        try {
            await updateDoc(doc(db, 'users', id), { blocked: block });
            alert(`✅ Пользователь ${block ? 'заблокирован' : 'разблокирован'}`);
            renderUsersTab();
        } catch (error) {
            alert('❌ Ошибка: ' + error.message);
        }
    }
};

window.deleteUser = async (id) => {
    if (confirm('⚠️ Вы уверены, что хотите удалить этого пользователя? Это действие необратимо!')) {
        try {
            await deleteDoc(doc(db, 'users', id));
            alert('✅ Пользователь удален');
            renderUsersTab();
        } catch (error) {
            alert('❌ Ошибка: ' + error.message);
        }
    }
};

// --- 🧑‍🏫 СЕКЦИЯ НАСТАВНИКА ---
function renderMentorDashboard() {
    const template = document.getElementById('mentor-panel-template');
    contentArea.appendChild(template.content.cloneNode(true));
    
    // Переключение вкладок наставника
    contentArea.querySelector('.tabs')?.addEventListener('click', e => {
        if (e.target.classList.contains('tab-button')) {
            contentArea.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            const tab = e.target.dataset.tab;
            
            const mentorContent = document.getElementById('mentor-content');
            if (tab === 'my-courses') {
                mentorContent.innerHTML = template.content.querySelector('#mentor-content').innerHTML;
            } else if (tab === 'students') {
                renderMentorStudents();
            } else if (tab === 'check-tasks') {
                renderCheckTasks();
            }
        }
    });
}

function renderMentorStudents() {
    const mentorContent = document.getElementById('mentor-content');
    mentorContent.innerHTML = `
        <h2>👥 Мои студенты</h2>
        <table class="content-table">
            <thead>
                <tr><th>Студент</th><th>Курс</th><th>Прогресс</th><th>Действия</th></tr>
            </thead>
            <tbody>
                <tr>
                    <td>Алексей Петров</td>
                    <td>JavaScript Basics</td>
                    <td><div class="progress-bar"><div class="progress-fill" style="width: 65%"></div></div> 65%</td>
                    <td><button class="btn-small">Просмотр</button></td>
                </tr>
                <tr>
                    <td>Мария Сидорова</td>
                    <td>UI/UX Design</td>
                    <td><div class="progress-bar"><div class="progress-fill" style="width: 90%"></div></div> 90%</td>
                    <td><button class="btn-small">Просмотр</button></td>
                </tr>
            </tbody>
        </table>
    `;
}

function renderCheckTasks() {
    const mentorContent = document.getElementById('mentor-content');
    mentorContent.innerHTML = `
        <h2>📝 Задания на проверке</h2>
        <div class="tasks-list">
            <div class="task-card">
                <h3>Задание: Создать калькулятор</h3>
                <p><strong>Студент:</strong> Алексей Петров</p>
                <p><strong>Курс:</strong> JavaScript Basics</p>
                <p><strong>Сдано:</strong> 2 часа назад</p>
                <button class="btn btn-small">Проверить</button>
            </div>
        </div>
    `;
}

// --- 🧑‍💻 СЕКЦИЯ СТАЖЁРА ---
function renderInternDashboard() {
    const template = document.getElementById('intern-panel-template');
    contentArea.appendChild(template.content.cloneNode(true));
    
    // Переключение вкладок стажёра
    contentArea.querySelector('.tabs')?.addEventListener('click', e => {
        if (e.target.classList.contains('tab-button')) {
            contentArea.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            const tab = e.target.dataset.tab;
            
            const internContent = document.getElementById('intern-content');
            if (tab === 'courses') {
                internContent.innerHTML = template.content.querySelector('#intern-content').innerHTML;
            } else if (tab === 'achievements') {
                renderAchievements();
            } else if (tab === 'history') {
                renderHistory();
            }
        }
    });
}

function renderAchievements() {
    const internContent = document.getElementById('intern-content');
    internContent.innerHTML = `
        <h2>🏆 Мои достижения</h2>
        <div class="achievements-grid">
            <div class="achievement-card earned">
                <div class="achievement-icon">🎯</div>
                <h3>Первый курс</h3>
                <p>Завершите первый курс</p>
            </div>
            <div class="achievement-card earned">
                <div class="achievement-icon">⭐</div>
                <h3>Отличник</h3>
                <p>Получите 90+ баллов</p>
            </div>
            <div class="achievement-card">
                <div class="achievement-icon locked">🔒</div>
                <h3>Марафонец</h3>
                <p>Завершите 5 курсов</p>
            </div>
        </div>
    `;
}

function renderHistory() {
    const internContent = document.getElementById('intern-content');
    internContent.innerHTML = `
        <h2>📜 История обучения</h2>
        <div class="history-timeline">
            <div class="history-item">
                <div class="history-date">Сегодня</div>
                <div class="history-content">
                    <h3>Урок завершён: "Переменные в JS"</h3>
                    <p>JavaScript Basics</p>
                </div>
            </div>
            <div class="history-item">
                <div class="history-date">Вчера</div>
                <div class="history-content">
                    <h3>Тест пройден: "HTML Основы"</h3>
                    <p>Результат: 95/100 ⭐</p>
                </div>
            </div>
        </div>
    `;
}

// --- ХЕЛПЕРЫ ---
function getModalHtml(id, title) {
    return `
    <div id="${id}" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>${title}</h2>
                <span class="close-button">&times;</span>
            </div>
            <div class="modal-body"></div>
        </div>
    </div>
    `;
}

console.log('🚀 Платформа обучения загружена');
