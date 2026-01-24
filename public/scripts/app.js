let wakeLock = null;
let speechSynthesizer = null;
let stateManager = null;
let _vkWakeLockTimer = null;

async function enableWakeLock() {

    if (typeof vkBridge !== 'undefined') {
        if (_vkWakeLockTimer != null) clearInterval(_vkWakeLockTimer);
        _vkWakeLockTimer = setInterval(() => {
            vkBridge.send('VKWebAppTapticImpactOccurred', {
                style: 'light'
            }).catch(() => {});
        }, 60000);
    } else if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
        } catch (err) {
            console.error('Wake Lock ошибка:', err);
        }
    }

    if (wakeLock || _vkWakeLockTimer)
        console.log('Wake Lock активирован');
}

async function disableWakeLock() {
    if (wakeLock !== null) {
        await wakeLock.release();
        wakeLock = null;
        console.log('Wake Lock деактивирован');
    }

    if (_vkWakeLockTimer != null) {
        clearInterval(_vkWakeLockTimer);
        _vkWakeLockTimer = null;
        console.log('Wake Lock деактивирован');
    }
}

function isAnyInputElement(element) {
    const $el = $(element);
    const el = $el[0];
    
    if (!el) return false;
    
    const tagName = el.tagName.toLowerCase();
    return ['input', 'textarea', 'select', 'button'].includes(tagName);
}

function debounce(func, wait) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(function() {
            func.apply(context, args);
        }, wait);
    };
}

function showAlert(message, type = 'info') {
    const alertClass = {
        'info': 'alert-info',
        'success': 'alert-success',
        'warning': 'alert-warning',
        'danger': 'alert-danger'
    }[type];
    
    const alert = $(`
        <div class="alert ${alertClass} alert-dismissible fade show position-fixed top-0 end-0 m-3" role="alert">
            ${message}
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert"></button>
        </div>
    `);
    
    $('body').append(alert);
    setTimeout(() => alert.alert('close'), 3000);
}

$(document).ready(function() {
    
    // Инициализируем синтезатор речи
    speechSynthesizer = new SpeechSynthesizer({
        audioBaseUrl: '/data/audio_files_gtts',
        apiBaseUrl: 'https://api.vmaya.ru/api/',
        useCachedAudio: true,
        noServer: false
    });

    // Инициализируем менеджер состояния
    stateManager = new StateManager();
    stateManager.loadState();

    playerControls = new PlayerControls();

    const AppConst = {
        charTime: {
            target: 60, 
            native: 70
        }
    }

    const state = stateManager.getState();

    // DOM элементы
    const elements = {
        phraseText: $('#phraseText'),
        phraseHint: $('#phraseHint'),
        phraseCounter: $('#phraseCounter'),
        phraseType: $('#phraseType'),
        progressBar: $('#progressBar'),
        playButton: $('#playButton'),
        nextBtn: $('#nextBtn'),
        prevBtn: $('#prevBtn'),
        settingsToggle: $('#settingsToggle'),
        applySettings: $('#applySettings'),
        speedSlider: $('#speedSlider'),
        pauseSlider: $('#pauseSlider'),
        langPauseSlider: $('#langPauseSlider'),
        speedValue: $('#speedValue'),
        pauseValue: $('#pauseValue'),
        langPauseValue: $('#langPauseValue'),
        phraseListSelect: $('#phraseListSelect'),
        phraseListPlayer: $('#phraseListPlayer'),
        tvScreenToggle: $('#tvScreenToggle')
    };

    // Инициализация
    function init(fileUrl) {
        setupEventListeners();
        applyTvScreenState();

        // Обработка события видимости страницы
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (!stateManager.isPaused && stateManager.isPlaying)
                    stopPlayback();
            }
        });

        openList(fileUrl);
    }

    function openList(fileUrl) {
        // Инициализация при загрузке
        fetch(fileUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load ${fileUrl}`);
                }

                return response.json();
            })
            .then(data => {
                if (data) {
                    phrasesData = data;
                    initPhraseList();
                    loadPhraseList();
            
                    // Восстанавливаем отображение из сохранённого состояния
                    if (state.currentPhrase) {
                        updateDisplay();
                    }
                }
            });
    }

    function loadPhrasesFromJson(fileUrl) {
        return fetch(fileUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to load ${fileUrl}`);
                    }
                    return response.json();
                });
    }

    function fullPhraseList(select) {

        select.empty();
        select.append($(`<option value="all">Все фразы (смешанные)</option>`));
        Object.keys(phrasesData).forEach(key => {
            let count = phrasesData[key].length;
            select.append($(`<option value="${key}">${key} (${count})</option>`));
            phrasesData[key].forEach((phrase, i) => {
                phrasesData[key][i].type = key;
            });
        });
    }

    function typeClick(e) {
        let item = $(e.target)
        console.log(item.data('key'));
        setCurrentType(item.data('key'));
    }

    function blockItem(key, text) {
        let item = $(`<div class="item"><a href="#" data-key="${key}">${text}</a></div>`);
        item.click(typeClick);
        return item;
    }

    function fullBlockPhraseList(elem) {
        elem.empty();
        elem.append(blockItem("all", "Все фразы (смешанные)"));

        Object.keys(phrasesData).forEach(key => {
            let count = phrasesData[key].length;
            elem.append(blockItem(key, key + ` (${count})`));
            phrasesData[key].forEach((phrase, i) => {
                phrasesData[key][i].type = key;
            });
        });
    }

    function initPhraseList() {
        fullPhraseList(elements.phraseListSelect);
        fullPhraseList(elements.phraseListPlayer);
        fullBlockPhraseList($('#other-content'));
    }

    // Загрузка списка фраз
    function loadPhraseList(resetIndex = false) {
        if (state.currentListType === 'all') {
            // Смешиваем все фразы
            state.currentPhraseList = [];
            Object.keys(phrasesData).forEach(key => {
                state.currentPhraseList = state.currentPhraseList.concat(phrasesData[key]);
            });
        } else {
            state.currentPhraseList = [].concat(phrasesData[state.currentListType]) || [];
        }
        
        // Применяем порядок с сохранением seed для воспроизводимости
        if (state.order === 'random') {
            // Используем сохранённый seed или создаём новый
            const seed = state.randomSeed || Date.now();
            state.randomSeed = seed;
            shuffleArrayWithSeed(state.currentPhraseList, seed);
            stateManager.setCurrentListData(state.currentListKey, seed);
        } else {
            state.randomSeed = null;
        }
        
        // Восстанавливаем индекс из сохранённого состояния
        if (resetIndex || (state.currentPhraseIndex >= state.currentPhraseList.length)) {
            state.currentPhraseIndex = 0;
        }
        
        state.currentPhrase = state.currentPhraseList[state.currentPhraseIndex];
    }

    // Функция перемешивания с seed
    function shuffleArrayWithSeed(array, seed) {
        let currentSeed = seed;
        const random = () => {
            const x = Math.sin(currentSeed++) * 10000;
            return x - Math.floor(x);
        };
        
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Настройка обработчиков событий
    function setupEventListeners() {
        // Кнопки управления
        elements.playButton.click(togglePlay);
        elements.nextBtn.click(nextPhrase);
        elements.prevBtn.click(prevPhrase);
        
        // Открытие настроек
        elements.settingsToggle.click(() => {

            // Задача 1: Останавливаем воспроизведение при открытии настроек
            if (stateManager.isPlaying) {
                togglePause();
            }
            openSettingsModal();
        });
        
        // Применение настроек
        elements.applySettings.click(() => {
            applySettingsFromModal();
            $('#settingsModal').modal('hide');
        });
        
        // Слайдеры
        elements.speedSlider.on('input', function() {
            const value = parseFloat($(this).val());
            elements.speedValue.text(value.toFixed(1) + 'x');
        });
        
        elements.pauseSlider.on('input', function() {
            const value = parseFloat($(this).val());
            elements.pauseValue.text(value + ' сек');
        });
        
        elements.langPauseSlider.on('input', function() {
            const value = parseFloat($(this).val());
            elements.langPauseValue.text(value + ' сек');
        });
        
        // Выбор направления
        $('[data-direction]').click(function() {
            $('[data-direction]').removeClass('active');
            $(this).addClass('active');
        });
        
        // Выбор порядка
        $('[data-order]').click(function() {
            $('[data-order]').removeClass('active');
            $(this).addClass('active');
        });

        
        elements.phraseListPlayer.on('change', (e)=>{

            state.currentListType = elements.phraseListPlayer.val();

            loadPhraseList();
            
            // Сохраняем ключ текущего списка
            const listKey = stateManager.generateListKey(
                state.currentListType, 
                state.order, 
                phrasesData
            );
            stateManager.setCurrentListData(listKey);
        });
    }

    // Открытие модального окна настроек
    function openSettingsModal() {
        // Устанавливаем текущие значения в элементы управления
        elements.speedSlider.val(state.speed);
        elements.speedValue.text(state.speed.toFixed(1) + 'x');
        
        elements.pauseSlider.val(state.pauseBetweenPhrases);
        elements.pauseValue.text(state.pauseBetweenPhrases + ' сек');
        
        elements.langPauseSlider.val(state.pauseBetweenLanguages);
        elements.langPauseValue.text(state.pauseBetweenLanguages + ' сек');
        
        elements.phraseListSelect.val(state.currentListType);
        elements.tvScreenToggle.prop('checked', state.showTvScreen);
        
        // Устанавливаем активные кнопки направления и порядка
        $(`[data-direction="${state.direction}"]`).addClass('active').siblings().removeClass('active');
        $(`[data-order="${state.order}"]`).addClass('active').siblings().removeClass('active');
        
        $('#settingsModal').modal('show');
    }

    // Применение настроек из модального окна
    function applySettingsFromModal() {
        // Собираем новые настройки
        const newSettings = {
            speed: parseFloat(elements.speedSlider.val()),
            pauseBetweenPhrases: parseFloat(elements.pauseSlider.val()),
            pauseBetweenLanguages: parseFloat(elements.langPauseSlider.val()),
            currentListType: elements.phraseListSelect.val(),
            direction: $('[data-direction].active').data('direction'),
            order: $('[data-order].active').data('order'),
            showTvScreen: elements.tvScreenToggle.prop('checked')
        };
        
        // Проверяем, изменился ли список фраз
        const listChanged = stateManager.hasListChanged(
            newSettings.currentListType, 
            newSettings.order, 
            phrasesData
        );
        
        // Обновляем состояние через менеджер
        const changes = stateManager.updateSettings(newSettings);
        Object.assign(state, stateManager.getState());
        
        // Задача 2: Перезагружаем список только если изменился тип списка или порядок
        if (changes.listChanged || listChanged) {
            loadPhraseList();
            
            // Сохраняем ключ текущего списка
            const listKey = stateManager.generateListKey(
                state.currentListType, 
                state.order, 
                phrasesData
            );
            stateManager.setCurrentListData(listKey);
        }
        
        // Сохраняем состояние
        stateManager.saveState();
        /*
        // Если воспроизведение активно, перезапускаем
        if (stateManager.isPlaying && !stateManager.isPaused) {
            stopPlayback();
            startPlayback();
        } else {
            updateDisplay();
        }*/
        updateDisplay();

        if (changes.settingsChanged || changes.listChanged) {
            applyTvScreenState();
        }

        $(window).trigger('apply_settings');
    }

    function setCurrentType(type) {
        state.currentListType = type;
            
        // Сохраняем ключ текущего списка
        const listKey = stateManager.generateListKey(
            state.currentListType, 
            state.order, 
            phrasesData
        );

        state.showingFirstLang = true;
        stateManager.updateSettings(state);
        stateManager.setCurrentListData(listKey);
        stateManager.saveState();

        loadPhraseList(true);
        updateDisplay();
    }

    // Применить состояние TV-экрана
    function applyTvScreenState() {
        const tvScreen = $('.tv-screen');
        if (state.showTvScreen)
            tvScreen.show();
        else tvScreen.hide();
    }

    function stopPlay() {
        state.currentPhraseIndex = 0;
        stopPlayback();
    }

    function togglePlay() {
        if (stateManager.isPaused || stateManager.isPlaying) {
            togglePause();
        } else {
            startPlayback();
        }
    }

    // Начать воспроизведение
    function startPlayback() {
        if (state.currentPhraseList.length === 0) {
            showAlert('Список фраз пуст!', 'warning');
            return;
        }
        
        stateManager.isPlaying = true;
        stateManager.isPaused = false;
        state.showingFirstLang = true;
        
        // Сохраняем состояние
        stateManager.updatePlaybackState({
            showingFirstLang: true
        });
        
        updateControls();
        playCurrentPhrase();
    }

    // Переключить паузу
    function togglePause() {
        if (!stateManager.isPlaying) return;
        
        stateManager.isPaused = !stateManager.isPaused;
        
        if (stateManager.isPaused) {
            clearTimeout(state.timeoutId);
            clearInterval(state.progressInterval);
        } else {
            playCurrentPhrase();
        }
        
        updateControls();
    }

    // Остановить воспроизведение
    function stopPlayback() {
        stateManager.isPlaying = false;
        stateManager.isPaused = false;
        clearTimeout(state.timeoutId);
        clearInterval(state.progressInterval);
        speechSynthesizer.stop();
        
        updateControls();
        updateDisplay();
    }

    // Следующая фраза
    function nextPhrase() {
        clearTimeout(state.timeoutId);
        clearInterval(state.progressInterval);

        state.currentPhraseIndex = (state.currentPhraseIndex + 1) % state.currentPhraseList.length;
        if (isBothDirectionsMode() && !state.showingFirstLang)
            state.showingFirstLang = true;
        
        // Сохраняем состояние
        stateManager.updatePlaybackState({
            currentPhraseIndex: state.currentPhraseIndex,
            showingFirstLang: state.showingFirstLang
        });
        
        if (stateManager.isPlaying)
            playCurrentPhrase();
        updateDisplay();
    }

    // Предыдущая фраза
    function prevPhrase() {
        clearTimeout(state.timeoutId);
        clearInterval(state.progressInterval);
        
        state.currentPhraseIndex = state.currentPhraseIndex > 0 ? 
            state.currentPhraseIndex - 1 : 
            state.currentPhraseList.length - 1;
        
        // Сохраняем состояние
        stateManager.updatePlaybackState({
            currentPhraseIndex: state.currentPhraseIndex
        });
        
        if (stateManager.isPlaying && !stateManager.isPaused) {
            playCurrentPhrase();
        } else {
            updateDisplay();
        }
    }

    // Воспроизвести текущую фразу
    function playCurrentPhrase() {
        if (!stateManager.isPlaying || stateManager.isPaused) return;
        
        if (state.currentPhraseIndex >= state.currentPhraseList.length) {
            state.currentPhraseIndex = 0;
        }
        
        state.currentPhrase = state.currentPhraseList[state.currentPhraseIndex];
        updateDisplay();
        
        // Определяем режим воспроизведения
        if (isBothDirectionsMode()) {
            playBothDirections();
        } else {
            playSingleDirection();
        }
    }

    // Режим "оба направления"
    function isBothDirectionsMode() {
        return state.direction.includes('both');
    }

    function calcTime(firstLang, secondLang) {
        return state.pauseBetweenPhrases * 1000 + 
                state.currentPhrase[firstLang].length * AppConst.charTime[firstLang] * 1 / state.speed + 
                state.currentPhrase[secondLang].length * AppConst.charTime[secondLang] * 1 / state.speed;
    }

    // Воспроизведение в обоих направлениях
    function playBothDirections() {
        const isEnFirst = state.direction === 'target-native-both';
        const firstLang = isEnFirst ? 'target' : 'native';
        const secondLang = isEnFirst ? 'native' : 'target';
        
        if (state.showingFirstLang) {
            // Показываем и озвучиваем первый язык
            showPhrase(firstLang);

            speechSynthesizer.speak(state.currentPhrase[firstLang], firstLang, 
                    state.currentPhrase.type, state.speed)
                .then(()=>{

                    startProgressTimer(state.pauseBetweenLanguages);
                    
                    state.timeoutId = setTimeout(() => {
                        state.showingFirstLang = false;
                        playCurrentPhrase();
                    }, calcTime(firstLang, secondLang));

                });
        } else {
            // Показываем и озвучиваем второй язык
            let totalTime = state.pauseBetweenPhrases * 1000 + 
                state.currentPhrase[secondLang].length * AppConst.charTime[secondLang] * 1 / state.speed;

            showPhrase(secondLang);
            speechSynthesizer.speak(state.currentPhrase[secondLang], secondLang, 
                    state.currentPhrase.type, state.speed)
                .then(()=>{
                    startProgressTimer(state.pauseBetweenPhrases);
                    
                    state.timeoutId = setTimeout(() => {
                        state.currentPhraseIndex = (state.currentPhraseIndex + 1) % state.currentPhraseList.length;
                        state.showingFirstLang = true;
                        playCurrentPhrase();
                    }, calcTime(secondLang, firstLang));
                });
        }
    }

    // Воспроизведение в одном направлении
    function playSingleDirection() {
        const showLang = state.direction === 'target-native' ? 'target' : 'native';
        const speakLang = state.direction === 'target-native' ? 'native' : 'target';
        
        showPhrase(showLang);
        speechSynthesizer.speak(state.currentPhrase[speakLang], speakLang, 
                    state.currentPhrase.type, state.speed)
            .then(()=>{

                startProgressTimer(state.pauseBetweenPhrases);
                
                state.timeoutId = setTimeout(() => {
                    state.currentPhraseIndex = (state.currentPhraseIndex + 1) % state.currentPhraseList.length;
                    playCurrentPhrase();
                }, calcTime(speakLang, showLang));
            });
    }

    function setText(elem, text, k = 1, maxSize = 25, minSize = 16) {
        
        let size = Math.max(Math.min(1 / text.length * 1000, maxSize * k), minSize * k);
        elem.text(text);
        elem.css('font-size', size);
    }

    function updatePhrases(text, hint) {
        setText(elements.phraseText, text, 1);
        setText(elements.phraseHint, hint, 0.7);
    }

    // Показать фразу
    function showPhrase(lang) {
        if (lang === 'target') {
            updatePhrases(state.currentPhrase.target, state.currentPhrase.native);

            elements.phraseText.addClass('text-info');
            elements.phraseHint.removeClass('text-info').addClass('text-muted');
        } else {
            updatePhrases(state.currentPhrase.native, state.currentPhrase.target);

            elements.phraseText.removeClass('text-info');
            elements.phraseHint.addClass('text-info');
        }
        
        // Анимация
        elements.phraseText.addClass('animate-text');
        elements.phraseHint.addClass('animate-hint');
        setTimeout(() => {
            elements.phraseText.removeClass('animate-text');
            elements.phraseHint.removeClass('animate-hint');
        }, 500);
    }

    // Озвучить текущую фразу
    function speakCurrentPhrase(lang) {
        if (!state.currentPhrase) return;
        return speechSynthesizer.speak(state.currentPhrase[lang], lang, 
                    state.currentPhrase.type, state.speed);
    }

    // Запустить таймер прогресса
    function startProgressTimer(duration) {
        let timeLeft = duration;
        elements.progressBar.css('width', '100%');
        
        clearInterval(state.progressInterval);
        state.progressInterval = setInterval(() => {
            timeLeft -= 0.1;
            const percentage = (timeLeft / duration) * 100;
            elements.progressBar.css('width', percentage + '%');
            
            if (timeLeft <= 0) {
                clearInterval(state.progressInterval);
            }
        }, 100);
    }

    function formatTitle(str) {
        const withSpaces = str.replace(/_/g, ' ');
        return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
    }

    // Обновить отображение
    function updateDisplay() {
        if (state.currentPhraseList.length === 0) {
            updatePhrases('Список фраз пуст', 'Выберите список фраз в настройках');
            elements.phraseCounter.text('0 / 0');
            elements.phraseType.text('Не выбран');
            return;
        }
        
        if (!state.currentPhrase) {
            state.currentPhrase = state.currentPhraseList[0];
        }
        
        if (state.currentPhrase) {
            if (!stateManager.isPlaying) {
                updatePhrases(state.currentPhrase.native, state.currentPhrase.target);
                elements.phraseText.removeClass('text-info');
                elements.phraseHint.addClass('text-info');
            }
            
            elements.phraseCounter.text(`${state.currentPhraseIndex + 1} / ${state.currentPhraseList.length}`);
            elements.phraseType.text(formatTitle(state.currentPhrase.type));
        }
    }

    // Обновить кнопки управления
    function updateControls() {
        let isPlay = stateManager.isPlaying && !stateManager.isPaused;

        if (isPlay) enableWakeLock();
        else disableWakeLock();

        // Обновить контролы плеера
        if (playerControls) {
            playerControls.updatePlayButton(stateManager.isPlaying && !stateManager.isPaused);
            
            const hasPrev = stateManager.isPlaying && state.currentPhraseList.length > 0;
            const hasNext = state.currentPhraseList.length > 0;
            playerControls.updateNavigationButtons(hasPrev, hasNext);
        }

        let playBi = elements.playButton.find('.bi');
        playBi.removeClass('bi-play-circle bi-pause-circle');
        
        // Обновить текст и иконки
        if (stateManager.isPlaying) {
            if (stateManager.isPaused) {
                playBi.addClass('bi-play-circle');
            } else {
                playBi.addClass('bi-pause-circle');
            }
        } else {
            playBi.addClass('bi-play-circle');
        }
        
        // Сбросить прогресс-бар
        if (!stateManager.isPlaying || stateManager.isPaused) {
            elements.progressBar.css('width', '0%');
        }
    }

    // Вспомогательные функции
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
    
    init('data/en-ru.json');
});