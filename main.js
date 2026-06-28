// === УМНАЯ СИСТЕМА ИДЕНТИФИКАЦИИ ИГРОКА (ЛОКАЛЬНАЯ) ===
let tgUsername = localStorage.getItem('saved_player_username');

// Если игрок зашел в игру впервые и имени в памяти телефона еще нет
if (!tgUsername) {
    let userChoice = prompt("👋 Добро пожаловать на Фабрику!\n\nВведите ваш никнейм для таблицы лидеров:");
    
    // Если игрок нажал "Отмена" или ввел пробелы — даем уникальное имя с цифрами
    if (!userChoice || userChoice.trim() === "") {
        tgUsername = "Фабрикант_" + Math.floor(1000 + Math.random() * 9000);
    } else {
        tgUsername = userChoice.trim();
    }
    
    // Запоминаем выбор в память смартфона намертво
    localStorage.setItem('saved_player_username', tgUsername);
}

const sandbox = document.getElementById('sandbox');
const balanceValueEl = document.getElementById('balance-value');
const ppsValueEl = document.getElementById('pps-value');
const timerRing = document.getElementById('timer-ring');
const diamondsValueEl = document.getElementById('diamonds-value');

// === 🎵 ТВОЙ ОБНОВЛЕННЫЙ ЗВУКОВОЙ ПАК ===
const clickSound = new Audio('click.mp3'); 
const mergeSound = new Audio('merge.mp3'); 
const buySound = new Audio('buy.mp3'); 
const openSound = new Audio('open.mp3'); 
const congratsSound = new Audio('congrats.mp3'); 

// Игровые настройки
const BASE_SPAWN_INTERVAL = 10000; 
const MAX_CARDS = 32; 
const PASSIVE_INCOME_INTERVAL = 4000; 
const BASE_MAX_OFFLINE_TIME = 3600; // 1 час
const ADS_COOLDOWN_TIME = 60000; // Перезарядка ТВ: 3 минуты (180 000 мс)

// === ИНТЕГРАЦИЯ НАСТОЯЩЕГО ADSGRAM SDK ===
// Проверяем, загрузился ли скрипт Adsgram на устройство
let AdController = null;

if (window.Adsgram) {
    // Если библиотека успешно скачалась
    AdController = window.Adsgram.init({ blockId: "36308" });
    console.log("Adsgram SDK успешно инициализировано!");
} else {
    // Если объект window.Adsgram пустой — выводим табличку на экран смартфона
    alert("КРИТИЧЕСКАЯ ОШИБКА: Телефон не смог загрузить скрипт sad.min.js из HTML!");
}

// === БАЗА ДАННЫХ КОЛЛЕКЦИИ КАРТОЧЕК ===
// Сюда ты можешь вписать любые свои названия и описания для каждого тира
const CARDS_DATABASE = {
    1: {
        name: "Черемша",
        desc: "Тихо, не спеша, не шурша, четыре карандаша..."
    },
    2: {
        name: "Семакина",
        desc: "М - это модный. В - это весёлый. Г - государственный. У - улётный. ЖЖЖЖЖЖЖ"
    },
    4: {
        name: "Токсис",
        desc: "Возьми телефон, детка. Я знаю, ты хочешь позвонить мне сегодня."
    },
    8: {
        name: "Поганец",
        desc: "Поганец."
    },
    16: {
        name: "Там не так поётся",
        desc: "Никто никогда не узнает как там поётся."
    },
    32: {
        name: "Буба",
        desc: "Ну он просто мега крут. Легенда детства."
    },
    64: {
        name: "Макс Ферстаппен",
        desc: "ТУ ТУ ДУ ДУ МАКС ФЕРСТАПЕН."
    },
    128: {
        name: "Банана Леклер",
        desc: "Nothing, just an inchident on the race."
    },
    256: {
        name: "Я уже красный",
        desc: "Культурно не получится."
    },
    512: {
        name: "Большая лысина",
        desc: "То, что есть у мальчиков, но нет у девочек."
    },
    1024: {
        name: "Бутчер",
        desc: "Excuse me, sir."
    },
    2048: {
        name: "Молния Маквин",
        desc: "Кчау, люблю маму."
    },
    4096: {
        name: "Император Галактики",
        desc: "Основатель Поля 3. Его богатство невозможно измерить обычными цифрами."
    }
};


let prices = {
    1: 10,
    2: 50,
    4: 200,
    8: 1000,
    16: 5000,
    32: 20000,
    64: 100000,
    128: 500000,
    256: 2000000,
    512: 10000000,
};

// Фиксированные цены по твоей задумке (без инфляции) + лимиты уровней
let upgrades = {
    offline: { level: 0, price: 2, maxLevel: 18 },
    tier: { level: 0, price: 5, maxLevel: 5 },
    speed: { level: 0, price: 1, maxLevel: 7 },
    crit: { level: 0, price: 2, maxLevel: 20 }
};

let unlockedItems = [1, 2, 4];
let discoveredCards = [1, 2, 4]; 

let balance = 100;
let diamonds = 0;
let currentField = 1; // По умолчанию игрок находится на 1-м поле
let lastAdWatchTime = 0; // Таймстамп последнего успешного просмотра ТВ
let selectedAdRewardType = null; // Какую награду выбрал игрок ('diamond' или 'money')
let doubleIncomeUntil = 0; // Время в мс, до которого активен х2 доход

// Переменные для Drag and Drop / Touch
let offsetX = 0;
let offsetY = 0;
let cardCounter = 0;

// Переменные для точного кругового таймера
let timePassed = 0; 
const timerStep = 100; 

const circleRadius = 20;
const circleCircumference = 2 * Math.PI * circleRadius;

timerRing.style.strokeDasharray = `${circleCircumference} ${circleCircumference}`;
timerRing.style.strokeDashoffset = circleCircumference;

function formatNumber(num) {
    if (num < 1000) return num.toString();
    const suffixes = ["", "K", "M", "B", "T"];
    const i = Math.floor(Math.log10(num) / 3);
    const formatted = (num / Math.pow(1000, i)).toFixed(1);
    return parseFloat(formatted) + suffixes[i];
}

function formatOfflineTime(seconds) {
    if (seconds < 60) return `${seconds} сек`;
    const minutes = Math.floor(seconds / 60);
    const remSeconds = seconds % 60;
    if (minutes < 60) return `${minutes} мин ${remSeconds} сек`;
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    return `${hours} ч ${remMinutes} мин`;
}

function checkCardUnlocks(value) {
    if (discoveredCards.includes(value)) return;
    discoveredCards.push(value);

    updateFieldTabsUI();

    let targetToUnlock = 0;
    let shopOpenedANewItem = false;

    if (value === 64) targetToUnlock = 8;
    if (value === 128) targetToUnlock = 16;
    if (value === 256) targetToUnlock = 32;
    if (value === 512) targetToUnlock = 64;
    if (value === 1024) targetToUnlock = 128;
    if (value === 2048) targetToUnlock = 256;
    if (value === 4096) targetToUnlock = 512;

    if (targetToUnlock > 0 && !unlockedItems.includes(targetToUnlock)) {
        unlockedItems.push(targetToUnlock);
        shopOpenedANewItem = true;
        
        const row = document.getElementById(`shop-row-${targetToUnlock}`);
        if (row) {
            row.classList.remove('locked');
            const btn = document.getElementById(`buy-${targetToUnlock}-btn`);
            if (btn) btn.disabled = balance < prices[targetToUnlock];
        }
    }

    const popup = document.getElementById('unlock-popup');
    const cardDisplay = document.getElementById('unlocked-card-display');
    const alertText = document.getElementById('shop-alert-text');
    const diamondsRewardValueEl = document.getElementById('diamonds-reward-value');

    if (popup && cardDisplay && alertText && diamondsRewardValueEl) {
        cardDisplay.textContent = formatNumber(value); 
        updateCardColorClass(cardDisplay, value);

        // Начисление алмазов по твоей формуле длины числа
        const diamondsEarned = value.toString().length;
        diamonds += diamondsEarned; 
        if (diamondsValueEl) diamondsValueEl.textContent = formatNumber(diamonds);
        diamondsRewardValueEl.textContent = diamondsEarned;

        if (shopOpenedANewItem) {
            alertText.innerHTML = `🏪 Проверьте новые товары<br>в магазине!`;
            alertText.style.display = 'block';
        } else {
            alertText.style.display = 'none';
        }

        // КАРТОЧКА ОТКРЫТА: Включаем праздничный звук congratsSound
        congratsSound.currentTime = 0;
        congratsSound.play().catch(err => console.log(err));

        popup.showPopover();
    }
}

function refreshShopVisibility() {
    unlockedItems.forEach(val => {
        const row = document.getElementById(`shop-row-${val}`);
        if (row) {
            row.classList.remove('locked');
            const btn = document.getElementById(`buy-${val}-btn`);
            if (btn) btn.disabled = balance < prices[val];
        }
    });
}

function checkUpgradeButtons() {
    const btnOffline = document.getElementById('buy-boost-offline-btn');
    if (btnOffline) {
        btnOffline.disabled = upgrades.offline.level >= upgrades.offline.maxLevel || diamonds < upgrades.offline.price;
    }

    const btnTier = document.getElementById('buy-boost-tier-btn');
    if (btnTier) {
        btnTier.disabled = upgrades.tier.level >= upgrades.tier.maxLevel || diamonds < upgrades.tier.price;
    }

    const btnSpeed = document.getElementById('buy-boost-speed-btn');
    if (btnSpeed) {
        btnSpeed.disabled = upgrades.speed.level >= upgrades.speed.maxLevel || diamonds < upgrades.speed.price;
    }

    const btnCrit = document.getElementById('buy-boost-crit-btn');
    if (btnCrit) {
        btnCrit.disabled = upgrades.crit.level >= upgrades.crit.maxLevel || diamonds < upgrades.crit.price;
    }

}

function updateUpgradeUI() {
    const offlineLvlEl = document.getElementById('boost-offline-lvl');
    const offlinePriceEl = document.getElementById('price-boost-offline');
    if (offlineLvlEl) offlineLvlEl.textContent = upgrades.offline.level;
    if (offlinePriceEl) {
        if (upgrades.offline.level >= upgrades.offline.maxLevel) {
            offlinePriceEl.parentNode.innerHTML = "MAX";
        } else {
            offlinePriceEl.textContent = upgrades.offline.price;
        }
    }

    const tierLvlEl = document.getElementById('boost-tier-lvl');
    const tierPriceEl = document.getElementById('price-boost-tier');
    if (tierLvlEl) tierLvlEl.textContent = upgrades.tier.level;
    if (tierPriceEl) {
        if (upgrades.tier.level >= upgrades.tier.maxLevel) {
            tierPriceEl.parentNode.innerHTML = "MAX";
        } else {
            tierPriceEl.textContent = upgrades.tier.price;
        }
    }

    const speedLvlEl = document.getElementById('boost-speed-lvl');
    const speedPriceEl = document.getElementById('price-boost-speed');
    if (speedLvlEl) speedLvlEl.textContent = upgrades.speed.level;
    if (speedPriceEl) {
        if (upgrades.speed.level >= upgrades.speed.maxLevel) {
            speedPriceEl.parentNode.innerHTML = "MAX";
        } else {
            speedPriceEl.textContent = upgrades.speed.price;
        }
    }

    const critLvlEl = document.getElementById('boost-crit-lvl');
    const critPriceEl = document.getElementById('price-boost-crit');
    if (critLvlEl) critLvlEl.textContent = upgrades.crit.level;
    if (critPriceEl) {
        if (upgrades.crit.level >= upgrades.crit.maxLevel) {
            critPriceEl.parentNode.innerHTML = "MAX";
        } else {
            critPriceEl.textContent = upgrades.crit.price;
        }
    }

    checkUpgradeButtons();
}

function buyUpgrade(type) {
    if (!upgrades[type]) return;
    const data = upgrades[type];
    
    if (data.level < data.maxLevel && diamonds >= data.price) {
        diamonds -= data.price;
        data.level += 1; // Уровень повышен, цена зафиксирована!

        // КУПИЛИ БУСТ С КРИСТАЛЛАМИ: Включаем buySound
        buySound.currentTime = 0;
        buySound.play().catch(err => console.log(err));

        if (diamondsValueEl) diamondsValueEl.textContent = formatNumber(diamonds);
        updateUpgradeUI();
        checkShopButtons();
        saveGame();
    }
}

function saveGame() {
    // Получаем ранее сохраненные карты других полей, чтобы не стереть их
    let allFieldsCards = { field_1: [], field_2: [], field_3: [] };
    const savedData = localStorage.getItem('clicker_game_save');
    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            if (parsed.cardsByFields) allFieldsCards = parsed.cardsByFields;
        } catch(e) {}
    }

    // Сохраняем карты с текущего экрана в их законное поле
    const currentFieldKey = `field_${currentField}`;
    allFieldsCards[currentFieldKey] = [];

    const activeCards = document.querySelectorAll('.drag-item:not(.absorb-anim)');
    activeCards.forEach(card => {
        allFieldsCards[currentFieldKey].push({
            value: Number(card.getAttribute('data-value')),
            left: card.style.left,
            top: card.style.top
        });
    });

    const gameState = { 
        balance: balance, 
        diamonds: diamonds,
        prices: prices, 
        upgrades: upgrades,
        cardsByFields: allFieldsCards, // Сохраняем разделенные по полям карты
        currentField: currentField,     // Запоминаем, на каком поле вышел игрок
        unlockedItems: unlockedItems,
        discoveredCards: discoveredCards,
        lastSaveTime: Date.now(),
        lastAdWatchTime: lastAdWatchTime,
        doubleIncomeUntil: doubleIncomeUntil
    };
    localStorage.setItem('clicker_game_save', JSON.stringify(gameState));
}

function loadGame() {
    const savedData = localStorage.getItem('clicker_game_save');

    if (savedData) {
        try {
            const gameState = JSON.parse(savedData);
            balance = gameState.balance;
            prices = gameState.prices;
            diamonds = gameState.diamonds || 0;
            if (diamondsValueEl) diamondsValueEl.textContent = formatNumber(diamonds);

            if (gameState.upgrades) {
                upgrades.offline.level = gameState.upgrades.offline ? gameState.upgrades.offline.level : 0;
                if (gameState.upgrades.tier) upgrades.tier.level = gameState.upgrades.tier.level;
                if (gameState.upgrades.speed) upgrades.speed.level = gameState.upgrades.speed.level;
                if (gameState.upgrades.crit) upgrades.crit.level = gameState.upgrades.crit.level;
            }
            updateUpgradeUI();

            if (gameState.unlockedItems) unlockedItems = gameState.unlockedItems;
            if (gameState.discoveredCards) discoveredCards = gameState.discoveredCards;
            lastAdWatchTime = gameState.lastAdWatchTime || 0;
            doubleIncomeUntil = gameState.doubleIncomeUntil || 0;

            Object.keys(prices).forEach(val => {
                const priceEl = document.getElementById(`price-${val}`);
                if (priceEl) priceEl.textContent = formatNumber(prices[val]);
            });

            refreshShopVisibility();
            sandbox.innerHTML = '';

            // Отрисовываем карты ТОЛЬКО для текущего активного поля
            if (gameState.cardsByFields) {
                const currentFieldKey = `field_${currentField}`;
                const fieldCards = gameState.cardsByFields[currentFieldKey] || [];
                fieldCards.forEach(cardInfo => {
                    createCard(cardInfo.value, cardInfo.left, cardInfo.top, false); 
                });
            }
            
            calculatePPS();
            checkShopButtons();

            // РАСЧЕТ ОФФЛАЙН ДОХОДА (Считает доход со ВСЕХ полей сразу!)
            if (gameState.lastSaveTime) {
                const timeDiffMs = Date.now() - gameState.lastSaveTime;
                let secondsPassed = Math.floor(timeDiffMs / 1000);

                if (secondsPassed > 10) {
                    let totalValueAllFields = 0;
                    if (gameState.cardsByFields) {
                        Object.values(gameState.cardsByFields).forEach(fieldList => {
                            fieldList.forEach(c => totalValueAllFields += c.value);
                        });
                    }
                    
                    const currentPPS = totalValueAllFields / (PASSIVE_INCOME_INTERVAL / 1000);

                    if (currentPPS > 0) {
                        let actualOfflineSeconds = secondsPassed;
                        const currentMaxOfflineTime = BASE_MAX_OFFLINE_TIME + (upgrades.offline.level * 1800);

                        if (actualOfflineSeconds > currentMaxOfflineTime) {
                            actualOfflineSeconds = currentMaxOfflineTime;
                        }

                        const offlineEarnings = Math.round(actualOfflineSeconds * currentPPS);

                        if (offlineEarnings > 0) {
                            balance += offlineEarnings;
                            const offlinePopup = document.getElementById('offline-popup');
                            const timeText = document.getElementById('offline-time-text');
                            const rewardValue = document.getElementById('offline-reward-value');

                            if (offlinePopup && timeText && rewardValue) {
                                const maxHours = (currentMaxOfflineTime / 3600).toFixed(1);
                                timeText.textContent = `Вас не было в игре: ${formatOfflineTime(secondsPassed)}` + 
                                    (secondsPassed > currentMaxOfflineTime ? ` (MAX ${parseFloat(maxHours)} ч)` : '');
                                rewardValue.textContent = formatNumber(offlineEarnings);
                                setTimeout(() => offlinePopup.showPopover(), 500);
                            }
                        }
                    }
                }
            }

            balanceValueEl.textContent = formatNumber(balance);

            updateFieldTabsUI();
            return true;
        } catch (e) {
            console.error(e);
        }
    }
    return false; 
}


function hardResetGame() {
    if (confirm("Вы уверены, что хотите полностью обнулить игру и удалить сохранение? (Ваш никнейм сохранится)")) {
        // Запоминаем текущий ник перед очисткой памяти
        const currentName = localStorage.getItem('saved_player_username');
        
        localStorage.clear(); // Стираем баланс, карточки и цены
        
        // Возвращаем ник обратно в память
        if (currentName) {
            localStorage.setItem('saved_player_username', currentName);
        }
        
        location.reload();
    }
}

function updateTimerIndicator() {
    timePassed += timerStep;
    const currentSpawnInterval = BASE_SPAWN_INTERVAL - (upgrades.speed.level * 1000);
    const progress = Math.min(timePassed / currentSpawnInterval, 1);
    const offset = circleCircumference - (progress * circleCircumference);
    timerRing.style.strokeDashoffset = offset;

    if (timePassed >= currentSpawnInterval) {
        timePassed = 0; 
        autoSpawn();    
    }
}

// === 📺 ИНТЕГРАЦИЯ НАСТОЯЩЕЙ РЕКЛАМЫ ADSGRAM С ВЫБОРОМ НАГРАДЫ ===
function startRewardedAd(rewardType) {
    // 1. Проверяем кулдаун (3 минуты)
    const timeSinceLastAd = Date.now() - lastAdWatchTime;
    if (timeSinceLastAd < ADS_COOLDOWN_TIME) {
        return; 
    }

    // Закрываем поповер выбора награды
    const choicePopup = document.getElementById('ads-choice-popup');
    if (choicePopup) choicePopup.hidePopover();

    // Проверяем, загрузился ли скрипт Adsgram SDK
    if (!AdController) {
        alert("Реклама временно недоступна. Пожалуйста, попробуйте позже.'(");
        return;
    }

    // 2. Запускаем показ реального видеоролика на смартфоне
    AdController.show().then((result) => {
        // РЕКЛАМА УСПЕШНО ДОСМОТРЕНА ДО КОНЦА!
        lastAdWatchTime = Date.now(); // Фиксируем время просмотра
        
        // Включаем звук успешной покупки/награды buySound
        buySound.currentTime = 0;
        buySound.play().catch(err => console.log(err));

        if (rewardType === 'diamond') {
            // Начисление 1 алмаза
            diamonds += 1;
            if (diamondsValueEl) diamondsValueEl.textContent = formatNumber(diamonds);
            spawnFloatingText("+1 💎", "50%", "50%");
        } else if (rewardType === 'money') {
            // Начисление денег за 15 минут игры (15 мин * 60 сек = 900 секунд)
            const activeCards = document.querySelectorAll('.drag-item:not(.absorb-anim)');
            let totalValue = 0;
            activeCards.forEach(card => { totalValue += Number(card.getAttribute('data-value')); });
            const currentPPS = totalValue / (PASSIVE_INCOME_INTERVAL / 1000);
            
            const moneyEarned = Math.round(currentPPS * 900);
            if (moneyEarned > 0) {
                updateBalance(moneyEarnings || moneyEarned);
                spawnFloatingText(`+${formatNumber(moneyEarned)} $`, "50%", "50%");
            } else {
                // Страховка: если поле абсолютно пустое, дарим базовые 500 долларов, чтобы не обижать игрока
                updateBalance(500);
                spawnFloatingText("+500 $", "50%", "50%");
            }
        } else if (rewardType === 'double') {
            // Если буст уже тикал, прибавляем к нему, если нет — стартуем от текущего времени
            const baseTime = Math.max(doubleIncomeUntil, Date.now());
            doubleIncomeUntil = baseTime + (2 * 60 * 60 * 1000); // +2 часа в мс
            
            spawnFloatingText("ЗОЛОТОЙ ВЕК: х2 ДОХОД!", "50%", "50%");
            calculatePPS(); // Сразу обновляем цифры дохода на экране
        }

        saveGame();
    }).catch((result) => {
        // Игрок закрыл видео раньше времени или произошла ошибка сети
        console.log("Реклама не была досмотрена:", result);
    });
}

// Обновление таймера перезарядки кнопки рекламы в реальном времени
function updateAdsCooldownTimer() {
    const btn = document.getElementById('ads-anchor');
    if (!btn) return;

    const timeSinceLastAd = Date.now() - lastAdWatchTime;

    if (timeSinceLastAd < ADS_COOLDOWN_TIME) {
        // Кулдаун активен: блокируем кнопку и считаем секунды
        btn.classList.add('cooldown');
        
        const timeLeftMs = ADS_COOLDOWN_TIME - timeSinceLastAd;
        const totalSecondsLeft = Math.ceil(timeLeftMs / 1000);
        const mins = Math.floor(totalSecondsLeft / 60);
        const secs = totalSecondsLeft % 60;
        
        // Красивый формат вывода (например, 2:05)
        btn.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    } else {
        // Кулдаун прошел: возвращаем иконку ТВ и включаем кнопку назад
        if (btn.classList.contains('cooldown')) {
            btn.classList.remove('cooldown');
            btn.textContent = '📺';
        }
    }
}

// Запускаем постоянную проверку кулдауна кнопки рекламы (раз в секунду)
setInterval(updateAdsCooldownTimer, 1000);

function getFieldForValue(value) {
    if (value <= 32) return 1;
    if (value >= 64 && value <= 2048) return 2;
    return 3; // Для 4096 и выше
}

// чит-код разработчика
let balanceClicks = 0;
let lastBalanceClickTime = 0;
const balanceBoardElement = document.querySelector('.balance-board');
if (balanceBoardElement) {
    balanceBoardElement.addEventListener('click', () => {
        const currentTime = Date.now();
        if (currentTime - lastBalanceClickTime < 400) {
            balanceClicks++;
        } else {
            balanceClicks = 1;
        }
        lastBalanceClickTime = currentTime;

        if (balanceClicks === 5) {
            balanceClicks = 0;
            if (confirm("⚡ АКТИВАЦИЯ КОДА РАЗРАБОТЧИКА!\n\nСтарый сейв будет исправлен, а на баланс начислится компенсация 20,000,000 $ и 10 💎. Продолжить?")) {
                localStorage.removeItem('clicker_game_save');
                const freshState = {
                    balance: 20000000,
                    diamonds: 10,
                    prices: { 1: 10, 2: 50, 4: 200, 8: 1000, 16: 5000, 32: 20000, 64: 100000, 128: 500000, 256: 2000000, 512: 10000000 },
                    upgrades: { 
                        offline: { level: 0, price: 2, maxLevel: 18 },
                        tier: { level: 0, price: 5, maxLevel: 5 },
                        speed: { level: 0, price: 1, maxLevel: 7 },
                        crit: { level: 0, price: 1, maxLevel: 20 }
                    },
                    cards: [
                        { value: 4, left: "20%", top: "30%" },
                        { value: 4, left: "60%", top: "40%" }
                    ],
                    unlockedItems: [1, 2, 4],
                    discoveredCards: [1, 2, 4],
                    lastSaveTime: Date.now(),
                    lastAdWatchTime: 0
                };
                localStorage.setItem('clicker_game_save', JSON.stringify(freshState));
                location.reload();
            }
        }
    });
}



function spawnFloatingText(text, leftStyle, topStyle, isPassive = false, isCrit = false) {
    const fText = document.createElement('div');
    fText.className = 'floating-text' + (isPassive ? ' passive' : '');

    // Определяем правильный класс для анимации текста
    if (isCrit) fText.className = 'floating-text crit-text';
    else fText.className = 'floating-text' + (isPassive ? ' passive' : '');

    fText.textContent = text;
    fText.style.left = `calc(${leftStyle} + 12px)`;
    fText.style.top = `calc(${topStyle} - 10px)`;
    sandbox.appendChild(fText);
    setTimeout(() => { fText.remove(); }, isPassive ? 1200 : 800);
}

function calculatePPS() {
    let totalValue = 0;

    // Считаем карточки на текущем экране
    const activeCards = document.querySelectorAll('.drag-item:not(.absorb-anim)');
    activeCards.forEach(card => { totalValue += Number(card.getAttribute('data-value')); });

    // Достаем из памяти карты остальных (скрытых) полей, чтобы учесть их доход
    const savedData = localStorage.getItem('clicker_game_save');
    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            if (parsed.cardsByFields) {
                Object.keys(parsed.cardsByFields).forEach(fieldKey => {
                    // Пропускаем текущее поле, так как его карты мы уже посчитали выше вживую
                    if (fieldKey !== `field_${currentField}`) {
                        parsed.cardsByFields[fieldKey].forEach(c => totalValue += c.value);
                    }
                });
            }
        } catch(e) {}
    }

    let pps = totalValue / (PASSIVE_INCOME_INTERVAL / 1000);

    // ЕСЛИ ЗОЛОТОЙ ВЕК АКТИВЕН — УМНОЖАЕМ ВЕСЬ ДОХОД В СЕКУНДУ НА 2!
    if (doubleIncomeUntil > Date.now()) {
        pps = pps * 2;
    }

    ppsValueEl.textContent = formatNumber(Number(pps.toFixed(1)));
}

function updateDoubleIncomeTimerUI() {
    let ppsCounterEl = document.querySelector('.pps-counter');
    if (!ppsCounterEl) return;

    let timerEl = document.getElementById('gold-boost-timer');
    const timeLeftMs = doubleIncomeUntil - Date.now();

    if (timeLeftMs > 0) {
        // Если буст активен, а тега еще нет на экране — создаем его
        if (!timerEl) {
            timerEl = document.createElement('div');
            timerEl.id = 'gold-boost-timer';
            timerEl.className = 'double-income-timer';
            ppsCounterEl.parentNode.appendChild(timerEl);
        }

        // Переводим миллисекунды в формат ЧЧ:ММ:СС
        const totalSecs = Math.floor(timeLeftMs / 1000);
        const hours = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;

        const pad = (num) => num < 10 ? '0' + num : num;
        timerEl.textContent = `⚡ х2 Доход: ${pad(hours)}:${pad(mins)}:${pad(secs)}`;
    } else {
        // Если время вышло — удаляем таймер с экрана
        if (timerEl) {
            timerEl.remove();
            calculatePPS(); // Пересчитываем доход обратно в нормальный режим
        }
    }
}

// Запускаем ежесекундное обновление золотого таймера
setInterval(updateDoubleIncomeTimerUI, 1000);

function collectPassiveIncome() {
    const activeCards = document.querySelectorAll('.drag-item:not(.absorb-anim)');
    let totalPassiveTurn = 0;

    activeCards.forEach(card => {
        const cardValue = Number(card.getAttribute('data-value'));
        totalPassiveTurn += cardValue;
        
        // Всплывающий текст тоже покажет х2 сумму, если буст активен
        const isDouble = doubleIncomeUntil > Date.now();
        spawnFloatingText(`+${formatNumber(isDouble ? cardValue * 2 : cardValue)}`, card.style.left, card.style.top, true);
    });

    if (totalPassiveTurn > 0) {
        // Умножаем итоговое начисление на баланс
        if (doubleIncomeUntil > Date.now()) {
            totalPassiveTurn = totalPassiveTurn * 2;
        }
        updateBalance(totalPassiveTurn);
        saveGame();
    }
}

function updateCardColorClass(cardElement, value) {
    cardElement.className = cardElement.className
        .split(' ')
        .filter(c => !c.startsWith('val-'))
        .join(' ');

    const knownValues = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096];
    if (knownValues.includes(value)) {
        cardElement.classList.add(`val-${value}`);
    } else {
        cardElement.classList.add('val-high');
    }
}

function updateBalance(amount) {
    balance += amount;
    balanceValueEl.textContent = formatNumber(balance);
    checkShopButtons();
    checkUpgradeButtons(); 
}

function checkShopButtons() {
    Object.keys(prices).forEach(val => {
        const btn = document.getElementById(`buy-${val}-btn`);
        if (btn) btn.disabled = balance < prices[val];
    });
}

function getRandomPercent(min, max) { return Math.random() * (max - min) + min; }

function getRandomSpawnValue() {
    const rand = Math.random();
    let baseValue = 1;
    
    if (rand < 0.5) baseValue = 1;       
    else if (rand < 0.8) baseValue = 2;       
    else baseValue = 4;                       

    const multiplier = Math.pow(2, upgrades.tier.level);
    return baseValue * multiplier;
}

function createCard(value, customLeft = null, customTop = null, playSpawnAnim = true) {
    const currentCardsCount = document.querySelectorAll('.drag-item:not(.absorb-anim)').length;
    if (currentCardsCount >= MAX_CARDS) return false; 

    const item = document.createElement('div');
    item.id = `item-${cardCounter++}`;
    item.className = 'drag-item drop-zone';
    item.setAttribute('draggable', 'true');
    item.setAttribute('data-value', value);
    item.textContent = value; 

    updateCardColorClass(item, value);
    
    if (playSpawnAnim) {
        item.classList.add('spawn-anim');
        setTimeout(() => { item.classList.remove('spawn-anim'); }, 400);
    }

    item.style.left = customLeft ? customLeft : `${getRandomPercent(5, 75)}%`;
    item.style.top = customTop ? customTop : `${getRandomPercent(5, 80)}%`;

    let isMoving = false;
    let touchStartTime = 0;

    // === МОБИЛЬНЫЕ ТАЧ-СОБЫТИЯ ===
    item.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        const rect = item.getBoundingClientRect();
        offsetX = touch.clientX - rect.left;
        offsetY = touch.clientY - rect.top;
        touchStartTime = Date.now();
        isMoving = false;
        item.classList.add('dragging');
    }, { passive: true });

    item.addEventListener('touchmove', (e) => {
        if (e.cancelable) e.preventDefault(); 
        isMoving = true;
        const touch = e.touches[0];
        const containerRect = sandbox.getBoundingClientRect();
        
        let newLeft = touch.clientX - containerRect.left - offsetX;
        let newTop = touch.clientY - containerRect.top - offsetY;
        
        const maxLeft = sandbox.clientWidth - item.offsetWidth;
        const maxTop = sandbox.clientHeight - item.offsetHeight;
        
        if (newLeft < 0) newLeft = 0;
        if (newTop < 0) newTop = 0;
        if (newLeft > maxLeft) newLeft = maxLeft;
        if (newTop > maxTop) newTop = maxTop;
        
        item.style.left = `${newLeft}px`;
        item.style.top = `${newTop}px`;
        
        document.querySelectorAll('.drag-item').forEach(c => c.classList.remove('hovered'));
        
        const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
        if (elementUnderTouch && elementUnderTouch.classList.contains('drag-item') && elementUnderTouch !== item) {
            elementUnderTouch.classList.add('hovered');
        }
    }, { passive: false });

    item.addEventListener('touchend', (e) => {
        item.classList.remove('dragging');
        const touchDuration = Date.now() - touchStartTime;
        
        // МОБИЛЬНЫЙ ТАП ПО КАРТОЧКЕ — Включаем clickSound, считаем КРИТ и х2 буст
        if (touchDuration < 250 && !isMoving) {
            const cardValue = Number(item.getAttribute('data-value'));
            
            // Проверяем, активен ли Золотой Век прямо сейчас
            const isGoldAge = doubleIncomeUntil > Date.now();
            // Базовое золото за клик (удваивается, если буст тикает)
            const baseClickValue = isGoldAge ? cardValue * 2 : cardValue;
            
            // Расчет критического удара
            const critChance = (upgrades.crit ? upgrades.crit.level : 0) * 5; 
            const isCritHit = (Math.random() * 100) < critChance;
            
            if (isCritHit) {
                // Если выпал КРИТ, умножаем уже увеличенное бустом базовое золото на 10!
                const critValue = baseClickValue * 10;
                updateBalance(critValue);
                spawnFloatingText(`+${formatNumber(critValue)} $`, item.style.left, item.style.top, false, true);
            } else {
                updateBalance(baseClickValue);
                spawnFloatingText(`+${formatNumber(baseClickValue)} $`, item.style.left, item.style.top);
            }
            
            clickSound.currentTime = 0;
            clickSound.play().catch(err => console.log(err));
            
            item.classList.add('click-anim');
            setTimeout(() => { item.classList.remove('click-anim'); }, 150);
            saveGame();
            return;
        }
        
        const changedTouch = e.changedTouches[0];
        const currentLeftPx = parseFloat(item.style.left);
        const currentTopPx = parseFloat(item.style.top);
        const leftPercent = (currentLeftPx / sandbox.clientWidth) * 100;
        const topPercent = (currentTopPx / sandbox.clientHeight) * 100;
        
        item.style.left = `${leftPercent}%`;
        item.style.top = `${topPercent}%`;
        
        item.style.display = 'none';
        const targetElement = document.elementFromPoint(changedTouch.clientX, changedTouch.clientY);
        item.style.display = 'flex'; 
        
        if (targetElement && targetElement.classList.contains('drag-item') && targetElement !== item && targetElement.textContent === item.textContent) {
            targetElement.classList.remove('hovered');
            handleCardsMerge(targetElement, item); 
        } else {
            document.querySelectorAll('.drag-item').forEach(c => c.classList.remove('hovered'));
            saveGame();
        }
    });

    // === ДЕСКТОПНЫЕ СОБЫТИЯ МЫШИ (ПК) ===
    item.addEventListener('mousedown', (e) => {
        const rect = item.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
    });

    item.addEventListener('click', (e) => {
        item.classList.add('click-anim');
        setTimeout(() => { item.classList.remove('click-anim'); }, 150);
        const cardValue = Number(item.getAttribute('data-value'));
        
        // Проверяем, активен ли Золотой Век для ПК
        const isGoldAge = doubleIncomeUntil > Date.now();
        const baseClickValue = isGoldAge ? cardValue * 2 : cardValue;
        
        // Расчет критического удара для ПК
        const critChance = (upgrades.crit ? upgrades.crit.level : 0) * 5;
        const isCritHit = (Math.random() * 100) < critChance;
        
        if (isCritHit) {
            const critValue = baseClickValue * 10;
            updateBalance(critValue);
            spawnFloatingText(`+${formatNumber(critValue)} $`, item.style.left, item.style.top, false, true);
        } else {
            updateBalance(baseClickValue);
            spawnFloatingText(`+${formatNumber(baseClickValue)} $`, item.style.left, item.style.top);
        }
        
        // КЛИК НА ПК — Включаем clickSound
        clickSound.currentTime = 0;
        clickSound.play().catch(err => console.log(err));
        
        calculatePPS(); 
        saveGame(); 
    });


    item.addEventListener('dragstart', (e) => {
        item.classList.add('dragging');
        e.dataTransfer.setData('text/plain', item.id);
        e.dataTransfer.setData('offsetX', offsetX);
        e.dataTransfer.setData('offsetY', offsetY);
    });

    item.addEventListener('dragend', () => { item.classList.remove('dragging'); });
    item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!item.classList.contains('dragging')) { item.classList.add('hovered'); }
    });
    item.addEventListener('dragleave', () => { item.classList.remove('hovered'); });

    item.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        item.classList.remove('hovered');
        const draggedId = e.dataTransfer.getData('text/plain');
        const draggedElement = document.getElementById(draggedId);
        if (draggedElement && draggedElement !== item && draggedElement.textContent === item.textContent) {
            handleCardsMerge(item, draggedElement);
        }
    });

    // Проверяем, соответствует ли создаваемая карта текущему экрану поля
    const targetField = getFieldForValue(value);
    
    // Привязываем номер поля к самому HTML-элементу карточки
    item.setAttribute('data-field', targetField);

    // Если карта создана для другого поля, не добавляем её на текущий экран
    if (targetField !== currentField) {
        // Мы вернем true, чтобы логика покупки/спавна сработала, но на экран её не выводим
        calculatePPS();
        return true; 
    }

    sandbox.appendChild(item);
    calculatePPS(); 
    return true;
}

function handleCardsMerge(targetCard, sourceCard) {
    const value1 = Number(targetCard.getAttribute('data-value'));
    const value2 = Number(sourceCard.getAttribute('data-value'));
    const totalSum = value1 + value2;

    sourceCard.classList.add('absorb-anim');
    sourceCard.style.left = targetCard.style.left;
    sourceCard.style.top = targetCard.style.top;

    setTimeout(() => { 
        sourceCard.remove(); 
        calculatePPS(); 
    }, 200);

    targetCard.setAttribute('data-value', totalSum);
    targetCard.textContent = totalSum;

    // Сначала регистрируем открытие новой карты в игре
    checkCardUnlocks(totalSum);

    // === ИСПРАВЛЕННЫЙ БЛОК АВТОПЕРЕНОСА КАРТЫ ===
    const correctField = getFieldForValue(totalSum);
    const currentCardField = Number(targetCard.getAttribute('data-field'));

    if (correctField !== currentCardField) {
        targetCard.classList.add('absorb-anim');
        
        // Нам нужно вытащить текущие сохранения, чтобы дописать карту на другое поле
        let allFieldsCards = { field_1: [], field_2: [], field_3: [] };
        const savedData = localStorage.getItem('clicker_game_save');
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                if (parsed.cardsByFields) allFieldsCards = parsed.cardsByFields;
            } catch(e) {}
        }

        // ЖЕСТКО ЗАПИСЫВАЕМ КАРТУ В ПРАВИЛЬНОЕ ПОЛЕ В ПАМЯТЬ!
        const targetFieldKey = `field_${correctField}`;
        allFieldsCards[targetFieldKey].push({
            value: totalSum,
            left: `${getRandomPercent(5, 75)}%`, // Даем ей случайные координаты на новом поле
            top: `${getRandomPercent(5, 80)}%`
        });

        // Срочно удаляем её с текущего экрана и сохраняем обновленную базу данных
        setTimeout(() => {
            targetCard.remove();
            
            // Сохраняем все поля, учитывая добавленную карту
            const currentFieldKey = `field_${currentField}`;
            allFieldsCards[currentFieldKey] = [];
            const remainingCards = document.querySelectorAll('.drag-item:not(.absorb-anim)');
            remainingCards.forEach(card => {
                allFieldsCards[currentFieldKey].push({
                    value: Number(card.getAttribute('data-value')),
                    left: card.style.left,
                    top: card.style.top
                });
            });

            const gameState = { 
                balance: balance, 
                diamonds: diamonds,
                prices: prices, 
                upgrades: upgrades,
                cardsByFields: allFieldsCards,
                currentField: currentField,
                unlockedItems: unlockedItems,
                discoveredCards: discoveredCards,
                lastSaveTime: Date.now(),
                lastAdWatchTime: lastAdWatchTime
            };
            localStorage.setItem('clicker_game_save', JSON.stringify(gameState));
            
            calculatePPS();
            
            // Обновляем визуальные замочки на вкладках прямо сейчас
            updateFieldTabsUI();
            
            alert(`🎉 Карточка ${formatNumber(totalSum)} успешно отправлена на Поле ${correctField}!`);
        }, 200);
        
        // Начисляем деньги за слияние
        const mergeBonus = totalSum * 5;
        updateBalance(mergeBonus);
        spawnFloatingText(`+${formatNumber(mergeBonus)} $`, targetCard.style.left, targetCard.style.top);
        
        mergeSound.currentTime = 0;
        mergeSound.play().catch(error => console.log(error));
        return; 
    }
    // === КОНЕЦ БЛОКА АВТОПЕРЕНОСА ===

    // Обычное слияние карт внутри одного поля (ваш старый код)
    const mergeBonus = totalSum * 5;
    updateBalance(mergeBonus);
    spawnFloatingText(`+${formatNumber(mergeBonus)} $`, targetCard.style.left, targetCard.style.top);

    mergeSound.currentTime = 0;
    mergeSound.play().catch(error => console.log(error));

    targetCard.classList.add('merge-pulse-anim');
    targetCard.style.backgroundColor = '#2ecc71';
    
    setTimeout(() => { 
        targetCard.style.backgroundColor = ''; 
        updateCardColorClass(targetCard, totalSum);
        targetCard.classList.remove('merge-pulse-anim');
        calculatePPS();
        saveGame(); 
    }, 300);
}

function updateFieldTabsUI() {
    // Поле 2 открывается, если открыта хотя бы "64"
    const tab2 = document.getElementById('tab-field-2');
    if (tab2 && discoveredCards.some(val => val >= 64)) {
        tab2.disabled = false;
        tab2.classList.remove('locked-tab');
        tab2.innerHTML = `Поле 2 <span class="tab-range">(64-2к)</span>`;
    }
    // Поле 3 открывается, если открыта хотя бы "4096"
    const tab3 = document.getElementById('tab-field-3');
    if (tab3 && discoveredCards.some(val => val >= 4096)) {
        tab3.disabled = false;
        tab3.classList.remove('locked-tab');
        tab3.innerHTML = `Поле 3 <span class="tab-range">(4к+)</span>`;
    }
}

function switchField(fieldNumber) {
    if (fieldNumber === currentField) return;

    // Сначала принудительно сохраняем всё, что сейчас есть на экране
    saveGame();

    // Меняем номер текущего активного поля
    currentField = fieldNumber;

    // Переключаем классы активности у кнопок вкладок
    for (let i = 1; i <= 3; i++) {
        const tab = document.getElementById(`tab-field-${i}`);
        if (tab) {
            if (i === currentField) tab.classList.add('active');
            else tab.classList.remove('active');
        }
    }

    // Полностью очищаем игровое поле от старых карточек
    sandbox.innerHTML = '';

    // Перезагружаем игру из памяти, чтобы loadGame отрисовал только карты для нового поля
    setTimeout(() => {loadGame();}, 20);
}

function autoSpawn() {
    const value = getRandomSpawnValue();
    const success = createCard(value);
    if (success) {
        checkCardUnlocks(value);
        saveGame(); 
    }
}

function buyCard(value) {
    const currentPrice = prices[value];
    if (balance < currentPrice) return;

    // Проверяем, какому полю принадлежит покупаемая карта
    const targetField = getFieldForValue(value);

    if (targetField === currentField) {
        // Ситуация А: Карта покупается для ТЕКУЩЕГО поля. Создаем как обычно на экране.
        const success = createCard(value);
        if (success) {
            updateBalance(-currentPrice);
            prices[value] = Math.round(currentPrice * 1.15);
            document.getElementById(`price-${value}`).textContent = formatNumber(prices[value]);
            
            buySound.currentTime = 0;
            buySound.play().catch(err => console.log(err));

            checkShopButtons();
            saveGame(); 
        }
    } else {
        // Ситуация Б: Карта покупается для СКРЫТОГО поля! Пишем напрямую в базу данных.
        
        // 1. Вытаскиваем текущую базу данных полей из памяти
        let allFieldsCards = { field_1: [], field_2: [], field_3: [] };
        const savedData = localStorage.getItem('clicker_game_save');
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                if (parsed.cardsByFields) allFieldsCards = parsed.cardsByFields;
            } catch(e) {}
        }

        // Прямо перед созданием проверяем глобальный лимит карт на том скрытом поле
        const targetFieldKey = `field_${targetField}`;
        if (allFieldsCards[targetFieldKey].length >= MAX_CARDS) return;

        // 2. Списываем деньги и увеличиваем цену товара в магазине
        updateBalance(-currentPrice);
        prices[value] = Math.round(currentPrice * 1.15);
        document.getElementById(`price-${value}`).textContent = formatNumber(prices[value]);

        // 3. Добавляем новую карту в массив скрытого поля со случайными координатами
        allFieldsCards[targetFieldKey].push({
            value: value,
            left: `${getRandomPercent(5, 75)}%`,
            top: `${getRandomPercent(5, 80)}%`
        });

        // 4. Фиксируем открытие карты, если игрок купил её впервые
        checkCardUnlocks(value);

        // 5. Пересобираем и сохраняем глобальный стейт игры
        const gameState = { 
            balance: balance, 
            diamonds: diamonds,
            prices: prices, 
            upgrades: upgrades,
            cardsByFields: allFieldsCards,
            currentField: currentField,
            unlockedItems: unlockedItems,
            discoveredCards: discoveredCards,
            lastSaveTime: Date.now(),
            lastAdWatchTime: lastAdWatchTime
        };
        localStorage.setItem('clicker_game_save', JSON.stringify(gameState));

        // Включаем звук успешной покупки
        buySound.currentTime = 0;
        buySound.play().catch(err => console.log(err));

        calculatePPS(); // Доход обновится, так как он считает и скрытые карты
        checkShopButtons();
    }
}

// Функция автоматической генерации сетки альбома коллекции с разделением по этапам
function renderCollectionGrid() {
    const gridContainer = document.getElementById('collection-grid-container');
    if (!gridContainer) return;

    // Полностью очищаем сетку перед созданием
    gridContainer.innerHTML = '';

    // Берем все номиналы строго по порядку из нашей базы данных
    const allNominals = Object.keys(CARDS_DATABASE).map(Number).sort((a, b) => a - b);

    allNominals.forEach((value, index) => {
        // === ВИЗУАЛЬНОЕ РАЗДЕЛЕНИЕ ПО 6 КАРТОЧЕК ===
        // Перед самой первой карточкой (индекс 0) вставляем заголовок первого поля
        if (index === 0) {
            const header = document.createElement('div');
            header.className = 'collection-stage-title';
            header.textContent = "ПОЛЕ 1 • НАЧАЛО ПУТИ";
            gridContainer.appendChild(header);
        }
        // Перед седьмой карточкой (индекс 6) вставляем заголовок второго поля
        else if (index === 6) {
            const header = document.createElement('div');
            header.className = 'collection-stage-title';
            header.textContent = "ПОЛЕ 2 • ПРОДВИНУТЫЙ УРОВЕНЬ";
            gridContainer.appendChild(header);
        }
        // Перед тринадцатой карточкой (индекс 12) вставляем заголовок третьего поля
        else if (index === 12) {
            const header = document.createElement('div');
            header.className = 'collection-stage-title';
            header.textContent = "ПОЛЕ 3 • ВЫСШАЯ ЛИГА";
            gridContainer.appendChild(header);
        }

        // Создаем сам слот для карточки (этот код у тебя уже был)
        const slot = document.createElement('div');
        slot.className = 'collection-slot';

        const isDiscovered = discoveredCards.includes(value);

        if (isDiscovered) {
            slot.classList.add(`val-${value}`);
            slot.onclick = () => openCardDetails(value);
        } else {
            slot.classList.add('locked-card');
        }

        gridContainer.appendChild(slot);
    });
}

// Функция открытия детального поповера с твоим описанием
function openCardDetails(value) {
    const cardData = CARDS_DATABASE[value];
    if (!cardData) return;

    const detailsPopup = document.getElementById('card-details-popup');
    const detailsName = document.getElementById('details-card-name');
    const detailsValue = document.getElementById('details-card-value');
    const detailsImage = document.getElementById('details-card-image');
    const detailsDesc = document.getElementById('details-card-desc');

    if (detailsPopup && detailsName && detailsValue && detailsImage && detailsDesc) {
        // Подставляем название и номинал
        detailsName.textContent = cardData.name.toUpperCase();
        detailsValue.textContent = `Номинал: ${formatNumber(value)}`;
        
        // Подставляем описание
        detailsDesc.textContent = cardData.desc;
        
        // Красим блок превью в класс нашей карточки, чтобы там отобразилась нужная картинка
        detailsImage.className = 'drag-item-preview'; // сброс старых классов
        updateCardColorClass(detailsImage, value);

        // Открываем поповер поверх коллекции
        detailsPopup.showPopover();
    }
}

// НАСТОЯЩИЙ ИНТЕРНЕТ-АДРЕС ТВОЕГО СЕРВЕРА (Замени на свой адрес от Render!)
const SERVER_URL = "https://server-ae7b.onrender.com"; 

async function renderLeaderboard() {
    const container = document.getElementById('leaderboard-list-container');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center; color:#7f8c8d; font-size:14px; padding:10px;">Связь с сервером...</div>';

    try {
        const response = await fetch(`${SERVER_URL}/api/score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: tgUsername,
                score: balance
            })
        });

        if (!response.ok) throw new Error('Ошибка сервера');
        
        const data = await response.json();
        const serverLeaderboard = data.leaderboard || [];

        container.innerHTML = '';
        const medals = ["🥇", "🥈", "🥉"];

        // 1. Сначала находим, на каком строгом месте находится текущий игрок во всей базе
        const myActualIndex = serverLeaderboard.findIndex(p => p.name === tgUsername);
        const isInTop10 = myActualIndex >= 0 && myActualIndex < 10;

        // 2. Отрисовываем только ТОП-10 игроков
        serverLeaderboard.forEach((player, index) => {
            if (index >= 10) return; // Пропускаем всех, кто ниже 10 места

            const row = document.createElement('div');
            const isItMe = player.name === tgUsername;
            row.className = 'leaderboard-row' + (isItMe ? ' user-row' : '');

            const placeIcon = index < 3 ? medals[index] : `${index + 1}`;

            row.innerHTML = `
                <span class="leader-place">${placeIcon}</span>
                <span class="leader-name">${player.name} ${isItMe ? '(Вы)' : ''}</span>
                <span class="leader-score">${formatNumber(player.score)} $</span>
            `;
            container.appendChild(row);
        });

        // 3. ЕСЛИ ТЕБЯ НЕТ В ТОП-10 — ПРИРИСОВЫВАЕМ ТЕБЯ СНИЗУ ОТДЕЛЬНОЙ СТРОКОЙ!
        if (!isInTop10 && myActualIndex !== -1) {
            // Создаем красивую пунктирную линию разделения
            const divider = document.createElement('div');
            divider.style.textAlign = 'center';
            divider.style.color = '#94a3b8';
            divider.style.fontSize = '11px';
            divider.style.margin = '8px 0';
            divider.style.letterSpacing = '2px';
            divider.textContent = '• • • • • • • • •';
            container.appendChild(divider);

            // Создаем персональную строчку игрока под ТОП-10
            const myPlayer = serverLeaderboard[myActualIndex];
            const myRow = document.createElement('div');
            myRow.className = 'leaderboard-row user-row'; // Золотая плашка

            myRow.innerHTML = `
                <span class="leader-place" style="font-size:13px; color:#7f8c8d;">#${myActualIndex + 1}</span>
                <span class="leader-name">${myPlayer.name} (Вы)</span>
                <span class="leader-score">${formatNumber(myPlayer.score)} $</span>
            `;
            container.appendChild(myRow);
        }

    } catch (error) {
        console.error("Не удалось загрузить онлайн-топ:", error);
        container.innerHTML = `<div style="text-align:center; color:#c0392b; font-size:12px; padding:10px;">❌ Ошибка сети.<br>${error.message}</div>`;
    }
}

// Привязываем автоматическое обновление топа строго при ОТКРЫТИИ поповера
const leaderboardPopupEl = document.getElementById('leaderboard-popup');
if (leaderboardPopupEl) {
    leaderboardPopupEl.addEventListener('beforetoggle', (event) => {
        if (event.newState === 'open') {
            renderLeaderboard();
        }
    });
}

// Связываем открытие поповера коллекции с автоматической перерисовкой сетки
const collectionPopupEl = document.getElementById('collection-popup');
if (collectionPopupEl) {
    collectionPopupEl.addEventListener('beforetoggle', (event) => {
        // Рендерим сетку только в момент, когда поповер именно ОТКРЫВАЕТСЯ
        if (event.newState === 'open') {
            renderCollectionGrid();
        }
    });
}

sandbox.addEventListener('dragover', (e) => { e.preventDefault(); });
sandbox.addEventListener('drop', (e) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    const draggedElement = document.getElementById(draggedId);

    if (draggedElement && !draggedElement.classList.contains('absorb-anim')) {
        const dragOffsetX = Number(e.dataTransfer.getData('offsetX'));
        const dragOffsetY = Number(e.dataTransfer.getData('offsetY'));
        const containerRect = sandbox.getBoundingClientRect();

        let newLeft = e.clientX - containerRect.left - dragOffsetX;
        let newTop = e.clientY - containerRect.top - dragOffsetY;

        const maxLeft = sandbox.clientWidth - draggedElement.offsetWidth;
        const maxTop = sandbox.clientHeight - draggedElement.offsetHeight;

        if (newLeft < 0) newLeft = 0;
        if (newTop < 0) newTop = 0;
        if (newLeft > maxLeft) newLeft = maxLeft;
        if (newTop > maxTop) newTop = maxTop;

        draggedElement.style.left = `${(newLeft / sandbox.clientWidth) * 100}%`;
        draggedElement.style.top = `${(newTop / sandbox.clientHeight) * 100}%`;
        
        saveGame(); 
    }
});

// === 🔊 АВТОМАТИЧЕСКАЯ ОЗВУЧКА ОТКРЫТИЯ/ЗАКРЫТИЯ ОКОН ===
['shop', 'upgrades-shop', 'ads-choice-popup'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('beforetoggle', () => {
            openSound.currentTime = 0;
            openSound.play().catch(err => console.log(err));
        });
    }
});

// === ЗАПУСК ИГРЫ ===
refreshShopVisibility();
updateUpgradeUI();
const loaded = loadGame();
if (!loaded) autoSpawn();
setInterval(updateTimerIndicator, timerStep);
setInterval(collectPassiveIncome, PASSIVE_INCOME_INTERVAL);