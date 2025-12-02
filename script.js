// Змінна для відстеження режиму редагування
let editMode = false;

// Налаштування теми
let currentTheme = localStorage.getItem('selectedTheme') || 'light';

// Курс валют (USD/UAH)
let exchangeRate = 37; // За замовчуванням, буде оновлено з API
let exchangeRateLastUpdate = null;

// SHA-256 хеш пароля "vasil" (хеш зберігається замість відкритого пароля)
// Це хеш від слова "vasil" у форматі SHA-256
// Правильний хеш обчислюється при завантаженні для безпеки
let PASSWORD_HASH = "";

// ID поточного автомобіля (з URL параметрів)
let currentCarId = null;
let currentCarInfo = null;

// Firebase ініціалізація
let firebaseInitialized = false;
let database = null;
let categoriesRef = null;
let isSyncing = false; // Прапорець для запобігання циклічним оновленням

// Отримання конфігурації Firebase (з localStorage або дефолтна)
function getFirebaseConfig() {
    // Спробувати завантажити з localStorage
    const savedConfig = localStorage.getItem('firebaseConfig');
    if (savedConfig) {
        try {
            const config = JSON.parse(savedConfig);
            // Перевірити, чи всі обов'язкові поля присутні
            if (config.apiKey && config.databaseURL && config.projectId) {
                return config;
            }
        } catch (e) {
            console.warn('Помилка завантаження конфігурації Firebase з localStorage:', e);
        }
    }
    
    // Дефолтна конфігурація Firebase
    // Для налаштування: збережіть вашу конфігурацію в localStorage під ключем 'firebaseConfig'
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

// Перевірка валідності конфігурації Firebase
function isFirebaseConfigValid(config) {
    if (!config) return false;
    // Перевірити наявність обов'язкових полів
    return !!(config.apiKey && config.databaseURL && config.projectId);
}

// Ініціалізація Firebase
function initFirebase() {
    // Перевірити, чи Firebase SDK завантажено
    if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK не завантажено');
        return false;
    }
    
    const config = getFirebaseConfig();
    
    // Перевірити валідність конфігурації
    if (!isFirebaseConfigValid(config)) {
        console.warn('Firebase не налаштовано');
        console.warn('Для налаштування збережіть конфігурацію в localStorage під ключем "firebaseConfig"');
        console.warn('Використовується localStorage як резервний варіант');
        return false;
    }
    
    try {
        if (firebase.apps && firebase.apps.length === 0) {
            firebase.initializeApp(config);
            database = firebase.database();
            firebaseInitialized = true;
            console.log('Firebase ініціалізовано успішно');
            
            // Налаштувати слухач для синхронізації даних
            setupFirebaseListener();
            return true;
        } else if (firebase.apps && firebase.apps.length > 0) {
            database = firebase.database();
            firebaseInitialized = true;
            console.log('Firebase вже ініціалізовано');
            setupFirebaseListener();
            return true;
        }
    } catch (error) {
        console.warn('Помилка ініціалізації Firebase:', error);
        console.warn('Використовується localStorage як резервний варіант');
        firebaseInitialized = false;
        return false;
    }
    return false;
}

// Отримання ID авто з URL
function getCarIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('car') || 'default';
}

// Завантаження інформації про авто
function loadCarInfo(carId) {
    const savedCars = localStorage.getItem('repairCalculatorCars');
    if (savedCars) {
        try {
            const cars = JSON.parse(savedCars);
            const car = cars.find(c => c.id === carId);
            if (car) {
                currentCarInfo = car;
                const pageTitle = document.getElementById('pageTitle');
                if (pageTitle) {
                    pageTitle.textContent = `${car.brand} ${car.model} - Що по ремонту?`;
                }
                return car;
            }
        } catch (e) {
            console.error('Помилка завантаження інформації про авто:', e);
        }
    }
    // Дефолтна інформація
    currentCarInfo = { id: carId, brand: 'Автомобіль', model: '' };
    return currentCarInfo;
}

// Налаштування слухача Firebase для синхронізації в реальному часі
function setupFirebaseListener() {
    if (!firebaseInitialized || !database || !currentCarId) return;
    
    try {
        categoriesRef = database.ref(`cars/${currentCarId}/categories`);
        
        // Слухач змін в базі даних
        categoriesRef.on('value', (snapshot) => {
            if (isSyncing) return; // Якщо ми самі зберігаємо, не оновлювати
            
            const data = snapshot.val();
            if (data) {
                try {
                    const loadedCategories = Array.isArray(data) ? data : Object.values(data);
                    if (loadedCategories.length > 0) {
                        categories = loadedCategories;
                        // Зберегти також в localStorage як резерв
                        localStorage.setItem(`repairCalculatorCategories_${currentCarId}`, JSON.stringify(categories));
                        renderCategories();
                        updateTotals();
                        console.log('Дані синхронізовано з Firebase');
                        showSyncStatus('Дані оновлено з сервера', true);
                    }
                } catch (e) {
                    console.error('Помилка обробки даних з Firebase:', e);
                }
            } else {
                // Якщо в Firebase немає даних, завантажити з localStorage або дефолтні
                const localData = localStorage.getItem(`repairCalculatorCategories_${currentCarId}`);
                if (localData) {
                    try {
                        categories = JSON.parse(localData);
                        // Зберегти в Firebase для синхронізації
                        if (categories.length > 0) {
                            isSyncing = true;
                            categoriesRef.set(categories).then(() => {
                                console.log('Дані з localStorage збережено в Firebase');
                                setTimeout(() => { isSyncing = false; }, 500);
                            });
                        }
                    } catch (e) {
                        console.error('Помилка завантаження з localStorage:', e);
                    }
                } else {
                    // Якщо немає даних ніде, використати дефолтні та зберегти
                    categories = getDefaultCategories();
                    isSyncing = true;
                    categoriesRef.set(categories).then(() => {
                        console.log('Дефолтні дані збережено в Firebase');
                        localStorage.setItem(`repairCalculatorCategories_${currentCarId}`, JSON.stringify(categories));
                        setTimeout(() => { isSyncing = false; }, 500);
                    });
                }
                renderCategories();
                updateTotals();
            }
        }, (error) => {
            console.error('Помилка слухача Firebase:', error);
            // У випадку помилки використати localStorage
            categories = loadCategories();
            renderCategories();
            updateTotals();
        });
    } catch (error) {
        console.error('Помилка налаштування слухача Firebase:', error);
        // У випадку помилки використати localStorage
        categories = loadCategories();
        renderCategories();
        updateTotals();
    }
}

// Показати індикатор синхронізації
function showSyncStatus(text, isSuccess = false) {
    const syncStatus = document.getElementById('syncStatus');
    const syncText = document.getElementById('syncText');
    const syncIcon = document.getElementById('syncIcon');
    
    if (syncStatus && syncText && syncIcon) {
        syncStatus.style.display = 'block';
        syncText.textContent = text;
        syncIcon.textContent = isSuccess ? '✅' : '🔄';
        syncStatus.style.color = isSuccess ? '#28a745' : '#1f4f7b';
        
        // Автоматично приховати через 3 секунди, якщо успішно
        if (isSuccess) {
            setTimeout(() => {
                if (syncStatus) {
                    syncStatus.style.display = 'none';
                }
            }, 3000);
        }
    }
}

// Приховати індикатор синхронізації
function hideSyncStatus() {
    const syncStatus = document.getElementById('syncStatus');
    if (syncStatus) {
        syncStatus.style.display = 'none';
    }
}

// Збереження даних в Firebase
async function saveCategoriesToFirebase() {
    if (!firebaseInitialized || !database) {
        // Якщо Firebase не налаштовано, використати localStorage
        saveCategories();
        return;
    }
    
    try {
        isSyncing = true; // Встановити прапорець, щоб не викликати слухача
        showSyncStatus('Збереження змін...', false);
        
        await categoriesRef.set(categories);
        // Також зберегти в localStorage як резерв
        localStorage.setItem(`repairCalculatorCategories_${currentCarId}`, JSON.stringify(categories));
        console.log('Дані збережено в Firebase');
        showSyncStatus('Зміни збережено та синхронізовано', true);
        
        // Зняти прапорець через невелику затримку
        setTimeout(() => {
            isSyncing = false;
        }, 500);
    } catch (error) {
        console.error('Помилка збереження в Firebase:', error);
        showSyncStatus('Помилка синхронізації. Використовується локальне збереження.', false);
        // У випадку помилки зберегти в localStorage
        saveCategories();
        isSyncing = false;
        
        // Приховати повідомлення про помилку через 5 секунд
        setTimeout(() => {
            hideSyncStatus();
        }, 5000);
    }
}

// Функція для хешування пароля через SHA-256
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// Перевірка пароля
async function verifyPassword(inputPassword) {
    // Якщо хеш ще не встановлений, встановити його
    if (!PASSWORD_HASH) {
        PASSWORD_HASH = await hashPassword('vasil');
    }
    const inputHash = await hashPassword(inputPassword);
    return inputHash === PASSWORD_HASH;
}

// Завантаження даних з localStorage або використання дефолтних
function loadCategories() {
    const saved = localStorage.getItem(`repairCalculatorCategories_${currentCarId}`);
    if (saved) {
        try {
            const loaded = JSON.parse(saved);
            // Ініціалізувати dependencies та currency для старих даних
            loaded.forEach(cat => {
                if (cat.items) {
                    cat.items.forEach(item => {
                        if (!item.dependencies) {
                            item.dependencies = [];
                        }
                        if (!item.currency) {
                            item.currency = 'USD';
                        }
                    });
                }
            });
            return loaded;
        } catch (e) {
            console.error('Помилка завантаження даних:', e);
        }
    }
    return getDefaultCategories();
}

// Збереження даних в localStorage
function saveCategories() {
    localStorage.setItem(`repairCalculatorCategories_${currentCarId}`, JSON.stringify(categories));
    // Також зберегти в Firebase, якщо він налаштований
    if (firebaseInitialized) {
        saveCategoriesToFirebase();
    }
}

// Дефолтні категорії
function getDefaultCategories() {
    return [
    {
        id: "front",
        name: "Передня частина кузова",
        items: [
            { id: "front-bumper", name: "Передній бампер (з фарбуванням)", price: 12000 },
            { id: "hood", name: "Капот (вирівнювання + фарбування)", price: 15000 },
            { id: "left-headlight", name: "Ліва фара (заміна)", price: 9000 },
            { id: "right-headlight", name: "Права фара (заміна)", price: 9000 },
            { id: "radiator-support", name: "Телевізор / рамка радіатора", price: 14000 },
            { id: "radiators", name: "Радіатори (охолодження / кондиціонер)", price: 17000 }
        ]
    },
    {
        id: "rear",
        name: "Задня частина кузова",
        items: [
            { id: "rear-bumper", name: "Задній бампер (з фарбуванням)", price: 11000 },
            { id: "trunk-lid", name: "Кришка багажника / двері багажника", price: 16000 },
            { id: "rear-panel", name: "Задня панель (кузовні роботи)", price: 18000 },
            { id: "rear-lamp-left", name: "Лівий задній ліхтар", price: 6000 },
            { id: "rear-lamp-right", name: "Правий задній ліхтар", price: 6000 }
        ]
    },
    {
        id: "side",
        name: "Бік автомобіля",
        items: [
            { id: "front-left-door", name: "Ліва передня дверка", price: 14000 },
            { id: "rear-left-door", name: "Ліва задня дверка", price: 14000 },
            { id: "front-right-door", name: "Права передня дверка", price: 14000 },
            { id: "rear-right-door", name: "Права задня дверка", price: 14000 },
            { id: "left-fender", name: "Ліве переднє крило", price: 12000 },
            { id: "right-fender", name: "Праве переднє крило", price: 12000 },
            { id: "sill", name: "Поріг (відновлення / заміна)", price: 15000 },
            { id: "quarter-panel", name: "Заднє крило (квартал)", price: 19000 }
        ]
    },
    {
        id: "safety",
        name: "Ремонт безпеки (SRS / підвіска тощо)",
        items: [
            { id: "front-airbags", name: "Фронтальні подушки безпеки (водій + пасажир)", price: 45000 },
            { id: "side-airbags", name: "Бічні / шторки безпеки", price: 38000 },
            { id: "seatbelts", name: "Ремені безпеки з піропатронами", price: 22000 },
            { id: "srs-module", name: "Блок SRS (ремонт / заміна)", price: 12000 },
            { id: "sensors", name: "Датчики удару, калібрування", price: 8000 },
            { id: "suspension", name: "Передня підвіска (важелі, тяги, розвал-східження)", price: 18000 }
        ]
    }
    ];
}

// Дані по категоріях та елементах
let categories = loadCategories();

// Генерація унікального ID
function generateId(prefix = 'item') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Рендер категорій та елементів
function renderCategories() {
    const container = document.getElementById("categoriesContainer");
    const summaryByCategory = document.getElementById("summaryByCategory");
    container.innerHTML = "";
    summaryByCategory.innerHTML = "";

    // Додати клас edit-mode до body, якщо режим редагування активний
    if (editMode) {
        document.body.classList.add('edit-mode');
    } else {
        document.body.classList.remove('edit-mode');
    }

    categories.forEach(cat => {
        // Блок категорії з чекбоксами
        const catDiv = document.createElement("div");
        catDiv.className = "category";

        const header = document.createElement("div");
        header.className = "category-header";

        const title = document.createElement("h3");
        title.textContent = cat.name;
        header.appendChild(title);

        const headerRight = document.createElement("div");
        headerRight.style.display = "flex";
        headerRight.style.alignItems = "center";
        headerRight.style.gap = "8px";

        const sumSpan = document.createElement("span");
        sumSpan.id = `subtotal-${cat.id}`;
        sumSpan.textContent = formatCurrency(0);
        headerRight.appendChild(sumSpan);

        // Кнопка видалення категорії (тільки в режимі редагування)
        if (editMode) {
            const deleteCatBtn = document.createElement("button");
            deleteCatBtn.className = "btn-delete-category";
            deleteCatBtn.textContent = "Видалити";
            deleteCatBtn.onclick = () => deleteCategory(cat.id);
            headerRight.appendChild(deleteCatBtn);
        }

        header.appendChild(headerRight);
        catDiv.appendChild(header);

        cat.items.forEach(item => {
            // Ініціалізувати dependencies, якщо їх немає
            if (!item.dependencies) {
                item.dependencies = [];
            }
            // Ініціалізувати валюту елемента (за замовчуванням USD)
            if (!item.currency) {
                item.currency = 'USD';
            }

            const itemDiv = document.createElement("div");
            itemDiv.className = "item";

            const label = document.createElement("label");
            label.setAttribute("for", item.id);

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.id = item.id;
            checkbox.dataset.price = item.price;
            checkbox.dataset.categoryId = cat.id;
            checkbox.dataset.itemId = item.id;
            checkbox.disabled = editMode; // Вимкнути чекбокси в режимі редагування
            
            // Обробник вибору з автоматичним вибором залежностей
            checkbox.addEventListener("change", (e) => {
                if (e.target.checked && item.dependencies && item.dependencies.length > 0) {
                    // Автоматично вибрати залежні елементи
                    item.dependencies.forEach(depId => {
                        const depCheckbox = document.getElementById(depId);
                        if (depCheckbox && !depCheckbox.checked) {
                            depCheckbox.checked = true;
                            depCheckbox.dispatchEvent(new Event('change'));
                        }
                    });
                }
                updateTotals();
            });

            label.appendChild(checkbox);
            
            if (editMode) {
                // В режимі редагування показуємо input для редагування назви
                const nameInput = document.createElement("input");
                nameInput.type = "text";
                nameInput.value = item.name;
                nameInput.className = "item-name-input";
                nameInput.dataset.itemId = item.id;
                nameInput.dataset.categoryId = cat.id;
                nameInput.addEventListener("blur", (e) => {
                    updateItemName(cat.id, item.id, e.target.value);
                });
                nameInput.addEventListener("keypress", (e) => {
                    if (e.key === "Enter") {
                        e.target.blur();
                    }
                });
                label.appendChild(nameInput);
            } else {
                label.appendChild(document.createTextNode(item.name));
            }

            const priceSpan = document.createElement("span");
            priceSpan.className = "item-price";
            
            if (editMode) {
                // В режимі редагування показуємо input для редагування ціни
                const priceInput = document.createElement("input");
                priceInput.type = "number";
                // Відобразити ціну в валюті елемента
                const displayPrice = item.currency === 'UAH' ? item.price : item.price;
                priceInput.value = displayPrice;
                priceInput.min = "0";
                priceInput.step = item.currency === 'UAH' ? "1" : "100";
                priceInput.className = "item-price-input";
                priceInput.dataset.itemId = item.id;
                priceInput.dataset.categoryId = cat.id;
                priceInput.dataset.currency = item.currency;
                
                // Вибір валюти
                const currencySelect = document.createElement("select");
                currencySelect.className = "item-currency-select";
                currencySelect.dataset.itemId = item.id;
                currencySelect.dataset.categoryId = cat.id;
                
                const usdOption = document.createElement("option");
                usdOption.value = "USD";
                usdOption.textContent = "USD ($)";
                if (item.currency === 'USD') usdOption.selected = true;
                
                const uahOption = document.createElement("option");
                uahOption.value = "UAH";
                uahOption.textContent = "UAH (₴)";
                if (item.currency === 'UAH') uahOption.selected = true;
                
                currencySelect.appendChild(usdOption);
                currencySelect.appendChild(uahOption);
                
                // Обробник зміни валюти
                currencySelect.addEventListener("change", (e) => {
                    const newCurrency = e.target.value;
                    const category = categories.find(c => c.id === cat.id);
                    const itemToUpdate = category ? category.items.find(it => it.id === item.id) : null;
                    if (itemToUpdate) {
                        const oldCurrency = itemToUpdate.currency;
                        itemToUpdate.currency = newCurrency;
                        
                        // Конвертувати ціну при зміні валюти
                        if (oldCurrency === 'UAH' && newCurrency === 'USD') {
                            // З UAH в USD
                            itemToUpdate.price = Math.round(Number(priceInput.value) / exchangeRate);
                            priceInput.value = itemToUpdate.price;
                        } else if (oldCurrency === 'USD' && newCurrency === 'UAH') {
                            // З USD в UAH
                            itemToUpdate.price = Math.round(Number(priceInput.value) * exchangeRate);
                            priceInput.value = itemToUpdate.price;
                        }
                        
                        priceInput.step = newCurrency === 'UAH' ? "1" : "100";
                        saveCategories();
                        updateTotals();
                    }
                });
                
                // Обробник зміни ціни з автоматичною конвертацією
                priceInput.addEventListener("change", (e) => {
                    const inputValue = Number(e.target.value);
                    const category = categories.find(c => c.id === cat.id);
                    const itemToUpdate = category ? category.items.find(it => it.id === item.id) : null;
                    if (itemToUpdate) {
                        if (itemToUpdate.currency === 'UAH') {
                            // Конвертувати з UAH в USD для збереження
                            itemToUpdate.price = Math.round(inputValue / exchangeRate);
                        } else {
                            // Вже в USD
                            itemToUpdate.price = Math.round(inputValue);
                        }
                        // Оновити data-price в чекбоксі
                        const checkbox = document.getElementById(item.id);
                        if (checkbox) {
                            checkbox.dataset.price = itemToUpdate.price;
                        }
                        saveCategories();
                        updateTotals();
                    }
                });
                
                priceSpan.appendChild(priceInput);
                priceSpan.appendChild(currencySelect);

                // Кнопка налаштування залежностей
                const depsBtn = document.createElement("button");
                depsBtn.className = "btn-dependencies";
                depsBtn.textContent = "🔗";
                depsBtn.title = "Налаштувати залежності";
                depsBtn.onclick = () => showDependenciesModal(cat.id, item.id);
                priceSpan.appendChild(depsBtn);

                // Кнопка видалення елемента
                const deleteBtn = document.createElement("button");
                deleteBtn.className = "btn-delete";
                deleteBtn.textContent = "×";
                deleteBtn.onclick = () => deleteItem(cat.id, item.id);
                priceSpan.appendChild(deleteBtn);
            } else {
                priceSpan.textContent = formatCurrency(item.price);
            }

            itemDiv.appendChild(label);
            itemDiv.appendChild(priceSpan);

            catDiv.appendChild(itemDiv);
        });

        // Форма додавання нового елемента (тільки в режимі редагування)
        if (editMode) {
            const addItemForm = document.createElement("div");
            addItemForm.className = "add-item-form";
            
            const nameInput = document.createElement("input");
            nameInput.type = "text";
            nameInput.placeholder = "Назва елемента";
            nameInput.className = "form-input";
            
            const priceInput = document.createElement("input");
            priceInput.type = "number";
            priceInput.placeholder = "Ціна";
            priceInput.min = "0";
            priceInput.step = "100";
            priceInput.className = "form-input";
            
            const formGroup = document.createElement("div");
            formGroup.className = "form-group";
            formGroup.appendChild(nameInput);
            formGroup.appendChild(priceInput);
            
            const addBtn = document.createElement("button");
            addBtn.className = "btn-add-item";
            addBtn.textContent = "Додати елемент";
            addBtn.onclick = () => {
                const name = nameInput.value.trim();
                const price = Number(priceInput.value);
                if (name && price >= 0) {
                    addItem(cat.id, name, price);
                    nameInput.value = "";
                    priceInput.value = "";
                } else {
                    alert("Будь ласка, введіть назву та ціну (≥ 0)");
                }
            };
            formGroup.appendChild(addBtn);
            
            addItemForm.appendChild(formGroup);
            catDiv.appendChild(addItemForm);
        }

        container.appendChild(catDiv);

        // Рядок підсумку по категорії в правій колонці
        const row = document.createElement("div");
        row.className = "summary-row";
        const valueSpan = document.createElement("span");
        valueSpan.className = "value";
        valueSpan.id = `summary-${cat.id}`;
        valueSpan.textContent = formatCurrency(0);
        row.innerHTML = `<span class="label">${cat.name}</span>`;
        row.appendChild(valueSpan);
        summaryByCategory.appendChild(row);
    });

    // Повісити обробник змін на всі чекбокси
    container.querySelectorAll("input[type='checkbox']").forEach(cb => {
        cb.addEventListener("change", updateTotals);
    });
}

// Отримання курсу валют з API Мінфін
async function fetchExchangeRate() {
    try {
        // Використовуємо API Мінфін для отримання курсу USD/UAH
        // Спробуємо публічний endpoint міжбанківського курсу
        const response = await fetch('https://api.minfin.com.ua/mb/');
        const data = await response.json();
        
        // Знайти курс USD (може бути 'usd' або 'USD')
        const usdRate = data.find(rate => 
            (rate.currency && rate.currency.toLowerCase() === 'usd') ||
            (rate.code && rate.code.toLowerCase() === 'usd')
        );
        if (usdRate && (usdRate.ask || usdRate.rate || usdRate.bid)) {
            exchangeRate = parseFloat(usdRate.ask || usdRate.rate || usdRate.bid);
            exchangeRateLastUpdate = new Date();
            updateExchangeRateDisplay();
            return exchangeRate;
        }
    } catch (error) {
        console.warn('Помилка отримання курсу валют з Мінфін API:', error);
        // Спробувати альтернативний метод через CORS проксі
        try {
            const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://minfin.com.ua/ua/currency/');
            const response = await fetch(proxyUrl);
            const html = await response.text();
            
            // Парсити HTML для отримання курсу USD
            // Шукаємо курс у форматі "XX.XX" або "XX,XX"
            const patterns = [
                /USD.*?(\d{2,3}[.,]\d{2})/i,
                /долар.*?(\d{2,3}[.,]\d{2})/i,
                /"usd".*?(\d{2,3}[.,]\d{2})/i,
                /міжбанк.*?USD.*?(\d{2,3}[.,]\d{2})/i
            ];
            
            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match) {
                    const foundRate = parseFloat(match[1].replace(',', '.'));
                    if (foundRate > 20 && foundRate < 100) { // Валідація курсу
                        exchangeRate = foundRate;
                        exchangeRateLastUpdate = new Date();
                        updateExchangeRateDisplay();
                        return exchangeRate;
                    }
                }
            }
        } catch (proxyError) {
            console.warn('Помилка через проксі:', proxyError);
        }
        
        // Використати збережений курс або дефолтний
        const savedRate = localStorage.getItem('exchangeRate');
        if (savedRate) {
            exchangeRate = parseFloat(savedRate);
        } else {
            // Дефолтний курс якщо нічого не знайдено
            exchangeRate = 37.0;
        }
    }
    updateExchangeRateDisplay();
    return exchangeRate;
}

// Оновити відображення курсу валют
function updateExchangeRateDisplay() {
    const rateElement = document.getElementById('exchangeRateText');
    if (rateElement) {
        const formattedRate = exchangeRate.toFixed(2);
        const updateTime = exchangeRateLastUpdate 
            ? ` (оновлено ${exchangeRateLastUpdate.toLocaleTimeString('uk-UA')})`
            : '';
        rateElement.textContent = `Курс USD/UAH: ${formattedRate}${updateTime}`;
        localStorage.setItem('exchangeRate', exchangeRate.toString());
    }
}

// Форматування суми (завжди в USD)
function formatCurrency(value) {
    return value.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }) + ' $';
}

// Перерахунок підсумків
function updateTotals() {
    const checkboxes = document.querySelectorAll("input[type='checkbox'][data-price]");
    let total = 0;

    // Обнулити проміжні підсумки
    const subtotals = {};
    categories.forEach(cat => (subtotals[cat.id] = 0));

    checkboxes.forEach(cb => {
        if (cb.checked) {
            const price = Number(cb.dataset.price) || 0;
            const catId = cb.dataset.categoryId;
            total += price;
            if (catId && subtotals[catId] !== undefined) {
                subtotals[catId] += price;
            }
        }
    });

    // Оновити текст у правій колонці
    document.getElementById("totalAmount").textContent = formatCurrency(total);

    categories.forEach(cat => {
        const subtotal = subtotals[cat.id] || 0;
        const catSubtotalSpan = document.getElementById(`subtotal-${cat.id}`);
        const summarySpan = document.getElementById(`summary-${cat.id}`);
        if (catSubtotalSpan) catSubtotalSpan.textContent = formatCurrency(subtotal);
        if (summarySpan) summarySpan.textContent = formatCurrency(subtotal);
    });
}

// Скинути всі галочки
function clearSelection() {
    document.querySelectorAll("input[type='checkbox'][data-price]").forEach(cb => {
        cb.checked = false;
    });
    updateTotals();
}

// Експорт переліку вибраних елементів у буфер обміну
function exportSelection() {
    const checkboxes = document.querySelectorAll("input[type='checkbox'][data-price]");
    const selected = [];
    let total = 0;

    checkboxes.forEach(cb => {
        if (cb.checked) {
            const price = Number(cb.dataset.price) || 0;
            total += price;
            const labelText = cb.parentElement.textContent.trim();
            selected.push(`- ${labelText} — ${formatCurrency(price)}`);
        }
    });

    let text;
    if (selected.length === 0) {
        text = "Не вибрано жодного елемента.";
    } else {
        text = "Перелік пошкоджених елементів та орієнтовна вартість ремонту:\n\n";
        text += selected.join("\n");
        text += "\n\nЗагальна сума: " + formatCurrency(total);
    }

    navigator.clipboard.writeText(text).then(
        () => alert("Перелік скопійовано у буфер обміну."),
        () => alert("Не вдалося скопіювати у буфер. Можливо, браузер забороняє доступ.")
    );
}

// Показ модального вікна для введення пароля
function showPasswordModal() {
    const modal = document.getElementById("passwordModal");
    const passwordInput = document.getElementById("passwordInput");
    const errorMsg = document.getElementById("passwordError");
    
    modal.style.display = "flex";
    passwordInput.value = "";
    errorMsg.style.display = "none";
    passwordInput.focus();
}

// Закриття модального вікна
function hidePasswordModal() {
    const modal = document.getElementById("passwordModal");
    modal.style.display = "none";
}

// Обробка введення пароля
async function handlePasswordSubmit() {
    const passwordInput = document.getElementById("passwordInput");
    const errorMsg = document.getElementById("passwordError");
    const password = passwordInput.value;
    
    if (!password) {
        errorMsg.textContent = "Будь ласка, введіть пароль";
        errorMsg.style.display = "block";
        return;
    }
    
    const isValid = await verifyPassword(password);
    
    if (isValid) {
        hidePasswordModal();
        enableEditMode();
    } else {
        errorMsg.textContent = "Невірний пароль";
        errorMsg.style.display = "block";
        passwordInput.value = "";
        passwordInput.focus();
    }
}

// Увімкнення режиму редагування
function enableEditMode() {
    editMode = true;
    const btn = document.getElementById("btnEditMode");
    const addCategoryForm = document.getElementById("addCategoryForm");
    const noteText = document.getElementById("noteText");
    
    btn.textContent = "Вийти з режиму редагування";
    btn.classList.add("active");
    addCategoryForm.style.display = "block";
    noteText.textContent = "Режим редагування: додавайте категорії та елементи, редагуйте ціни.";
    
    renderCategories();
    updateTotals();
}

// Вимкнення режиму редагування
function disableEditMode() {
    editMode = false;
    const btn = document.getElementById("btnEditMode");
    const addCategoryForm = document.getElementById("addCategoryForm");
    const noteText = document.getElementById("noteText");
    
    btn.textContent = "Режим редагування";
    btn.classList.remove("active");
    addCategoryForm.style.display = "none";
    noteText.textContent = "Ціни орієнтовні — їх можна відредагувати в режимі редагування.";
    
    renderCategories();
    updateTotals();
}

// Перемикання режиму редагування
function toggleEditMode() {
    if (editMode) {
        // Якщо режим редагування вже увімкнено, просто вимкнути його
        disableEditMode();
    } else {
        // Якщо режим редагування вимкнено, показати модальне вікно для пароля
        showPasswordModal();
    }
}

// Додавання нової категорії
function addCategory(name) {
    if (!name || !name.trim()) {
        alert("Будь ласка, введіть назву категорії");
        return;
    }
    
    const newCategory = {
        id: generateId("cat"),
        name: name.trim(),
        items: []
    };
    
    categories.push(newCategory);
    saveCategories(); // Це викличе saveCategoriesToFirebase якщо Firebase налаштовано
    renderCategories();
    updateTotals();
}

// Видалення категорії
function deleteCategory(categoryId) {
    if (confirm("Ви впевнені, що хочете видалити цю категорію? Всі елементи в ній також будуть видалені.")) {
        categories = categories.filter(cat => cat.id !== categoryId);
        saveCategories();
        renderCategories();
        updateTotals();
    }
}

// Додавання нового елемента до категорії
function addItem(categoryId, name, price) {
    if (!name || !name.trim()) {
        alert("Будь ласка, введіть назву елемента");
        return;
    }
    
    if (price < 0 || isNaN(price)) {
        alert("Будь ласка, введіть коректну ціну (≥ 0)");
        return;
    }
    
    const category = categories.find(cat => cat.id === categoryId);
    if (category) {
        const newItem = {
            id: generateId("item"),
            name: name.trim(),
            price: Math.round(price),
            currency: 'USD', // За замовчуванням USD
            dependencies: [] // Ініціалізувати порожній масив залежностей
        };
        
        category.items.push(newItem);
        saveCategories();
        renderCategories();
        updateTotals();
    }
}

// Оновлення назви елемента
function updateItemName(categoryId, itemId, newName) {
    if (!newName || !newName.trim()) {
        alert("Назва не може бути порожньою");
        return;
    }
    
    const category = categories.find(cat => cat.id === categoryId);
    if (category) {
        const item = category.items.find(it => it.id === itemId);
        if (item) {
            item.name = newName.trim();
            saveCategories();
            // Оновити відображення без повного перерендеру
            const label = document.querySelector(`label[for="${itemId}"]`);
            if (label && editMode) {
                const nameInput = label.querySelector('.item-name-input');
                if (nameInput) {
                    nameInput.value = item.name;
                }
            }
        }
    }
}

// Оновлення ціни елемента
function updateItemPrice(categoryId, itemId, newPrice) {
    if (newPrice < 0 || isNaN(newPrice)) {
        alert("Ціна повинна бути числом ≥ 0");
        return;
    }
    
    const category = categories.find(cat => cat.id === categoryId);
    if (category) {
        const item = category.items.find(it => it.id === itemId);
        if (item) {
            item.price = Math.round(newPrice);
            // Оновити data-price в чекбоксі
            const checkbox = document.getElementById(itemId);
            if (checkbox) {
                checkbox.dataset.price = item.price;
            }
            saveCategories(); // Це викличе saveCategoriesToFirebase якщо Firebase налаштовано
            updateTotals();
        }
    }
}

// Видалення елемента
function deleteItem(categoryId, itemId) {
    if (confirm("Ви впевнені, що хочете видалити цей елемент?")) {
        const category = categories.find(cat => cat.id === categoryId);
        if (category) {
            category.items = category.items.filter(item => item.id !== itemId);
            
            // Видалити посилання на цей елемент з залежностей інших елементів
            categories.forEach(cat => {
                cat.items.forEach(item => {
                    if (item.dependencies && item.dependencies.includes(itemId)) {
                        item.dependencies = item.dependencies.filter(depId => depId !== itemId);
                    }
                });
            });
            
            saveCategories();
            renderCategories();
            updateTotals();
        }
    }
}

// Змінні для модального вікна залежностей
let currentEditingItemId = null;
let currentEditingCategoryId = null;

// Показати модальне вікно для налаштування залежностей
function showDependenciesModal(categoryId, itemId) {
    const modal = document.getElementById("dependenciesModal");
    const dependenciesList = document.getElementById("dependenciesList");
    const category = categories.find(cat => cat.id === categoryId);
    const item = category ? category.items.find(it => it.id === itemId) : null;
    
    if (!item) return;
    
    currentEditingItemId = itemId;
    currentEditingCategoryId = categoryId;
    
    // Очистити список
    dependenciesList.innerHTML = "";
    
    // Створити список всіх елементів (крім поточного)
    categories.forEach(cat => {
        cat.items.forEach(otherItem => {
            if (otherItem.id !== itemId) {
                const itemDiv = document.createElement("div");
                itemDiv.style.display = "flex";
                itemDiv.style.alignItems = "center";
                itemDiv.style.gap = "8px";
                itemDiv.style.padding = "8px";
                itemDiv.style.borderBottom = "1px solid #e1e4eb";
                
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.id = `dep-${otherItem.id}`;
                checkbox.checked = item.dependencies && item.dependencies.includes(otherItem.id);
                
                const label = document.createElement("label");
                label.setAttribute("for", `dep-${otherItem.id}`);
                label.style.cursor = "pointer";
                label.style.flex = "1";
                label.innerHTML = `<strong>${cat.name}</strong> - ${otherItem.name}`;
                
                itemDiv.appendChild(checkbox);
                itemDiv.appendChild(label);
                dependenciesList.appendChild(itemDiv);
            }
        });
    });
    
    if (dependenciesList.children.length === 0) {
        dependenciesList.innerHTML = "<p style='text-align: center; color: #666; padding: 20px;'>Немає інших елементів для налаштування залежностей</p>";
    }
    
    modal.style.display = "flex";
}

// Приховати модальне вікно залежностей
function hideDependenciesModal() {
    const modal = document.getElementById("dependenciesModal");
    modal.style.display = "none";
    currentEditingItemId = null;
    currentEditingCategoryId = null;
}

// Зберегти залежності
function saveDependencies() {
    if (!currentEditingItemId || !currentEditingCategoryId) return;
    
    const category = categories.find(cat => cat.id === currentEditingCategoryId);
    const item = category ? category.items.find(it => it.id === currentEditingItemId) : null;
    
    if (!item) return;
    
    // Зібрати вибрані залежності
    const selectedDependencies = [];
    categories.forEach(cat => {
        cat.items.forEach(otherItem => {
            if (otherItem.id !== currentEditingItemId) {
                const checkbox = document.getElementById(`dep-${otherItem.id}`);
                if (checkbox && checkbox.checked) {
                    selectedDependencies.push(otherItem.id);
                }
            }
        });
    });
    
    item.dependencies = selectedDependencies;
    saveCategories();
    hideDependenciesModal();
}

// Застосувати тему
function applyTheme(theme) {
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add(`theme-${theme}`);
    currentTheme = theme;
    localStorage.setItem('selectedTheme', theme);
}

// Перемкнути тему (між світлою та темною)
function toggleTheme() {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
}

// Ініціалізація
document.addEventListener("DOMContentLoaded", async () => {
    // Отримати ID авто з URL
    currentCarId = getCarIdFromUrl();
    loadCarInfo(currentCarId);
    
    // Обчислити правильний хеш для "vasil" та зберегти його
    PASSWORD_HASH = await hashPassword('vasil');
    console.log('SHA-256 хеш для "vasil" встановлено:', PASSWORD_HASH);
    
    // Застосувати збережену тему
    applyTheme(currentTheme);
    
    // Завантажити курс валют
    const savedRate = localStorage.getItem('exchangeRate');
    if (savedRate) {
        exchangeRate = parseFloat(savedRate);
    }
    fetchExchangeRate();
    
    // Спробувати ініціалізувати Firebase
    initFirebase();
    
    // Завантажити дані (з Firebase або localStorage)
    if (firebaseInitialized) {
        // Дані будуть завантажені через слухача Firebase
        console.log('Очікування даних з Firebase...');
    } else {
        // Якщо Firebase не налаштовано, використати localStorage
        categories = loadCategories();
        renderCategories();
        updateTotals();
    }

    document.getElementById("btnClear").addEventListener("click", clearSelection);
    document.getElementById("btnExport").addEventListener("click", exportSelection);
    document.getElementById("btnEditMode").addEventListener("click", toggleEditMode);
    
    // Обробники модального вікна пароля
    document.getElementById("btnPasswordSubmit").addEventListener("click", handlePasswordSubmit);
    document.getElementById("btnPasswordCancel").addEventListener("click", hidePasswordModal);
    
    // Введення пароля по Enter
    document.getElementById("passwordInput").addEventListener("keypress", async (e) => {
        if (e.key === "Enter") {
            await handlePasswordSubmit();
        }
    });
    
    // Закриття модального вікна по кліку поза ним
    document.getElementById("passwordModal").addEventListener("click", (e) => {
        if (e.target.id === "passwordModal") {
            hidePasswordModal();
        }
    });
    
    // Обробники модального вікна залежностей
    const dependenciesModal = document.getElementById("dependenciesModal");
    if (dependenciesModal) {
        dependenciesModal.addEventListener("click", (e) => {
            if (e.target.id === "dependenciesModal") {
                hideDependenciesModal();
            }
        });
    }
    
    const btnSaveDependencies = document.getElementById("btnSaveDependencies");
    const btnCancelDependencies = document.getElementById("btnCancelDependencies");
    if (btnSaveDependencies) {
        btnSaveDependencies.addEventListener("click", saveDependencies);
    }
    if (btnCancelDependencies) {
        btnCancelDependencies.addEventListener("click", hideDependenciesModal);
    }
    
    // Обробник перемикання теми
    const themeToggleBtn = document.getElementById("themeToggleBtn");
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener("click", toggleTheme);
    }
    
    // Обробник додавання категорії
    document.getElementById("btnAddCategory").addEventListener("click", () => {
        const input = document.getElementById("newCategoryName");
        const name = input.value.trim();
        if (name) {
            addCategory(name);
            input.value = "";
        } else {
            alert("Будь ласка, введіть назву категорії");
        }
    });
    
    // Додавання категорії по Enter
    document.getElementById("newCategoryName").addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            document.getElementById("btnAddCategory").click();
        }
    });
});

// Функція для перевірки, де зберігаються дані (для відлагодження)
function checkDataStorage() {
    console.log('=== Статус збереження даних ===');
    console.log('Firebase ініціалізовано:', firebaseInitialized);
    
    if (firebaseInitialized && database) {
        console.log('✅ Дані зберігаються в Firebase Realtime Database');
        console.log(`   Шлях: /cars/${currentCarId || 'default'}/categories`);
        console.log('   URL бази даних:', database.app.options.databaseURL);
        
        // Спробувати прочитати дані з Firebase
        if (categoriesRef) {
            categoriesRef.once('value').then((snapshot) => {
                const data = snapshot.val();
                console.log('   Дані в Firebase:', data ? 'присутні' : 'відсутні');
                if (data) {
                    console.log('   Кількість категорій:', Array.isArray(data) ? data.length : Object.keys(data).length);
                }
            });
        }
    } else {
        console.log('⚠️ Firebase не налаштовано');
    }
    
    // Перевірити localStorage
    const localData = localStorage.getItem(`repairCalculatorCategories_${currentCarId || 'default'}`);
    if (localData) {
        try {
            const parsed = JSON.parse(localData);
            console.log('✅ Дані зберігаються в localStorage');
            console.log(`   Ключ: repairCalculatorCategories_${currentCarId || 'default'}`);
            console.log('   Кількість категорій:', parsed.length);
        } catch (e) {
            console.log('⚠️ Помилка читання localStorage:', e);
        }
    } else {
        console.log('⚠️ Дані відсутні в localStorage');
    }
    
    console.log('================================');
}

