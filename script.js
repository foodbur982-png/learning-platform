// Импортируем нашу секретную конфигурацию из отдельного файла
import firebaseConfig from './firebase-config.js';

// Получаем функции Firebase, которые мы ранее "прикрепили" к window
const { initializeApp, getAuth, getFirestore, getStorage } = window.firebase;

try {
  // Инициализируем приложение Firebase с нашей конфигурацией
  const app = initializeApp(firebaseConfig);

  // Получаем доступ к сервисам: Аутентификация, База данных Firestore, Хранилище файлов
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);

  // Выводим в консоль, чтобы убедиться, что все работает
  console.log("Firebase успешно инициализирован!");
  console.log("Auth-сервис готов:", auth);
  console.log("Firestore-сервис готов:", db);

} catch (error) {
  // Если что-то пошло не так, выводим ошибку в консоль
  console.error("Ошибка инициализации Firebase:", error);
}