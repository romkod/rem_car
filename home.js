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
    if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK не завантажено');
        return false;
    }
    
    const config = getFirebaseConfig();
    
    try {
        if (firebase.apps && firebase.apps.length === 0) {
            firebase.initializeApp(config);
            database = firebase.database();
            firebaseInitialized = true;
            setupFirebaseListener();
            return true;
        } else if (firebase.apps && firebase.apps.length > 0) {
            database = firebase.database();
            firebaseInitialized = true;
            setupFirebaseListener();
            return true;
        }
    } catch (error) {
        console.warn('Помилка ініціалізації Firebase:', error);
        firebaseInitialized = false;
        return false;
    }
    return false;
}

// Налаштування слухача Firebase
function setupFirebaseListener() {
    if (!firebaseInitialized || !database) return;
    
    try {
        carsRef = database.ref('cars');
        console.log('Налаштування слухача Firebase для списку автомобілів');
        
        carsRef.on('value', (snapshot) => {
            if (isSyncingCars) {
                console.log('Слухач Firebase: пропускаємо оновлення, бо isSyncingCars = true');
                return; // Якщо ми самі зберігаємо, не оновлювати
            }
            
            const data = snapshot.val();
            if (data) {
                const loadedCars = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
                
                // Порівняти з поточними даними, щоб уникнути непотрібних оновлень
                const currentCarsStr = JSON.stringify(cars);
                const loadedCarsStr = JSON.stringify(loadedCars);
                
                if (currentCarsStr !== loadedCarsStr) {
                    console.log('Дані списку автомобілів змінилися, оновлюємо...');
                    isSyncingCars = true;
                    cars = loadedCars;
                    
                    // Зберегти в localStorage
                    localStorage.setItem('repairCalculatorCars', JSON.stringify(cars));
                    renderCars();
                    
                    // Зняти прапорець через затримку
                    setTimeout(() => {
                        isSyncingCars = false;
                        console.log('Синхронізацію списку автомобілів завершено, isSyncingCars = false');
                    }, 1000);
                } else {
                    console.log('Дані списку автомобілів не змінилися, пропускаємо оновлення');
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

// Збереження списку авто
async function saveCars() {
    // Зберегти в localStorage одразу
    localStorage.setItem('repairCalculatorCars', JSON.stringify(cars));
    
    // Якщо Firebase не налаштовано, вийти
    if (!firebaseInitialized || !database) {
        console.log('Firebase не налаштовано, дані збережено тільки в localStorage');
        return;
    }
    
    // Якщо вже синхронізуємо, не викликати знову
    if (isSyncingCars) {
        console.log('Вже виконується синхронізація списку автомобілів, пропускаємо...');
        return;
    }
    
    // Якщо carsRef не встановлено, встановити його
    if (!carsRef) {
        carsRef = database.ref('cars');
        console.log('carsRef встановлено: cars');
    }
    
    try {
        isSyncingCars = true;
        console.log('Збереження списку автомобілів в Firebase...');
        
        const carsObj = {};
        cars.forEach(car => {
            carsObj[car.id] = { brand: car.brand, model: car.model };
        });
        
        await carsRef.set(carsObj);
        console.log('Список автомобілів збережено в Firebase');
        
        // Зняти прапорець через затримку
        setTimeout(() => {
            isSyncingCars = false;
            console.log('Синхронізацію списку автомобілів завершено, isSyncingCars = false');
        }, 1500);
    } catch (error) {
        console.error('Помилка збереження списку автомобілів в Firebase:', error);
        isSyncingCars = false;
    }
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
function addCar(brand, model, copyFromCarId = null) {
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
    saveCars();
    
    // Якщо вказано авто для копіювання налаштувань
    if (copyFromCarId) {
        copyCategoriesFromCar(copyFromCarId, newCar.id);
    }
    
    renderCars();
    
    // Очистити форму
    document.getElementById('newCarBrand').value = '';
    document.getElementById('newCarModel').value = '';
    const copySelect = document.getElementById('copyFromCar');
    if (copySelect) {
        copySelect.value = '';
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
        saveCars();
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

// Ініціалізація
document.addEventListener('DOMContentLoaded', async () => {
    PASSWORD_HASH = await hashPassword('vasil');
    // Обчислити хеш для "petro" для видалення автомобілів
    DELETE_PASSWORD_HASH = await hashPassword('petro');
    
    // Застосувати тему
    applyTheme(currentTheme);
    
    // Ініціалізувати Firebase
    initFirebase();
    
    // Завантажити список авто
    if (!firebaseInitialized) {
        loadCars();
    }
    renderCars();
    
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
});

