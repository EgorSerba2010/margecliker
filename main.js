const sandbox = document.getElementById('sandbox');
const balanceValueEl = document.getElementById('balance-value');
const ppsValueEl = document.getElementById('pps-value');
const timerRing = document.getElementById('timer-ring');

const mergeSound = new Audio('click.mp3');

// Игровые настройки
const SPAWN_INTERVAL = 10000; 
const MAX_CARDS = 32; 
const PASSIVE_INCOME_INTERVAL = 4000; 

let prices = {
    1: 10,
    2: 30,
    4: 70
};

let balance = 100;

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

    const gameState = { balance: balance, prices: prices, cards: cardsData };
    localStorage.setItem('clicker_game_save', JSON.stringify(gameState));
}

function loadGame() {
    const savedData = localStorage.getItem('clicker_game_save');
    if (savedData) {
        try {
            const gameState = JSON.parse(savedData);
            balance = gameState.balance;
            balanceValueEl.textContent = balance;
            prices = gameState.prices;
            
            [1, 2, 4].forEach(val => {
                document.getElementById(`price-${val}`).textContent = prices[val];
            });

            sandbox.innerHTML = '';
            gameState.cards.forEach(cardInfo => {
                createCard(cardInfo.value, cardInfo.left, cardInfo.top, false); 
            });
            
            calculatePPS();
            checkShopButtons();
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

function updateTimerIndicator() {
    timePassed += timerStep;
    const progress = Math.min(timePassed / SPAWN_INTERVAL, 1);
    const offset = circleCircumference - (progress * circleCircumference);
    timerRing.style.strokeDashoffset = offset;

    if (timePassed >= SPAWN_INTERVAL) {
        timePassed = 0; 
        autoSpawn();    
    }
}

function spawnFloatingText(text, leftStyle, topStyle, isPassive = false) {
    const fText = document.createElement('div');
    fText.className = 'floating-text' + (isPassive ? ' passive' : '');
    fText.textContent = text;
    fText.style.left = `calc(${leftStyle} + 15px)`;
    fText.style.top = `calc(${topStyle} - 10px)`;
    sandbox.appendChild(fText);
    setTimeout(() => { fText.remove(); }, isPassive ? 1200 : 800);
}

function calculatePPS() {
    const activeCards = document.querySelectorAll('.drag-item:not(.absorb-anim)');
    let totalValue = 0;
    activeCards.forEach(card => { totalValue += Number(card.getAttribute('data-value')); });
    const pps = totalValue / (PASSIVE_INCOME_INTERVAL / 1000);
    ppsValueEl.textContent = Number(pps.toFixed(1));
}

function collectPassiveIncome() {
    const activeCards = document.querySelectorAll('.drag-item:not(.absorb-anim)');
    let totalPassiveTurn = 0;

    activeCards.forEach(card => {
        const cardValue = Number(card.getAttribute('data-value'));
        totalPassiveTurn += cardValue;
        spawnFloatingText(`+${cardValue}`, card.style.left, card.style.top, true);
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

    const knownValues = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
    if (knownValues.includes(value)) {
        cardElement.classList.add(`val-${value}`);
    } else {
        cardElement.classList.add('val-high');
    }
}

function updateBalance(amount) {
    balance += amount;
    balanceValueEl.textContent = balance;
    checkShopButtons();
}

function checkShopButtons() {
    [1, 2, 4].forEach(val => {
        const btn = document.getElementById(`buy-${val}-btn`);
        if (btn) btn.disabled = balance < prices[val];
    });
}

function getRandomPercent(min, max) {
    return Math.random() * (max - min) + min;
}

function getRandomSpawnValue() {
    const rand = Math.random();
    if (rand < 0.5) return 1;       
    if (rand < 0.8) return 2;       
    return 4;                       
}




function createCard(value, customLeft = null, customTop = null, playSpawnAnim = true) {
    const currentCardsCount = document.querySelectorAll('.drag-item:not(.absorb-anim)').length;
    if (currentCardsCount >= MAX_CARDS) {
        return false; 
    }

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

    // Переменные для отслеживания тачей и скролла
    let isMoving = false;
    let touchStartTime = 0;

    // === 📱 МОБИЛЬНЫЕ ТАЧ-СОБЫТИЯ ===

    item.addEventListener('touchstart', (e) => {
        // Блокируем стандартный скролл страницы пальцем, когда мы зажали карточку
        e.preventDefault(); 
        
        const touch = e.touches[0];
        const rect = item.getBoundingClientRect();
        
        offsetX = touch.clientX - rect.left;
        offsetY = touch.clientY - rect.top;
        
        touchStartTime = Date.now();
        isMoving = false;
        
        item.classList.add('dragging');
    }, { passive: false });

    item.addEventListener('touchmove', (e) => {
        e.preventDefault();
        isMoving = true;
        
        const touch = e.touches[0];
        const containerRect = sandbox.getBoundingClientRect();
        
        // Считаем координаты пальца относительно белого игрового поля
        let newLeft = touch.clientX - containerRect.left - offsetX;
        let newTop = touch.clientY - containerRect.top - offsetY;
        
        const maxLeft = sandbox.clientWidth - item.offsetWidth;
        const maxTop = sandbox.clientHeight - item.offsetHeight;
        
        // Ограничители краев
        if (newLeft < 0) newLeft = 0;
        if (newTop < 0) newTop = 0;
        if (newLeft > maxLeft) newLeft = maxLeft;
        if (newTop > maxTop) newTop = maxTop;
        
        // Переводим в проценты для лучшей адаптации
        item.style.left = `${(newLeft / sandbox.clientWidth) * 100}%`;
        item.style.top = `${(newTop / sandbox.clientHeight) * 100}%`;
        
        // Очищаем старые ховеры у других элементов перед проверкой нового наведения
        document.querySelectorAll('.drag-item').forEach(c => c.classList.remove('hovered'));
        
        // Умная проверка: проверяем, находится ли палец над другой карточкой
        const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
        if (elementUnderTouch && elementUnderTouch.classList.contains('drag-item') && elementUnderTouch !== item) {
            elementUnderTouch.classList.add('hovered');
        }
    }, { passive: false });

    item.addEventListener('touchend', (e) => {
        item.classList.remove('dragging');
        const touchDuration = Date.now() - touchStartTime;
        
        // КЛИК: Если палец зажали и отпустили быстрее чем за 250мс и карточка почти не двигалась
        if (touchDuration < 250 && !isMoving) {
            const cardValue = Number(item.getAttribute('data-value'));
            updateBalance(cardValue);
            spawnFloatingText(`+${cardValue} $`, item.style.left, item.style.top);
            
            mergeSound.currentTime = 0;
            mergeSound.play().catch(err => console.log(err));
            
            // Запускаем упругий джим и выходим
            item.classList.add('click-anim');
            setTimeout(() => { item.classList.remove('click-anim'); }, 150);
            saveGame();
            return;
        }
        
        // ПЕРЕМЕЩЕНИЕ/СЛИЯНИЕ: Если мы двигали карточку, ищем куда её бросили
        const changedTouch = e.changedTouches[0];
        // Временно скрываем текущую карточку, чтобы функция elementFromPoint увидела то, что ПОД НЕЙ
        item.style.display = 'none';
        const targetElement = document.elementFromPoint(changedTouch.clientX, changedTouch.clientY);
        item.style.display = 'flex'; // Возвращаем видимость назад
        
        // Если бросили на другую карточку с таким же текстом (номиналом)
        if (targetElement && targetElement.classList.contains('drag-item') && targetElement !== item && targetElement.textContent === item.textContent) {
            targetElement.classList.remove('hovered');
            handleCardsMerge(targetElement, item); // Объединяем
        } else {
            // Если бросили просто на поле — убираем подсветку со всех карточек и сохраняем координаты
            document.querySelectorAll('.drag-item').forEach(c => c.classList.remove('hovered'));
            saveGame();
        }
    });

    // === 💻 ДЕСКТОПНЫЕ СОБЫТИЯ МЫШИ (ДЛЯ ПК) ===

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
        spawnFloatingText(`+${cardValue} $`, item.style.left, item.style.top);

        mergeSound.currentTime = 0;
        mergeSound.play().catch(err => console.log(err));
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

// Универсальная функция логики слияния карточек (вызывается и для ПК, и для Смартфонов)
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

    const mergeBonus = totalSum * 5;
    updateBalance(mergeBonus);
    spawnFloatingText(`+${mergeBonus} $`, targetCard.style.left, targetCard.style.top);

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
    if (success) saveGame(); 
}

function buyCard(value) {
    const currentPrice = prices[value];
    if (balance >= currentPrice) {
        const success = createCard(value);
        if (success) {
            updateBalance(-currentPrice);
            prices[value] = Math.round(currentPrice * 1.15);
            document.getElementById(`price-${value}`).textContent = prices[value];
            saveGame(); 
        }
    }
}

// === СВОБОДНОЕ ПЕРЕМЕЩЕНИЕ МЫШИ (ПК) ===
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
checkShopButtons();
const loaded = loadGame();
if (!loaded) autoSpawn()
setInterval(updateTimerIndicator, timerStep);
setInterval(collectPassiveIncome, PASSIVE_INCOME_INTERVAL);