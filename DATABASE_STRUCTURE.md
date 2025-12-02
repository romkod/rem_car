# Структура бази даних Firebase Realtime Database

## Загальна структура

```
/
└── cars/
    ├── {carId1}/
    │   ├── brand: "Tesla"
    │   ├── model: "Model 3"
    │   └── categories/
    │       ├── [0]/
    │       │   ├── id: "category-123"
    │       │   ├── name: "Передня частина кузова"
    │       │   └── items/
    │       │       ├── [0]/
    │       │       │   ├── id: "item-456"
    │       │       │   ├── name: "Передній бампер"
    │       │       │   ├── currency: "USD"
    │       │       │   ├── prices/
    │       │       │   │   ├── [0]/
    │       │       │   │   │   ├── price: 500
    │       │       │   │   │   └── description: ""
    │       │       │   │   └── [1]/
    │       │       │   │       ├── price: 600
    │       │       │   │       └── description: "З фарбуванням"
    │       │       │   ├── selectedPriceIndex: 0
    │       │       │   ├── price: 500
    │       │       │   └── dependencies/
    │       │       │       ├── [0]/
    │       │       │       │   ├── itemId: "item-789"
    │       │       │       │   └── priceIndex: 0
    │       │       │       └── [1]/
    │       │       │           ├── itemId: "item-101"
    │       │       │           └── priceIndex: 1
    │       │       └── [1]/...
    │       └── [1]/...
    └── {carId2}/...
```

## Детальний опис структури

### 1. `/cars` - Корінь списку автомобілів

**Тип:** Об'єкт, де ключі - це ID автомобілів

**Приклад:**
```json
{
  "cars": {
    "default": {
      "brand": "Tesla",
      "model": "Model 3"
    },
    "tesla-model-s": {
      "brand": "Tesla",
      "model": "Model S"
    }
  }
}
```

### 2. `/cars/{carId}` - Інформація про автомобіль

**Поля:**
- `brand` (string) - Марка автомобіля
- `model` (string) - Модель автомобіля
- `categories` (array) - Масив категорій ремонту

**Приклад:**
```json
{
  "default": {
    "brand": "Tesla",
    "model": "Model 3",
    "categories": [...]
  }
}
```

### 3. `/cars/{carId}/categories` - Категорії ремонту

**Тип:** Масив об'єктів

**Структура категорії:**
```json
{
  "id": "category-1234567890",
  "name": "Передня частина кузова",
  "items": [...]
}
```

**Поля категорії:**
- `id` (string) - Унікальний ідентифікатор категорії
- `name` (string) - Назва категорії
- `items` (array) - Масив елементів ремонту

### 4. Елемент ремонту (item)

**Структура:**
```json
{
  "id": "item-1234567890",
  "name": "Передній бампер",
  "currency": "USD",
  "prices": [
    {
      "price": 500,
      "description": ""
    },
    {
      "price": 600,
      "description": "З фарбуванням"
    }
  ],
  "selectedPriceIndex": 0,
  "price": 500,
  "dependencies": [
    {
      "itemId": "item-789",
      "priceIndex": 0
    }
  ]
}
```

**Поля елемента:**
- `id` (string) - Унікальний ідентифікатор елемента
- `name` (string) - Назва елемента
- `currency` (string) - Валюта ціни ("USD" або "UAH")
- `prices` (array) - Масив цін з описами
  - `price` (number) - Ціна в базовій валюті (USD)
  - `description` (string) - Опис ціни (може бути порожнім)
- `selectedPriceIndex` (number) - Індекс вибраної ціни (0, 1, 2, ...)
- `price` (number) - Поточна ціна (для швидкого доступу, дорівнює `prices[selectedPriceIndex].price`)
- `dependencies` (array) - Масив залежностей від інших елементів
  - `itemId` (string) - ID залежного елемента
  - `priceIndex` (number) - Індекс ціни залежного елемента

## Повний приклад структури

```json
{
  "cars": {
    "default": {
      "brand": "Tesla",
      "model": "Model 3",
      "categories": [
        {
          "id": "cat-front-body",
          "name": "Передня частина кузова",
          "items": [
            {
              "id": "item-front-bumper",
              "name": "Передній бампер",
              "currency": "USD",
              "prices": [
                {
                  "price": 500,
                  "description": ""
                },
                {
                  "price": 600,
                  "description": "З фарбуванням"
                }
              ],
              "selectedPriceIndex": 0,
              "price": 500,
              "dependencies": []
            },
            {
              "id": "item-front-fender",
              "name": "Переднє крило",
              "currency": "USD",
              "prices": [
                {
                  "price": 400,
                  "description": ""
                }
              ],
              "selectedPriceIndex": 0,
              "price": 400,
              "dependencies": [
                {
                  "itemId": "item-front-bumper",
                  "priceIndex": 1
                }
              ]
            }
          ]
        },
        {
          "id": "cat-rear-body",
          "name": "Задня частина кузова",
          "items": []
        }
      ]
    }
  }
}
```

## Шляхи доступу до даних

### Список автомобілів
```
/cars
```

### Інформація про конкретний автомобіль
```
/cars/{carId}
```

### Категорії ремонту для автомобіля
```
/cars/{carId}/categories
```

### Конкретна категорія (за індексом)
```
/cars/{carId}/categories/{index}
```

### Елементи категорії
```
/cars/{carId}/categories/{index}/items
```

### Конкретний елемент (за індексом)
```
/cars/{carId}/categories/{index}/items/{itemIndex}
```

## Правила безпеки Firebase

Для правильної роботи необхідно встановити такі правила:

```json
{
  "rules": {
    "cars": {
      ".read": true,
      ".write": true,
      "$carId": {
        ".read": true,
        ".write": true,
        "categories": {
          ".read": true,
          ".write": true
        }
      }
    }
  }
}
```

**Пояснення правил:**
- `"cars": { ".read": true, ".write": true }` - дозволяє читати та записувати в `/cars`
- `"$carId": { ... }` - динамічний шлях для будь-якого ID автомобіля
- `"categories": { ".read": true, ".write": true }` - дозволяє читати та записувати категорії

**Альтернатива для тестування (небезпечно для продакшену):**

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

**Увага:** Другий варіант дозволяє будь-кому читати та записувати всі дані в базі. Використовуйте тільки для тестування!

## Примітки

1. **ID генерація:**
   - Категорії: `category-{timestamp}-{random}`
   - Елементи: `item-{timestamp}-{random}`
   - Автомобілі: `{timestamp}{random}`

2. **Валюта:**
   - Всі ціни зберігаються в USD (базова валюта)
   - Конвертація UAH → USD відбувається при збереженні
   - Конвертація USD → UAH відбувається при відображенні

3. **Залежності:**
   - Залежності зберігаються як масив об'єктів `{itemId, priceIndex}`
   - При виборі елемента автоматично вибираються залежні елементи з вказаною ціною

4. **Синхронізація:**
   - Всі зміни зберігаються в Firebase Realtime Database
   - Дані також зберігаються в localStorage як резерв
   - Слухачі Firebase оновлюють дані в реальному часі

5. **Міграція даних:**
   - Старі формати даних автоматично конвертуються в новий формат
   - Старі залежності (просто `itemId`) конвертуються в `{itemId, priceIndex: 0}`

## Як код працює зі структурою

### Збереження списку автомобілів (`home.js`)

```javascript
// Шлях: /cars
carsRef = database.ref('cars');

// Збереження
const carsObj = {};
cars.forEach(car => {
    carsObj[car.id] = { brand: car.brand, model: car.model };
});
await carsRef.set(carsObj);
```

**Результат в Firebase:**
```json
{
  "cars": {
    "default": { "brand": "Tesla", "model": "Model 3" },
    "tesla-s": { "brand": "Tesla", "model": "Model S" }
  }
}
```

### Збереження категорій (`calculator.js`)

```javascript
// Шлях: /cars/{carId}/categories
categoriesRef = database.ref(`cars/${currentCarId}/categories`);

// Збереження
await categoriesRef.set(categories);
```

**Результат в Firebase:**
```json
{
  "cars": {
    "default": {
      "brand": "Tesla",
      "model": "Model 3",
      "categories": [
        {
          "id": "cat-1",
          "name": "Передня частина",
          "items": [...]
        }
      ]
    }
  }
}
```

### Читання даних

**Список автомобілів:**
```javascript
carsRef.on('value', (snapshot) => {
    const data = snapshot.val();
    // data = { "default": {...}, "tesla-s": {...} }
    cars = Object.keys(data).map(key => ({
        id: key,
        ...data[key]
    }));
});
```

**Категорії:**
```javascript
categoriesRef.on('value', (snapshot) => {
    const data = snapshot.val();
    // data = [{ id: "...", name: "...", items: [...] }, ...]
    categories = Array.isArray(data) ? data : Object.values(data);
});
```

## Важливі моменти

1. **Масиви vs Об'єкти:**
   - Firebase може зберігати масиви як об'єкти з числовими ключами
   - Код обробляє обидва варіанти: `Array.isArray(data) ? data : Object.values(data)`

2. **ID елементів:**
   - ID генеруються на клієнті: `Date.now().toString(36) + Math.random().toString(36).substr(2, 9)`
   - ID унікальні для кожного елемента/категорії

3. **Синхронізація:**
   - Зміни зберігаються через `.set()` (повна заміна)
   - Слухачі `.on('value')` отримують оновлення в реальному часі
   - Прапорець `isSyncing` запобігає циклічним оновленням

4. **Локальне збереження:**
   - Дані також зберігаються в `localStorage` як резерв
   - Ключі: `repairCalculatorCars` та `repairCalculatorCategories_{carId}`

