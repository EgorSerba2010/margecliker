const sandbox = document.getElementById('sandbox');
const balanceValueEl = document.getElementById('balance-value');
const ppsValueEl = document.getElementById('pps-value');
const timerRing = document.getElementById('timer-ring');
const diamondsValueEl = document.getElementById('diamonds-value');

const clickSound = new Audio('click.mp3'); // кликаешь на карточку
const mergeSound = new Audio('merge.mp3'); // соединяешь карточки
const buySound = new Audio('buy.mp3'); // покупаешь что-то
const openSound = new Audio('open.mp3'); // открываешь и закрываешь магазин и улучшения
const congratsSound = new Audio('congrats.mp3'); // новая карточка открыта

// Игровые настройки
const BASE_SPAWN_INTERVAL = 10000; 
const MAX_CARDS = 32; 
const PASSIVE_INCOME_INTERVAL = 4000; 
const BASE_MAX_OFFLINE_TIME = 3600; // 1 час

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

// === ОБНОВЛЕННЫЕ ДАННЫЕ УЛУЧШЕНИЙ С МАКСИМАЛЬНЫМ УРОВНЕМ ===
let upgrades = {
    offline: {
        level: 0,
        price: 2,
        maxLevel: 18 // Ограничение: максимум 18 уровень
    },
    tier: {
        level: 0,
        price: 5,   // Твоя цена: всегда 5 алмазов
        maxLevel: 5  // Ограничение: максимум 5 уровень
    },
    speed: {
        level: 0,
        price: 2,
        maxLevel: 7
    }
};

let unlockedItems = [1, 2, 4];
let discoveredCards = [1, 2, 4]; 

let balance = 100;
let diamonds = 0;

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

// Проверка доступности фиолетовых кнопок улучшений с учетом МАКСИМАЛЬНОГО УРОВНЯ
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
}

// Обновление текста, уровней и цен в интерфейсе улучшений
function updateUpgradeUI() {
    // 1. Оффлайн-буст
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

    // 2. Тир-буст (Эволюция спавна)
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

    // 3. Спид-буст (Конвейер карт)
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

    checkUpgradeButtons();
}

// УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ПОКУПКИ УЛУЧШЕНИЙ БЕЗ ИНФЛЯЦИИ ЦЕНЫ
function buyUpgrade(type) {
    if (!upgrades[type]) return;

    const data = upgrades[type];
    
    if (data.level < data.maxLevel && diamonds >= data.price) {
        diamonds -= data.price;
        data.level += 1; // Увеличиваем уровень, фиксированная цена сохраняется!

        if (diamondsValueEl) diamondsValueEl.textContent = formatNumber(diamonds);
        updateUpgradeUI();
        checkShopButtons();
        saveGame();
    }
}

['shop', 'upgrades-shop'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('beforetoggle', () => {
            openSound.currentTime = 0;
            openSound.play().catch(err => console.log(err));
        });
    }
});

function saveGame() {
    const cardsData = [];
    const activeCards = document.querySelectorAll('.drag-item:not(.absorb-anim)');
    
    activeCards.forEach(card => {
        cardsData.push({
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
        cards: cardsData,
        unlockedItems: unlockedItems,
        discoveredCards: discoveredCards,
        lastSaveTime: Date.now()
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

            // Безопасное восстановление уровней апгрейдов из сохранения
            if (gameState.upgrades) {
                upgrades.offline.level = gameState.upgrades.offline ? gameState.upgrades.offline.level : 0;
                if (gameState.upgrades.tier) upgrades.tier.level = gameState.upgrades.tier.level;
                // Страховка: если у игрока старый сейв, где не было спид-буста, ставим 0
                if (gameState.upgrades.speed) upgrades.speed.level = gameState.upgrades.speed.level;
            }
            updateUpgradeUI();

            if (gameState.unlockedItems) unlockedItems = gameState.unlockedItems;
            if (gameState.discoveredCards) discoveredCards = gameState.discoveredCards;
            
            Object.keys(prices).forEach(val => {
                const priceEl = document.getElementById(`price-${val}`);
                if (priceEl) priceEl.textContent = formatNumber(prices[val]);
            });

            refreshShopVisibility();

            sandbox.innerHTML = '';
            gameState.cards.forEach(cardInfo => {
                createCard(cardInfo.value, cardInfo.left, cardInfo.top, false); 
            });
            
            calculatePPS();
            checkShopButtons();

            // РАСЧЕТ ОФФЛАЙН ДОХОДА
            if (gameState.lastSaveTime) {
                const timeDiffMs = Date.now() - gameState.lastSaveTime;
                let secondsPassed = Math.floor(timeDiffMs / 1000);

                if (secondsPassed > 10) {
                    let totalValue = 0;
                    gameState.cards.forEach(c => totalValue += c.value);
                    const currentPPS = totalValue / (PASSIVE_INCOME_INTERVAL / 1000);

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
            return true;
        } catch (e) {
            console.error(e);
        }
    }
    return false; 
}

function hardResetGame() {
    if (confirm("Вы уверены, что хотите полностью обнулить игру и удалить сохранение?")) {
        localStorage.removeItem('clicker_game_save');
        location.reload();
    }
}

// === ОБНОВЛЕННАЯ ДИНАМИЧЕСКАЯ ИНДИКАЦИЯ ТАЙМЕРА СПАВНА ===
function updateTimerIndicator() {
    timePassed += timerStep;

    // Считаем текущий интервал: базовые 10 сек минус 1 сек за каждый уровень буста
    const currentSpawnInterval = BASE_SPAWN_INTERVAL - (upgrades.speed.level * 1000);

    const progress = Math.min(timePassed / currentSpawnInterval, 1);
    const offset = circleCircumference - (progress * circleCircumference);
    timerRing.style.strokeDashoffset = offset;

    if (timePassed >= currentSpawnInterval) {
        timePassed = 0;
        autoSpawn();
    }
}

function spawnFloatingText(text, leftStyle, topStyle, isPassive = false) {
    const fText = document.createElement('div');
    fText.className = 'floating-text' + (isPassive ? ' passive' : '');
    fText.textContent = text;
    fText.style.left = `calc(${leftStyle} + 12px)`;
    fText.style.top = `calc(${topStyle} - 10px)`;
    sandbox.appendChild(fText);
    setTimeout(() => { fText.remove(); }, isPassive ? 1200 : 800);
}

function calculatePPS() {
    const activeCards = document.querySelectorAll('.drag-item:not(.absorb-anim)');
    let totalValue = 0;
    activeCards.forEach(card => { totalValue += Number(card.getAttribute('data-value')); });
    const pps = totalValue / (PASSIVE_INCOME_INTERVAL / 1000);
    ppsValueEl.textContent = formatNumber(Number(pps.toFixed(1)));
}

function collectPassiveIncome() {
    const activeCards = document.querySelectorAll('.drag-item:not(.absorb-anim)');
    let totalPassiveTurn = 0;

    activeCards.forEach(card => {
        const cardValue = Number(card.getAttribute('data-value'));
        totalPassiveTurn += cardValue;
        spawnFloatingText(`+${formatNumber(cardValue)}`, card.style.left, card.style.top, true);
    });

    if (totalPassiveTurn > 0) {
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

// === ИСПРАВЛЕННАЯ МАТЕМАТИКА ЭВОЛЮЦИИ ТИРОВ ===
function getRandomSpawnValue() {
    const rand = Math.random();
    let baseValue = 1;
    
    // Твои вероятности: 50%, 30%, 20%
    if (rand < 0.5) baseValue = 1;       
    else if (rand < 0.8) baseValue = 2;       
    else baseValue = 4;                       

    // Умножаем базу на 2 в степени уровня буста (уровень 0 = х1, уровень 1 = х2, уровень 2 = х4...)
    const multiplier = Math.pow(2, upgrades.tier.level);
    return baseValue * multiplier;
}

// Сбалансированный чит-код разработчика
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
            if (confirm("⚡ АКТИВАЦИЯ КОДА РАЗРАБОТЧИКА!\n\nСтарый сейв будет исправлен, а на баланс начислится компенсация 20,000,000 $ и 100 💎. Продолжить?")) {
                localStorage.removeItem('clicker_game_save');
                const freshState = {
                    balance: 20000000,
                    diamonds: 100, // Твой новый баланс алмазов в чите
                    prices: { 1: 10, 2: 50, 4: 200, 8: 1000, 16: 5000, 32: 20000, 64: 100000, 128: 500000, 256: 2000000, 512: 10000000 },
                    upgrades: { 
                        offline: { level: 0, price: 2, maxLevel: 18 },
                        tier: { level: 0, price: 5, maxLevel: 5 }
                    },
                    cards: [
                        { value: 4, left: "20%", top: "30%" },
                        { value: 4, left: "60%", top: "40%" }
                    ],
                    unlockedItems: [1, 2, 4],
                    discoveredCards: [1, 2, 4],
                    lastSaveTime: Date.now()
                };
                localStorage.setItem('clicker_game_save', JSON.stringify(freshState));
                location.reload();
            }
        }
    });
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
        
        if (touchDuration < 250 && !isMoving) {
            const cardValue = Number(item.getAttribute('data-value'));
            updateBalance(cardValue);
            spawnFloatingText(`+${formatNumber(cardValue)} $`, item.style.left, item.style.top);
            
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
        updateBalance(cardValue);
        spawnFloatingText(`+${formatNumber(cardValue)} $`, item.style.left, item.style.top);
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
        saveGame(); 
    }, 200);

    targetCard.setAttribute('data-value', totalSum);
    targetCard.textContent = totalSum;

    checkCardUnlocks(totalSum);

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
    if (balance >= currentPrice) {
        const success = createCard(value);
        if (success) {
            updateBalance(-currentPrice);
            prices[value] = Math.round(currentPrice * 1.15);
            document.getElementById(`price-${value}`).textContent = formatNumber(prices[value]);
            checkShopButtons();
            saveGame(); 
        }
    }
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

// === ЗАПУСК ИГРЫ ===
refreshShopVisibility();
updateUpgradeUI();
const loaded = loadGame();
if (!loaded) {
    autoSpawn();
}
setInterval(updateTimerIndicator, timerStep);
setInterval(collectPassiveIncome, PASSIVE_INCOME_INTERVAL);