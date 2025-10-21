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

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И ССЫЛКИ НА ЭЛЕМЕНТЫ ---
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const logoutButton = document.getElementById('logout-button');
const contentArea = document.getElementById('content-area');
const userInfoSpan = document.getElementById('user-info');

let currentUser = null; // Храним информацию о текущем пользователе
let usersCache = []; // Кэш пользователей для админки

// --- ГЛАВНАЯ ЛОГИКА (СЛУШАТЕЛЬ АУТЕНТИФИКАЦИИ) ---
onAuthStateChanged(auth, async user => {
    if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            currentUser = { uid: user.uid, email: user.email, ...userDocSnap.data() };
            console.log("Пользователь вошел:", currentUser);
            showAppUI();
            renderContentByRole();
        } else {
            console.error("Нет данных для пользователя в Firestore.");
            signOut(auth);
        }
    } else {
        currentUser = null;
        console.log("Пользователь вышел.");
        showLoginUI();
    }
});

// --- ЛОГИКА ВХОДА И ВЫХОДА ---
loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        errorEl.textContent = 'Неверный email или пароль.';
    }
});

logoutButton.addEventListener('click', () => signOut(auth));

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
            contentArea.innerHTML = `<h1>Неизвестная роль</h1>`;
    }
}

// --- 👑 СЕКЦИЯ АДМИНИСТРАТОРА ---
function renderAdminDashboard() {
    const template = document.getElementById('admin-panel-template');
    contentArea.appendChild(template.content.cloneNode(true));
    
    // Переключение вкладок
    contentArea.querySelector('.tabs').addEventListener('click', e => {
        if (e.target.classList.contains('tab-button')) {
            contentArea.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            const tab = e.target.dataset.tab;
            if (tab === 'users') renderUsersTab();
            if (tab === 'courses') renderCoursesTab();
        }
    });
    renderUsersTab(); // По умолчанию открываем вкладку пользователей
}

async function renderUsersTab() {
    const adminContent = contentArea.querySelector('#admin-content');
    adminContent.innerHTML = `
        <div class="controls">
            <button id="add-user-btn" class="btn btn-add">Добавить пользователя</button>
        </div>
        <table class="content-table">
            <thead><tr><th>Имя</th><th>Email</th><th>Роль</th><th>Действия</th></tr></thead>
            <tbody id="users-table-body"><tr><td colspan="4">Загрузка...</td></tr></tbody>
        </table>
        ${getModalHtml('user-modal', 'Новый пользователь')}
    `;

    const usersTableBody = adminContent.querySelector('#users-table-body');
    const usersCollection = collection(db, 'users');
    const userSnapshot = await getDocs(usersCollection);
    usersCache = userSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    usersTableBody.innerHTML = usersCache.map(user => `
        <tr>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td>
                <button class="btn-small btn-danger" data-id="${user.id}">Удалить</button>
            </td>
        </tr>
    `).join('');

    // Обработчики событий
    adminContent.querySelector('#add-user-btn').addEventListener('click', showAddUserModal);
}

function renderCoursesTab() {
    contentArea.querySelector('#admin-content').innerHTML = `<h2>Управление курсами (в разработке)</h2>`;
}

function showAddUserModal() {
    const modal = contentArea.querySelector('#user-modal');
    const modalContent = modal.querySelector('.modal-body');
    modalContent.innerHTML = `
        <form id="add-user-form">
            <div class="input-group">
                <label for="new-name">Имя</label>
                <input type="text" id="new-name" required>
            </div>
            <div class="input-group">
                <label for="new-email">Email</label>
                <input type="email" id="new-email" required>
            </div>
            <div class="input-group">
                <label for="new-password">Пароль</label>
                <input type="password" id="new-password" required>
            </div>
            <div class="input-group">
                <label for="new-role">Роль</label>
                <select id="new-role">
                    <option value="intern">Стажёр</option>
                    <option value="mentor">Наставник</option>
                </select>
            </div>
            <button type="submit" class="btn">Создать</button>
        </form>
    `;
    modal.style.display = 'flex';

    modal.querySelector('.close-button').onclick = () => modal.style.display = 'none';
    modal.querySelector('#add-user-form').addEventListener('submit', handleCreateUser);
}

async function handleCreateUser(e) {
    e.preventDefault();
    alert('Создание пользователя через клиентский код отключено в Firebase по умолчанию из-за безопасности. Эту логику нужно перенести в Cloud Functions. Пока что добавляйте пользователей через консоль Firebase.');
    // TODO: Implement user creation via Cloud Functions
}

// --- 🧑‍🏫 СЕКЦИЯ НАСТАВНИКА ---
function renderMentorDashboard() {
    const template = document.getElementById('mentor-panel-template');
    contentArea.appendChild(template.content.cloneNode(true));
}

// --- 🧑‍💻 СЕКЦИЯ СТАЖЁРА ---
function renderInternDashboard() {
    const template = document.getElementById('intern-panel-template');
    contentArea.appendChild(template.content.cloneNode(true));
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
