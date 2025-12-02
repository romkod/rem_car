// Змінна для відстеження режиму редагування
let editMode = false;

// Налаштування теми
let currentTheme = localStorage.getItem('selectedTheme') || 'light';

// SHA-256 хеш пароля "vasil"
let PASSWORD_HASH = "";
// SHA-256 хеш пароля "petro" для видалення автомобілів
let DELETE_PASSWORD_HASH = "";

// Firebase ініціалізація
let firebaseInitialized = false;
let database = null;
let carsRef = null;
let isSyncingCars = false; // Прапорець для запобігання циклічним оновленням

// Список автомобілів
let cars = [];

// Отримання конфігурації Firebase
function getFirebaseConfig() {
    const savedConfig = localStorage.getItem('firebaseConfig');
    if (savedConfig) {
        try {
            const config = JSON.parse(savedConfig);
            if (config.apiKey && config.databaseURL && config.projectId) {
                return config;
            }
        } catch (e) {
            console.warn('Помилка завантаження конфігурації Firebase:', e);
        }
    }
    
    return {
        apiKey: "AIzaSyCNZ3vvBe_WHG4VuvpjQJttcN_y3aRnHKg",
        authDomain: "remcar-a23dc.firebaseapp.com",
        databaseURL: "https://remcar-a23dc-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "remcar-a23dc",
        storageBucket: "remcar-a23dc.firebasestorage.app",
        messagingSenderId: "501067679866",
        appId: "1:501067679866:web:007744a897f8d83275d3c3",
        measurementId: "G-22BSZF8J10"
    };
}

// Ініціалізація Firebase
function initFirebase() {
    console.log('🔧 Початок ініціалізації Firebase...');
    
    // Перевірити, чи Firebase SDK завантажено
    if (typeof firebase === 'undefined') {
        console.error('❌ Firebase SDK не завантажено!');
        console.error('Перевірте, чи підключені скрипти Firebase в HTML:');
        console.error('  <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>');
        console.error('  <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js"></script>');
        return false;
    }
    
    console.log('✅ Firebase SDK завантажено');
    
    const config = getFirebaseConfig();
    console.log('📋 Конфігурація Firebase:', {
        projectId: config.projectId,
        databaseURL: config.databaseURL,
        authDomain: config.authDomain
    });
    
    try {
        // Перевірити, чи Firebase вже ініціалізовано
        if (firebase.apps && firebase.apps.length > 0) {
            console.log('ℹ️ Firebase вже ініціалізовано, використовую існуючий екземпляр');
            database = firebase.database();
            firebaseInitialized = true;
            console.log('✅ Database отримано');
            setupFirebaseListener();
            return true;
        }
        
        // Ініціалізувати Firebase
        console.log('🚀 Ініціалізація Firebase...');
        firebase.initializeApp(config);
        database = firebase.database();
        firebaseInitialized = true;
        console.log('✅ Firebase ініціалізовано успішно!');
        console.log('✅ Database підключено:', database.app.options.databaseURL);
        
        // Налаштувати слухача
        setupFirebaseListener();
        return true;
    } catch (error) {
        console.error('❌ Помилка ініціалізації Firebase:', error);
        console.error('Деталі помилки:', error.message, error.code);
        firebaseInitialized = false;
        return false;
    }
}

// Налаштування слухача Firebase
function setupFirebaseListener() {
    if (!firebaseInitialized) {
        console.warn('⚠️ Firebase не ініціалізовано, не можу налаштувати слухача');
        return;
    }
    
    if (!database) {
        console.warn('⚠️ Database не встановлено, не можу налаштувати слухача');
        return;
    }
    
    try {
        carsRef = database.ref('cars');
        console.log('🔧 Налаштування слухача Firebase для списку автомобілів');
        console.log('📍 Шлях до даних: /cars');
        
        carsRef.on('value', (snapshot) => {
            if (isSyncingCars) {
                console.log('⏸️ Слухач Firebase: пропускаємо оновлення, бо isSyncingCars = true');
                return; // Якщо ми самі зберігаємо, не оновлювати
            }
            
            const data = snapshot.val();
            console.log('📥 Отримано дані з Firebase:', data);
            
            if (data) {
                const loadedCars = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
                
                console.log('📋 Завантажені автомобілі:', loadedCars);
                
                // Порівняти з поточними даними, щоб уникнути непотрібних оновлень
                const currentCarsStr = JSON.stringify(cars.sort((a, b) => a.id.localeCompare(b.id)));
                const loadedCarsStr = JSON.stringify(loadedCars.sort((a, b) => a.id.localeCompare(b.id)));
                
                if (currentCarsStr !== loadedCarsStr) {
                    console.log('🔄 Дані списку автомобілів змінилися, оновлюємо...');
                    
                    // Перевірити, чи нові дані містять більше авто (не втрачаємо локальні зміни)
                    const localCarsIds = new Set(cars.map(c => c.id));
                    const loadedCarsIds = new Set(loadedCars.map(c => c.id));
                    
                    // Якщо локально є авто, яких немає в завантажених, зберегти їх
                    const missingCars = cars.filter(c => !loadedCarsIds.has(c.id));
                    if (missingCars.length > 0) {
                        console.log('⚠️ Знайдено локальні авто, яких немає в Firebase, зберігаємо їх:', missingCars);
                        // Додати відсутні авто до завантажених
                        loadedCars.push(...missingCars);
                        // Зберегти оновлені дані назад в Firebase
                        const carsObj = {};
                        loadedCars.forEach(car => {
                            carsObj[car.id] = { brand: car.brand, model: car.model };
                        });
                        // Зберегти без виклику слухача (встановити isSyncingCars)
                        isSyncingCars = true;
                        carsRef.set(carsObj).then(() => {
                            console.log('✅ Локальні авто збережено в Firebase');
                            setTimeout(() => { isSyncingCars = false; }, 2000);
                        }).catch(err => {
                            console.error('❌ Помилка збереження локальних авто:', err);
                            isSyncingCars = false;
                        });
                    }
                    
                    isSyncingCars = true;
                    cars = loadedCars;
                    
                    // Зберегти в localStorage
                    localStorage.setItem('repairCalculatorCars', JSON.stringify(cars));
                    renderCars();
                    
                    // Зняти прапорець через затримку
                    setTimeout(() => {
                        isSyncingCars = false;
                        console.log('✅ Синхронізацію списку автомобілів завершено, isSyncingCars = false');
                    }, 2000);
                } else {
                    console.log('✓ Дані списку автомобілів не змінилися, пропускаємо оновлення');
                }
            } else {
                // Якщо в Firebase немає даних, завантажити з localStorage
                const localData = localStorage.getItem('repairCalculatorCars');
                if (localData) {
                    try {
                        const localCars = JSON.parse(localData);
                        if (localCars.length > 0) {
                            isSyncingCars = true;
                            cars = localCars;
                            // Зберегти в Firebase для синхронізації
                            const carsObj = {};
                            cars.forEach(car => {
                                carsObj[car.id] = { brand: car.brand, model: car.model };
                            });
                            carsRef.set(carsObj).then(() => {
                                console.log('Дані з localStorage збережено в Firebase');
                                setTimeout(() => { isSyncingCars = false; }, 1000);
                            });
                        }
                    } catch (e) {
                        console.error('Помилка завантаження з localStorage:', e);
                    }
                } else {
                    cars = [];
                }
                renderCars();
            }
        }, (error) => {
            console.error('Помилка слухача Firebase:', error);
            loadCars();
            renderCars();
        });
    } catch (error) {
        console.error('Помилка налаштування слухача Firebase:', error);
        loadCars();
        renderCars();
    }
}

// Завантаження списку авто
function loadCars() {
    const saved = localStorage.getItem('repairCalculatorCars');
    if (saved) {
        try {
            cars = JSON.parse(saved);
            return;
        } catch (e) {
            console.error('Помилка завантаження списку авто:', e);
        }
    }
    
    // Дефолтні авто
    cars = [
        { id: 'default', brand: 'Tesla', model: 'Model 3' },
        { id: 'tesla-model-s', brand: 'Tesla', model: 'Model S' },
        { id: 'tesla-model-x', brand: 'Tesla', model: 'Model X' }
    ];
}

// Змінна для відстеження черги збереження
let saveCarsPromise = null;

// Збереження списку авто
async function saveCars() {
    console.log('🔄 saveCars() викликано, кількість автомобілів:', cars.length);
    
    // Зберегти в localStorage одразу
    localStorage.setItem('repairCalculatorCars', JSON.stringify(cars));
    console.log('✅ Дані збережено в localStorage');
    
    // Якщо Firebase не налаштовано, вийти
    if (!firebaseInitialized) {
        console.warn('⚠️ Firebase не ініціалізовано, дані збережено тільки в localStorage');
        return;
    }
    
    if (!database) {
        console.warn('⚠️ Database не встановлено, дані збережено тільки в localStorage');
        return;
    }
    
    // Якщо вже виконується збереження, додати до черги
    if (saveCarsPromise) {
        console.log('⏸️ Вже виконується збереження, очікую завершення...');
        await saveCarsPromise;
        // Після завершення попереднього збереження, зберегти знову з актуальними даними
        return saveCars();
    }
    
    // Якщо вже синхронізуємо через слухача, не викликати знову
    if (isSyncingCars) {
        console.log('⏸️ Вже виконується синхронізація списку автомобілів, пропускаємо...');
        return;
    }
    
    // Якщо carsRef не встановлено, встановити його
    if (!carsRef) {
        carsRef = database.ref('cars');
        console.log('✅ carsRef встановлено: cars');
    }
    
    // Створити Promise для відстеження
    saveCarsPromise = (async () => {
        try {
            isSyncingCars = true;
            console.log('📤 Збереження списку автомобілів в Firebase...', cars);
            
            const carsObj = {};
            cars.forEach(car => {
                carsObj[car.id] = { brand: car.brand, model: car.model };
            });
            
            console.log('📦 Дані для збереження:', carsObj);
            await carsRef.set(carsObj);
            console.log('✅ Список автомобілів збережено в Firebase');
            
            // Зняти прапорець через затримку (збільшено до 2.5 секунд для надійності)
            setTimeout(() => {
                isSyncingCars = false;
                console.log('✅ Синхронізацію списку автомобілів завершено, isSyncingCars = false');
            }, 2500);
        } catch (error) {
            console.error('❌ Помилка збереження списку автомобілів в Firebase:', error);
            console.error('Деталі помилки:', error.message, error.stack);
            
            // Перевірити, чи це помилка правил безпеки
            if (error.code === 'PERMISSION_DENIED' || error.message.includes('permission') || error.message.includes('Permission')) {
                console.error('🚨 ПОМИЛКА: Немає дозволу на запис в Firebase!');
                console.error('🔧 РІШЕННЯ: Перевірте правила безпеки в Firebase Console:');
                console.error('   1. Відкрийте https://console.firebase.google.com/');
                console.error('   2. Виберіть проект remcar-a23dc');
                console.error('   3. Realtime Database → Rules');
                console.error('   4. Встановіть правила: { "rules": { "cars": { ".read": true, ".write": true } } }');
                console.error('   5. Натисніть "Publish"');
                alert('Помилка: Немає дозволу на запис в Firebase. Перевірте правила безпеки в Firebase Console. Деталі в консолі (F12).');
            }
            
            isSyncingCars = false;
            throw error; // Прокинути помилку далі
        } finally {
            // Очистити Promise після завершення
            saveCarsPromise = null;
        }
    })();
    
    return saveCarsPromise;
}

// Генерація ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Відображення списку авто
function renderCars() {
    const grid = document.getElementById('carsGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    cars.forEach(car => {
        const cardWrapper = document.createElement('div');
        cardWrapper.className = 'car-card-wrapper';
        cardWrapper.style.position = 'relative';
        
        const card = document.createElement('a');
        card.href = `calculator.html?car=${car.id}`;
        card.className = 'car-card';
        
        card.innerHTML = `
            <span class="car-icon">🚗</span>
            <h3>${car.brand} ${car.model}</h3>
            <p>Розрахувати вартість ремонту</p>
        `;
        
        // Кнопка видалення (показується тільки в режимі редагування)
        if (editMode) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-delete-car';
            deleteBtn.textContent = '×';
            deleteBtn.title = 'Видалити автомобіль';
            deleteBtn.style.position = 'absolute';
            deleteBtn.style.top = '8px';
            deleteBtn.style.right = '8px';
            deleteBtn.style.background = '#dc3545';
            deleteBtn.style.color = '#fff';
            deleteBtn.style.border = 'none';
            deleteBtn.style.borderRadius = '50%';
            deleteBtn.style.width = '28px';
            deleteBtn.style.height = '28px';
            deleteBtn.style.cursor = 'pointer';
            deleteBtn.style.fontSize = '18px';
            deleteBtn.style.display = 'flex';
            deleteBtn.style.alignItems = 'center';
            deleteBtn.style.justifyContent = 'center';
            deleteBtn.style.zIndex = '10';
            deleteBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                deleteCar(car.id);
            };
            cardWrapper.appendChild(deleteBtn);
        }
        
        cardWrapper.appendChild(card);
        grid.appendChild(cardWrapper);
    });
    
    // Оновити select для копіювання налаштувань
    updateCopyFromSelect();
}

// Оновити select для вибору авто для копіювання
function updateCopyFromSelect() {
    const copySelect = document.getElementById('copyFromCar');
    if (!copySelect) return;
    
    // Зберегти поточне значення
    const currentValue = copySelect.value;
    
    // Очистити та заповнити select
    copySelect.innerHTML = '<option value="">-- Не копіювати --</option>';
    
    cars.forEach(car => {
        const option = document.createElement('option');
        option.value = car.id;
        option.textContent = `${car.brand} ${car.model}`;
        copySelect.appendChild(option);
    });
    
    // Відновити значення, якщо воно все ще існує
    if (currentValue) {
        copySelect.value = currentValue;
    }
}

// Додавання нового авто
async function addCar(brand, model, copyFromCarId = null) {
    if (!brand || !model) {
        alert('Будь ласка, введіть марку та модель');
        return;
    }
    
    const newCar = {
        id: generateId(),
        brand: brand.trim(),
        model: model.trim()
    };
    
    cars.push(newCar);
    
    // Оновити UI одразу, щоб користувач бачив зміни
    renderCars();
    
    // Очистити форму
    document.getElementById('newCarBrand').value = '';
    document.getElementById('newCarModel').value = '';
    const copySelect = document.getElementById('copyFromCar');
    if (copySelect) {
        copySelect.value = '';
    }
    
    // Зберегти в Firebase (асинхронно) після оновлення UI
    try {
        await saveCars();
        console.log('✅ Автомобіль додано та збережено в Firebase');
        
        // Якщо вказано авто для копіювання налаштувань
        if (copyFromCarId) {
            copyCategoriesFromCar(copyFromCarId, newCar.id);
        }
    } catch (error) {
        console.error('❌ Помилка збереження автомобіля:', error);
        // Якщо помилка, видалити авто з масиву
        const index = cars.findIndex(car => car.id === newCar.id);
        if (index > -1) {
            cars.splice(index, 1);
            renderCars();
            alert('Помилка збереження автомобіля. Спробуйте ще раз.');
        }
    }
}

// Копіювання категорій з одного авто в інше
function copyCategoriesFromCar(sourceCarId, targetCarId) {
    // Завантажити категорії з джерела
    const sourceKey = `repairCalculatorCategories_${sourceCarId}`;
    const sourceData = localStorage.getItem(sourceKey);
    
    if (sourceData) {
        try {
            const categories = JSON.parse(sourceData);
            // Зберегти з новим ключем для нового авто
            const targetKey = `repairCalculatorCategories_${targetCarId}`;
            localStorage.setItem(targetKey, JSON.stringify(categories));
            
            // Також зберегти в Firebase, якщо він налаштований
            if (firebaseInitialized && database) {
                const sourceRef = database.ref(`cars/${sourceCarId}/categories`);
                const targetRef = database.ref(`cars/${targetCarId}/categories`);
                
                sourceRef.once('value', (snapshot) => {
                    const data = snapshot.val();
                    if (data) {
                        targetRef.set(data);
                        console.log('Налаштування скопійовано в Firebase');
                    }
                });
            }
            
            console.log('Налаштування скопійовано з', sourceCarId, 'в', targetCarId);
        } catch (e) {
            console.error('Помилка копіювання налаштувань:', e);
        }
    }
}

// Видалення автомобіля (з перевіркою пароля "petro")
async function deleteCar(carId) {
    const password = prompt('Для видалення автомобіля введіть сервісний пароль:');
    if (!password) {
        return; // Користувач скасував
    }
    
    const inputHash = await hashPassword(password);
    if (inputHash !== DELETE_PASSWORD_HASH) {
        alert('Невірний пароль. Видалення неможливе.');
        return;
    }
    
    if (confirm('Ви впевнені, що хочете видалити цей автомобіль? Всі дані про ремонт також будуть видалені.')) {
        // Видалити з масиву
        cars = cars.filter(car => car.id !== carId);
        
        // Зберегти в Firebase (асинхронно)
        saveCars().then(() => {
            console.log('Автомобіль видалено та збережено в Firebase');
        }).catch(error => {
            console.error('Помилка збереження після видалення:', error);
        });
        
        renderCars();
        
        // Видалити дані категорій з localStorage
        localStorage.removeItem(`repairCalculatorCategories_${carId}`);
        
        // Видалити з Firebase, якщо він налаштований
        if (firebaseInitialized && database) {
            try {
                const categoriesRef = database.ref(`cars/${carId}/categories`);
                await categoriesRef.remove();
                const carRef = database.ref(`cars/${carId}`);
                await carRef.remove();
                console.log('Автомобіль та дані видалено з Firebase');
            } catch (error) {
                console.error('Помилка видалення з Firebase:', error);
            }
        }
        
        alert('Автомобіль успішно видалено.');
    }
}

// Функція для хешування пароля
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Перевірка пароля
async function verifyPassword(inputPassword) {
    const inputHash = await hashPassword(inputPassword);
    return inputHash === PASSWORD_HASH;
}

// Показати модальне вікно пароля
function showPasswordModal() {
    const modal = document.getElementById('passwordModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('passwordInput').focus();
    }
}

// Приховати модальне вікно пароля
function hidePasswordModal() {
    const modal = document.getElementById('passwordModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('passwordInput').value = '';
        document.getElementById('passwordError').style.display = 'none';
    }
}

// Обробка введення пароля
async function handlePasswordSubmit() {
    const passwordInput = document.getElementById('passwordInput');
    const passwordError = document.getElementById('passwordError');
    
    if (!passwordInput) return;
    
    const password = passwordInput.value;
    
    if (await verifyPassword(password)) {
        enableEditMode();
        hidePasswordModal();
    } else {
        passwordError.textContent = 'Невірний пароль';
        passwordError.style.display = 'block';
        passwordInput.value = '';
    }
}

// Увімкнути режим редагування
function enableEditMode() {
    editMode = true;
    const btn = document.getElementById('btnEditMode');
    if (btn) {
        btn.classList.add('active');
        btn.textContent = 'Режим редагування (активний)';
    }
    
    const form = document.getElementById('addCarForm');
    if (form) {
        form.style.display = 'block';
    }
    
    // Перерендерити список авто, щоб показати кнопки видалення
    renderCars();
}

// Вимкнути режим редагування
function disableEditMode() {
    editMode = false;
    const btn = document.getElementById('btnEditMode');
    if (btn) {
        btn.classList.remove('active');
        btn.textContent = 'Режим редагування';
    }
    
    const form = document.getElementById('addCarForm');
    if (form) {
        form.style.display = 'none';
    }
    
    // Перерендерити список авто, щоб приховати кнопки видалення
    renderCars();
}

// Перемикання режиму редагування
function toggleEditMode() {
    if (editMode) {
        disableEditMode();
    } else {
        showPasswordModal();
    }
}

// Застосування теми
function applyTheme(theme) {
    document.body.className = '';
    document.body.classList.add(`theme-${theme}`);
    currentTheme = theme;
    localStorage.setItem('selectedTheme', theme);
}

// Перемикання теми
function toggleTheme() {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
}

// Функція для тестування підключення Firebase
async function testFirebaseConnection() {
    console.log('🧪 Тестування підключення Firebase...');
    
    if (!firebaseInitialized || !database) {
        console.error('❌ Firebase не ініціалізовано');
        return false;
    }
    
    try {
        // Тест запису
        console.log('📤 Тест запису в /test/connection...');
        const testRef = database.ref('test/connection');
        await testRef.set({
            timestamp: Date.now(),
            test: true
        });
        console.log('✅ Запис успішний');
        
        // Тест читання
        console.log('📥 Тест читання з /test/connection...');
        const snapshot = await testRef.once('value');
        const data = snapshot.val();
        console.log('✅ Читання успішне:', data);
        
        // Тест запису в /cars
        console.log('📤 Тест запису в /cars/test...');
        const carsTestRef = database.ref('cars/test-connection');
        await carsTestRef.set({
            brand: 'Test',
            model: 'Test Model'
        });
        console.log('✅ Запис в /cars успішний');
        
        // Видалити тестові дані
        await carsTestRef.remove();
        await testRef.remove();
        console.log('✅ Тестові дані видалено');
        
        console.log('✅ Всі тести пройдені успішно!');
        return true;
    } catch (error) {
        console.error('❌ Помилка тестування:', error);
        if (error.code === 'PERMISSION_DENIED') {
            console.error('🚨 Проблема: Немає дозволу на запис/читання');
            console.error('🔧 Рішення: Перевірте правила безпеки в Firebase Console');
        }
        return false;
    }
}

// Ініціалізація
document.addEventListener('DOMContentLoaded', async () => {
    PASSWORD_HASH = await hashPassword('vasil');
    // Обчислити хеш для "petro" для видалення автомобілів
    DELETE_PASSWORD_HASH = await hashPassword('petro');
    
    // Застосувати тему
    applyTheme(currentTheme);
    
    // Ініціалізувати Firebase
    const firebaseInitResult = initFirebase();
    console.log('🔧 Результат ініціалізації Firebase:', firebaseInitResult);
    
    // Якщо Firebase ініціалізовано, протестувати підключення
    if (firebaseInitialized) {
        setTimeout(async () => {
            await testFirebaseConnection();
        }, 1000);
    }
    
    // Завантажити список авто
    if (!firebaseInitialized) {
        console.log('⚠️ Firebase не ініціалізовано, завантаження з localStorage');
        loadCars();
        renderCars();
    } else {
        console.log('✅ Firebase ініціалізовано, очікування даних з сервера...');
        // Дані будуть завантажені через слухача Firebase
        // Але якщо слухач не спрацює, завантажити з localStorage
        setTimeout(() => {
            if (cars.length === 0) {
                console.log('⚠️ Дані не завантажилися з Firebase, завантаження з localStorage');
                loadCars();
                renderCars();
            }
        }, 2000);
    }
    
    // Обробники подій
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }
    
    const btnEditMode = document.getElementById('btnEditMode');
    if (btnEditMode) {
        btnEditMode.addEventListener('click', toggleEditMode);
    }
    
    const btnAddCar = document.getElementById('btnAddCar');
    if (btnAddCar) {
        btnAddCar.addEventListener('click', () => {
            const brand = document.getElementById('newCarBrand').value.trim();
            const model = document.getElementById('newCarModel').value.trim();
            const copyFromCarId = document.getElementById('copyFromCar').value || null;
            addCar(brand, model, copyFromCarId);
        });
    }
    
    const btnPasswordSubmit = document.getElementById('btnPasswordSubmit');
    if (btnPasswordSubmit) {
        btnPasswordSubmit.addEventListener('click', handlePasswordSubmit);
    }
    
    const btnPasswordCancel = document.getElementById('btnPasswordCancel');
    if (btnPasswordCancel) {
        btnPasswordCancel.addEventListener('click', hidePasswordModal);
    }
    
    const passwordInput = document.getElementById('passwordInput');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handlePasswordSubmit();
            }
        });
    }
    
    const passwordModal = document.getElementById('passwordModal');
    if (passwordModal) {
        passwordModal.addEventListener('click', (e) => {
            if (e.target.id === 'passwordModal') {
                hidePasswordModal();
            }
        });
    }
    
    // Глобальна функція для тестування Firebase (доступна з консолі)
    window.testFirebase = testFirebaseConnection;
    window.checkFirebaseStatus = () => {
        console.log('=== Статус Firebase ===');
        console.log('SDK завантажено:', typeof firebase !== 'undefined');
        console.log('Firebase ініціалізовано:', firebaseInitialized);
        console.log('Database встановлено:', !!database);
        console.log('carsRef встановлено:', !!carsRef);
        console.log('Кількість автомобілів:', cars.length);
        if (database) {
            console.log('Database URL:', database.app.options.databaseURL);
        }
        console.log('=====================');
    };
});

