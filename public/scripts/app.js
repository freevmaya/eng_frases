$(document).ready(function() {
    // Состояние приложения
    const state = {
        currentPhraseIndex: 0,
        charTime: {english: 60, russian: 70},
        currentPhraseList: [],
        isPlaying: false,
        isPaused: false,
        direction: 'ru-en',
        order: 'sequential',
        currentListType: 'all',
        speed: 1.0,
        pauseBetweenPhrases: 3,
        pauseBetweenLanguages: 2,
        timeoutId: null,
        showingFirstLang: true,
        currentPhrase: null,
        progressInterval: null
    };

    // DOM элементы
    const elements = {
        phraseText: $('#phraseText'),
        phraseHint: $('#phraseHint'),
        phraseCounter: $('#phraseCounter'),
        phraseType: $('#phraseType'),
        progressBar: $('#progressBar'),
        playButton: $('#playButton'),
        stopBtn: $('#stopBtn'),
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
        speakEnglishBtn: $('#speakEnglishBtn'),
        speakRussianBtn: $('#speakRussianBtn')
    };

    // Инициализация
    function init() {
        initPhraseList();
        loadPhraseList();
        setupEventListeners();
        updateDisplay();
    }

    function initPhraseList() {
        let select = $('#phraseListSelect');
        select.empty();
        select.append($(`<option value="all">Все фразы (смешанные)</option>`));
        Object.keys(phrasesData).forEach(key => {
            select.append($(`<option value="${key}">${key}</option>`));
            phrasesData[key].forEach((phrase, i) => {
                phrasesData[key][i].type = key;
            });
        });
    }

    // Загрузка списка фраз
    function loadPhraseList() {
        if (state.currentListType === 'all') {
            // Смешиваем все фразы
            state.currentPhraseList = [];
            Object.keys(phrasesData).forEach(key => {
                state.currentPhraseList = state.currentPhraseList.concat(phrasesData[key]);
            });
        } else {
            state.currentPhraseList = phrasesData[state.currentListType] || [];
        }
        
        // Применяем порядок
        if (state.order === 'random') {
            shuffleArray(state.currentPhraseList);
        }
        
        state.currentPhraseIndex = 0;
    }

    // Настройка обработчиков событий
    function setupEventListeners() {
        // Кнопки управления
        elements.playButton.click(togglePlay);
        elements.stopBtn.click(stopPlay);
        elements.nextBtn.click(nextPhrase);
        elements.prevBtn.click(prevPhrase);
        
        // Кнопки озвучки
        elements.speakEnglishBtn.click(() => speakCurrentPhrase('english'));
        elements.speakRussianBtn.click(() => speakCurrentPhrase('russian'));
        
        // Открытие настроек
        elements.settingsToggle.click(() => {
            $('#settingsModal').modal('show');
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
        
        // Быстрые настройки скорости
        $('.speed-btn').click(function() {
            const speed = parseFloat($(this).data('speed'));
            elements.speedSlider.val(speed);
            elements.speedValue.text(speed.toFixed(1) + 'x');
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
    }

    // Применение настроек из модального окна
    function applySettingsFromModal() {
        // Обновляем состояние
        state.speed = parseFloat(elements.speedSlider.val());
        state.pauseBetweenPhrases = parseFloat(elements.pauseSlider.val());
        state.pauseBetweenLanguages = parseFloat(elements.langPauseSlider.val());
        state.currentListType = elements.phraseListSelect.val();
        
        // Направление
        const activeDirection = $('[data-direction].active').data('direction');
        if (activeDirection) {
            state.direction = activeDirection;
        }
        
        // Порядок
        const activeOrder = $('[data-order].active').data('order');
        if (activeOrder) {
            state.order = activeOrder;
        }
        
        // Перезагружаем список фраз
        loadPhraseList();
        
        // Если воспроизведение активно, перезапускаем
        if (state.isPlaying && !state.isPaused) {
            stopPlayback();
            startPlayback();
        } else {
            updateDisplay();
        }
    }

    function stopPlay() {
        state.currentPhraseIndex = 0;
        stopPlayback();
    }

    function togglePlay() {
        if (state.isPaused || state.isPlaying) 
            togglePause();
        else 
            startPlayback();
    }

    // Начать воспроизведение
    function startPlayback() {
        if (state.currentPhraseList.length === 0) {
            showAlert('Список фраз пуст!', 'warning');
            return;
        }
        
        state.isPlaying = true;
        state.isPaused = false;
        state.showingFirstLang = true;
        
        updateControls();
        playCurrentPhrase();
    }

    // Переключить паузу
    function togglePause() {
        if (!state.isPlaying) return;
        
        state.isPaused = !state.isPaused;
        
        if (state.isPaused) {
            clearTimeout(state.timeoutId);
            clearInterval(state.progressInterval);
        } else {
            playCurrentPhrase();
        }
        
        updateControls();
    }

    // Остановить воспроизведение
    function stopPlayback() {
        state.isPlaying = false;
        state.isPaused = false;
        clearTimeout(state.timeoutId);
        clearInterval(state.progressInterval);
        updateControls();
        updateDisplay();
    }

    // Следующая фраза
    function nextPhrase() {
        clearTimeout(state.timeoutId);
        clearInterval(state.progressInterval);

        if (isBothDirectionsMode() && !state.showingFirstLang) {
            state.currentPhraseIndex = (state.currentPhraseIndex + 1) % state.currentPhraseList.length;
            state.showingFirstLang = true;
        } else if (!isBothDirectionsMode()) {
            state.currentPhraseIndex = (state.currentPhraseIndex + 1) % state.currentPhraseList.length;
        }
        
        if (state.isPlaying)
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
        
        if (state.isPlaying && !state.isPaused) {
            playCurrentPhrase();
        } else {
            updateDisplay();
        }
    }

    // Воспроизвести текущую фразу
    function playCurrentPhrase() {
        if (!state.isPlaying || state.isPaused) return;
        
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
                state.currentPhrase[firstLang].length * state.charTime[firstLang] * 1 / state.speed + 
                state.currentPhrase[secondLang].length * state.charTime[secondLang] * 1 / state.speed;
    }

    // Воспроизведение в обоих направлениях
    function playBothDirections() {
        const isEnFirst = state.direction === 'en-ru-both';
        const firstLang = isEnFirst ? 'english' : 'russian';
        const secondLang = isEnFirst ? 'russian' : 'english';
        
        if (state.showingFirstLang) {
            // Показываем и озвучиваем первый язык

            showPhrase(firstLang);
            speakPhrase(state.currentPhrase[firstLang], firstLang === 'english');
            startProgressTimer(state.pauseBetweenLanguages);
            
            state.timeoutId = setTimeout(() => {
                state.showingFirstLang = false;
                playCurrentPhrase();
            }, calcTime(firstLang, secondLang));
        } else {
            // Показываем и озвучиваем второй язык

            let totalTime = state.pauseBetweenPhrases * 1000 + 
                state.currentPhrase[secondLang].length * state.charTime[secondLang] * 1 / state.speed;

            showPhrase(secondLang);
            speakPhrase(state.currentPhrase[secondLang], secondLang === 'english');
            startProgressTimer(state.pauseBetweenPhrases);
            
            state.timeoutId = setTimeout(() => {
                state.currentPhraseIndex = (state.currentPhraseIndex + 1) % state.currentPhraseList.length;
                state.showingFirstLang = true;
                playCurrentPhrase();
            }, calcTime(secondLang, firstLang));
        }
    }

    // Воспроизведение в одном направлении
    function playSingleDirection() {
        const showLang = state.direction === 'en-ru' ? 'english' : 'russian';
        const speakLang = state.direction === 'en-ru' ? 'russian' : 'english';
        
        showPhrase(showLang);
        speakPhrase(state.currentPhrase[speakLang], speakLang === 'english');
        startProgressTimer(state.pauseBetweenPhrases);
        
        state.timeoutId = setTimeout(() => {
            state.currentPhraseIndex = (state.currentPhraseIndex + 1) % state.currentPhraseList.length;
            playCurrentPhrase();
        }, calcTime(speakLang, showLang));
    }

    function setText(elem, text, maxSize = 25, minSize = 16) {
        
        let size = Math.max(Math.min(1 / text.length * 1000, maxSize), minSize);
        elem.text(text);
        elem.css('font-size', size);
    }

    // Показать фразу
    function showPhrase(lang) {
        if (lang === 'english') {
            setText(elements.phraseText, state.currentPhrase.english);
            setText(elements.phraseHint, state.currentPhrase.russian);

            elements.phraseText.addClass('text-info');
            elements.phraseHint.removeClass('text-info').addClass('text-muted');
        } else {
            setText(elements.phraseText, state.currentPhrase.russian);
            setText(elements.phraseHint, state.currentPhrase.english);

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

    // Озвучить фразу
    function speakPhrase(text, isEnglish = true) {
        if (!('speechSynthesis' in window)) {
            console.warn('Web Speech API не поддерживается');
            return;
        }
        
        speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = isEnglish ? 'en-US' : 'ru-RU';
        utterance.rate = state.speed;
        utterance.volume = 1;
        
        speechSynthesis.speak(utterance);
    }

    // Озвучить текущую фразу
    function speakCurrentPhrase(lang) {
        if (!state.currentPhrase) return;
        speakPhrase(state.currentPhrase[lang], lang === 'english');
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
            setText(elements.phraseText, 'Список фраз пуст');
            setText(elements.phraseHint, 'Выберите список фраз в настройках');
            elements.phraseCounter.text('0 / 0');
            elements.phraseType.text('Не выбран');
            return;
        }
        
        if (!state.currentPhrase) {
            state.currentPhrase = state.currentPhraseList[0];
        }
        
        if (state.currentPhrase) {
            if (!state.isPlaying) {
                setText(elements.phraseText, state.currentPhrase.russian);
                setText(elements.phraseHint, state.currentPhrase.english);
                elements.phraseText.removeClass('text-info');
                elements.phraseHint.addClass('text-info');
            }
            
            elements.phraseCounter.text(`${state.currentPhraseIndex + 1} / ${state.currentPhraseList.length}`);
            elements.phraseType.text(formatTitle(state.currentPhrase.type));
        }
    }

    // Обновить кнопки управления
    function updateControls() {

        elements.stopBtn.prop('disabled', !state.isPlaying && !state.isPaused);
        elements.prevBtn.prop('disabled', !state.isPlaying && state.currentPhraseList.length === 0);
        elements.nextBtn.prop('disabled', state.currentPhraseList.length === 0);

        let playBi = elements.playButton.find('.bi');
        playBi.removeClass('bi-play-circle bi-pause-circle');
        
        // Обновить текст и иконки
        if (state.isPlaying) {
            if (state.isPaused) {
                playBi.addClass('bi-play-circle');
            } else {
                playBi.addClass('bi-pause-circle');
            }
        } else {
            playBi.addClass('bi-play-circle');
        }
        
        // Сбросить прогресс-бар
        if (!state.isPlaying || state.isPaused) {
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

    // Инициализация при загрузке
    init();
});