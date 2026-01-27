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

    /*
    if (wakeLock || _vkWakeLockTimer)
        console.log('Wake Lock активирован');
        */
}

async function disableWakeLock() {
    if (wakeLock !== null) {
        await wakeLock.release();
        wakeLock = null;
        //console.log('Wake Lock деактивирован');
    }

    if (_vkWakeLockTimer != null) {
        clearInterval(_vkWakeLockTimer);
        _vkWakeLockTimer = null;
        //console.log('Wake Lock деактивирован');
    }
}

function isAnyInputElement(element) {
    const jel = $(element);
    const el = jel[0];
    
    if (!el) return false;
    
    const tagName = el.tagName.toLowerCase();
    if (['input', 'textarea', 'select', 'button'].includes(tagName))
        return true;
    return jel.hasClass('control');
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

function playerMessage(text, showTimeSec = 0) {
    let elem = $('#payerMessage');
    elem.html(text);
    if (showTimeSec)
        setTimeout(()=>{
            elem.text('');
        }, showTimeSec * 1000);
}

class Phrase {
    constructor(data) {
        this.native     = data['native'];
        this.target     = data['target'];
        this.direction  = data['direction'];
        this.context    = data['context'];
        this.difficulty_level = data['difficulty_level'];
        this.type       = data['type'];
    }

    Language(phraseType) {
        const phrase = this[phraseType];
        const langs = this.direction.split('-');
        return phraseType === 'target' ? langs[0] : langs[1];
    }

    isQuestion(phraseType) {
        return this[phraseType][this[phraseType].length - 1] == '?'
    }

    FormatType() {
        const withSpaces = this.type.replace(/_/g, ' ');
        return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
    }

    CleanText(phraseType) {
        return this[phraseType].replace(/\([^()]*\)|\[[^\][]*\]/g, '').trim();
    }
}

Phrase.createList = (sourceList)=>{
    let result = [];
    for (let key in sourceList)
        result.push(new Phrase(sourceList[key]));
    return result;
}

$(document).ready(function() {
    
    // Инициализируем синтезатор речи
    speechSynthesizer = new SpeechSynthesizer(SPEECH_CONFIG);

    // Инициализируем менеджер состояния
    stateManager = new StateManager();
    stateManager.loadState();

    playerControls = new PlayerControls();

    const AppConst = {
        charTime: {
            target: 20,
            native: 30
        }
    }

    let _pageScrollTimerId;
    const state = stateManager.getState();

    var appData = {
        currentPhraseList: [],
        currentPhrase: null
    };

    // DOM элементы
    const elements = {
        phraseText: $('#phraseText'),
        phraseHint: $('#phraseHint'),
        phraseCounter: $('#phraseCounter'),
        phraseType: $('#phraseType'),
        progressBar: $('#progressBar'),
        progressControl: $('#progressControl'),
        playButton: $('#playButton'),
        nextBtn: $('#nextBtn'),
        prevBtn: $('#prevBtn'),
        settingsToggle: $('#settingsToggle'),
        applySettings: $('#applySettings'),
        pauseSlider: $('#pauseSlider'),
        speedValue: $('#speedValue'),
        pauseValue: $('#pauseValue'),
        phraseListSelect: $('#phraseListSelect'),
        phraseListPlayer: $('#phraseListPlayer'),
        tvScreenToggle: $('#tvScreenToggle'),
        repeatLength: $('#repeatLength'),
        repeatCount: $('#repeatCount'),
        genderVoice: $('#genderVoice'),
        recognizeToggle: $('#recognizeToggle')
    };
            
    // Создаем объект распознавания
    var recognition = null;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition)
        recognition = new VRecognition(new SpeechRecognition());
    else $('#recognizeToggleForm').style('display', 'none');

    // Инициализация
    function init() {
        setupEventListeners();
        applyTvScreenState();

        // Обработка события видимости страницы
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (!stateManager.isPaused && stateManager.isPlaying)
                    stopPlayback();
            }
        });

        if (phrasesData)
            afterLoadList(phrasesData);
        else loadList();
    }

    function afterLoadList(data) {

        phrasesData = data;
        initPhraseList();
        loadPhraseList();

        // Восстанавливаем отображение из сохранённого состояния
        if (appData.currentPhrase) {
            updateDisplay();
        }

        $(window).trigger('phrases_loaded');
    }

    function loadList() {
        Ajax({
            action: 'getList'
        }).then(afterLoadList);
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
        updateBottomList();
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
            appData.currentPhraseList = [];
            Object.keys(phrasesData).forEach(key => {
                appData.currentPhraseList = appData.currentPhraseList.concat(Phrase.createList(phrasesData[key]));
            });
        } else {
            appData.currentPhraseList = Phrase.createList(phrasesData[state.currentListType]) || [];
        }
        
        // Применяем порядок с сохранением seed для воспроизводимости
        if (state.order === 'random') {
            // Используем сохранённый seed или создаём новый
            const seed = state.randomSeed || Date.now();
            state.randomSeed = seed;
            shuffleArrayWithSeed(appData.currentPhraseList, seed);
            stateManager.setCurrentListData(state.currentListKey, seed);
        } else {
            state.randomSeed = null;
        }
        
        // Восстанавливаем индекс из сохранённого состояния
        if (resetIndex || (state.currentPhraseIndex >= appData.currentPhraseList.length)) {
            setCurrentPhraseIndex(0);
        }
        
        appData.currentPhrase = appData.currentPhraseList[state.currentPhraseIndex];
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
        elements.nextBtn.click(nextPhrase);
        elements.prevBtn.click(prevPhrase);

        elements.playButton[0].addEventListener('click', () => {
            /*
            if (recognition && stateManager.state.recognize) {
                recognition.lang = 'en-US';
                recognition.start();
            }*/
            togglePlay();
        });
        
        // Открытие настроек
        elements.settingsToggle.click(() => {
            openSettingsModal();
        });
        
        // Применение настроек
        elements.applySettings.click(() => {
            applySettingsFromModal();
            $('#settingsModal').modal('hide');
        });
        
        elements.pauseSlider.on('input', function() {
            const value = parseFloat($(this).val());
            elements.pauseValue.text(value + ' сек');
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

        elements.progressControl.click((e)=>{
            if (appData.currentPhraseList) {
                const rect = e.target.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                setCurrentPhraseIndex(Math.round(appData.currentPhraseList.length * clickX / rect.width));
                if (stateManager.isPlaying && !stateManager.isPaused)
                    playCurrentPhrase();
            }
        });
    }

    // Открытие модального окна настроек
    function openSettingsModal() {

        // Задача 1: Останавливаем воспроизведение при открытии настроек
        if (stateManager.isPlaying)
            stopPlayback();

        // Устанавливаем текущие значения в элементы управления

        elements.speedValue.text(state.speed.toFixed(1) + 'x');
        
        elements.pauseSlider.val(state.pauseBetweenPhrases);
        elements.pauseValue.text(state.pauseBetweenPhrases + ' сек');
        
        elements.phraseListSelect.val(state.currentListType);
        elements.tvScreenToggle.prop('checked', state.showTvScreen);
        elements.recognizeToggle.prop('checked', state.recognize);

        elements.repeatLength.val(state.repeatLength);
        elements.repeatCount.val(state.repeatCount);
        elements.genderVoice.val(state.genderVoice);
        
        // Устанавливаем активные кнопки направления и порядка
        $(`[data-direction="${state.direction}"]`).addClass('active').siblings().removeClass('active');
        $(`[data-order="${state.order}"]`).addClass('active').siblings().removeClass('active');
        
        $('#settingsModal').modal('show');
    }

    // Применение настроек из модального окна
    function applySettingsFromModal() {
        // Собираем новые настройки
        const newSettings = {

            pauseBetweenPhrases: parseFloat(elements.pauseSlider.val()),
            currentListType: elements.phraseListSelect.val(),
            direction: $('[data-direction].active').data('direction'),
            order: $('[data-order].active').data('order'),
            showTvScreen: elements.tvScreenToggle.prop('checked'),
            recognize: elements.recognizeToggle.prop('checked'),
            repeatLength: elements.repeatLength.val(),
            repeatCount: elements.repeatCount.val(),
            genderVoice: elements.genderVoice.val()
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

        updateBottomList();
        
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
        updateDisplay();

        if (changes.settingsChanged || changes.listChanged) {
            applyTvScreenState();
        }

        $(window).trigger('apply_settings');
    }

    function setCurrentType(type) {

        if (state.currentListType != type) {
            state.currentListType = type;

            speechSynthesizer.stop();
            updateBottomList();

            debouncePage(()=>{
                speechSynthesizer.waitForCompletion()
                    .then(()=>{ 

                        // Сохраняем ключ текущего списка
                        const listKey = stateManager.generateListKey(
                            state.currentListType, 
                            state.order, 
                            phrasesData
                        );
                        loadPhraseList(true);

                        stateManager.updateSettings(state);
                        stateManager.setCurrentListData(listKey);
                        stateManager.updatePlaybackState({
                            currentPhraseIndex: state.currentPhraseIndex,
                            showingFirstLang: state.showingFirstLang,
                            currentListType: state.currentListType,
                            order: state.order
                        });  
                        updateDisplay();
                
                        if (stateManager.isPlaying)
                            playCurrentPhrase();
                    });
            });

        }
    }

    function updateBottomList() {
        $('#other-content .item').each((i, item)=>{
            item = $(item);
            item.removeClass('current');
            if (state.currentListType == item.find('a').data('key'))
                item.addClass('current');
        });
    }

    // Применить состояние TV-экрана
    function applyTvScreenState() {
        const tvScreen = $('.tv-screen');
        if (state.showTvScreen)
            tvScreen.show();
        else tvScreen.hide();
    }

    function stopPlay() {
        setCurrentPhraseIndex(0);
        stopPlayback();
    }

    function togglePlay(e) {
        if (stateManager.isPaused || stateManager.isPlaying) {
            togglePause();
        } else {
            startPlayback();
        }
    }

    // Начать воспроизведение
    function startPlayback() {
        if (appData.currentPhraseList.length === 0) {
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

        speechSynthesizer.stop();
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

    function debouncePage(callback) {

        clearTimeout(state.timeoutId);
        clearInterval(state.progressInterval);

        if (_pageScrollTimerId) 
            clearTimeout(_pageScrollTimerId);

        _pageScrollTimerId = setTimeout(()=>{
            _pageScrollTimerId = null;
            callback();
        }, 500);
    }

    function setCurrentPhraseIndexNextOrPrev(index) {
        if (state.currentPhraseIndex != index) {

            setCurrentPhraseIndex(Math.max(0, Math.min(appData.currentPhraseList.length - 1, index)), false);
            appData.currentPhrase = appData.currentPhraseList[state.currentPhraseIndex];

            updateDisplay();
            debouncePage(()=>{                
                state.showingFirstLang = true;
            
                // Сохраняем состояние
                stateManager.updatePlaybackState({
                    currentPhraseIndex: state.currentPhraseIndex
                });
                
                if (stateManager.isPlaying)
                    playCurrentPhrase();
            });
        }
    }

    // Следующая фраза
    function nextPhrase() {
        setCurrentPhraseIndexNextOrPrev((state.currentPhraseIndex + 1) % appData.currentPhraseList.length);
    }

    // Предыдущая фраза
    function prevPhrase() {
        setCurrentPhraseIndexNextOrPrev(state.currentPhraseIndex > 0 ? 
                state.currentPhraseIndex - 1 : 
                appData.currentPhraseList.length - 1);
    }

    // Воспроизвести текущую фразу
    function playCurrentPhrase() {
        if (!stateManager.isPlaying || stateManager.isPaused) return;
        
        if (state.currentPhraseIndex >= appData.currentPhraseList.length) {
            setCurrentPhraseIndex(0);
        }
        
        appData.currentPhrase = appData.currentPhraseList[state.currentPhraseIndex];
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

    function calcTime(lang) {
        return state.pauseBetweenPhrases * 1000 + 
                appData.currentPhrase[lang].length * AppConst.charTime[lang];
    }

    function setCurrentPhraseIndex(index, useRepeat = true) {
        let newIndex = index < 0 ? appData.currentPhraseList.length - index : index % appData.currentPhraseList.length;

        if (useRepeat && (state.repeatCount > 0) && (newIndex % state.repeatLength == 0)) {
            state.currentRepeat++;
            if (state.currentRepeat > state.repeatCount)
                state.currentRepeat = 0;
            else newIndex = Math.max(0, newIndex - state.repeatLength);

            console.log(`currentRepeat: ${state.currentRepeat}, newIndex: ${newIndex}`);
        }

        state.currentPhraseIndex = newIndex;
        state.showingFirstLang = true;
        refreshProgressBar();
        updateDisplay();

        speechSynthesizer.stop();
    }

    // Воспроизведение в обоих направлениях
    function playBothDirections() {
        const isEnFirst = state.direction === 'target-native-both';
        const firstLang = isEnFirst ? 'target' : 'native';
        const secondLang = isEnFirst ? 'native' : 'target';
        
        if (state.showingFirstLang) {
            // Показываем и озвучиваем первый язык
            showPhrase(firstLang);

            speechSynthesizer.speak(appData.currentPhrase, firstLang, 
                    appData.currentPhrase.type, state.speed, state.genderVoice)
                .then((result)=>{
                    if (result.success) {

                        let time = calcTime(firstLang);
                        if ((firstLang == 'native') && recognition && stateManager.state.recognize)
                            recognition.startRecognition(time, appData.currentPhrase, secondLang);

                        clearTimeout(state.timeoutId);
                        state.timeoutId = setTimeout(() => {
                            state.showingFirstLang = false;
                            playCurrentPhrase();
                        }, time);
                    }

                });
        } else {
            // Показываем и озвучиваем второй язык
            let totalTime = state.pauseBetweenPhrases * 1000 + 
                appData.currentPhrase[secondLang].length * AppConst.charTime[secondLang] * 1 / state.speed;

            showPhrase(secondLang);
            speechSynthesizer.speak(appData.currentPhrase, secondLang, 
                    appData.currentPhrase.type, state.speed, state.genderVoice)
                .then((result)=>{
                    if (result.success) {

                        let time = calcTime(secondLang);
                        if ((secondLang == 'native') && recognition && stateManager.state.recognize)
                            recognition.startRecognition(time, appData.currentPhrase, firstLang);

                        clearTimeout(state.timeoutId);
                        state.timeoutId = setTimeout(() => {
                            setCurrentPhraseIndex(state.currentPhraseIndex + 1);
                            playCurrentPhrase();
                        }, time);
                    }
                });
        }
    }

    // Воспроизведение в одном направлении
    function playSingleDirection() {
        const showLang = state.direction === 'target-native' ? 'target' : 'native';
        const speakLang = state.direction === 'target-native' ? 'native' : 'target';
        
        showPhrase(showLang);
        speechSynthesizer.speak(appData.currentPhrase, speakLang, 
                    appData.currentPhrase.type, state.speed, state.genderVoice)
            .then((result)=>{
                if (result.success) {

                    let time = calcTime(speakLang);
                    if (recognition && stateManager.state.recognize) 
                        recognition.startRecognition(time, appData.currentPhrase, 'target');
                    
                    state.timeoutId = setTimeout(() => {
                        setCurrentPhraseIndex(state.currentPhraseIndex + 1);
                        playCurrentPhrase();
                    }, time);
                }
            });
    }

    function setText(elem, text, k = 1, maxSize = 25, minSize = 12) {
        
        let size = Math.max(Math.min(1 / text.length * 650, maxSize * k), minSize * k);
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
            updatePhrases(appData.currentPhrase.target, appData.currentPhrase.native);

            elements.phraseText.addClass('text-info');
            elements.phraseHint.removeClass('text-info').addClass('text-muted');
        } else {
            updatePhrases(appData.currentPhrase.native, appData.currentPhrase.target);

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
        if (!appData.currentPhrase) return;
        return speechSynthesizer.speak(appData.currentPhrase, lang, 
                    appData.currentPhrase.type, state.speed, state.genderVoice);
    }

    function refreshProgressBar() {
        let percent = appData.currentPhraseList ? Math.round(state.currentPhraseIndex / appData.currentPhraseList.length * 100) : 0;
        elements.progressBar.css('width', percent + '%');
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

    // Обновить отображение
    function updateDisplay() {
        if (appData.currentPhraseList.length === 0) {
            updatePhrases('Список фраз пуст', 'Выберите список фраз в настройках');
            elements.phraseCounter.text('0 / 0');
            elements.phraseType.text('Не выбран');
            return;
        }
        
        if (!appData.currentPhrase) {
            appData.currentPhrase = appData.currentPhraseList[0];
        }
        
        if (appData.currentPhrase) {

            updatePhrases(appData.currentPhrase.native, appData.currentPhrase.target);
            elements.phraseText.removeClass('text-info');
            elements.phraseHint.addClass('text-info');
            
            elements.phraseCounter.text(`${state.currentPhraseIndex + 1} / ${appData.currentPhraseList.length}`);
            elements.phraseType.text(appData.currentPhrase.FormatType());
        }

        refreshProgressBar();
    }

    // Обновить кнопки управления
    function updateControls() {
        let isPlay = stateManager.isPlaying && !stateManager.isPaused;

        if (isPlay) enableWakeLock();
        else disableWakeLock();

        // Обновить контролы плеера
        if (playerControls) {
            playerControls.updatePlayButton(stateManager.isPlaying && !stateManager.isPaused);
            
            const hasPrev = stateManager.isPlaying && appData.currentPhraseList.length > 0;
            const hasNext = appData.currentPhraseList.length > 0;
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
    
    init();
});