let wakeLock = null;
let speechSynthesizer = null;
let stateManager = null;
let _vkWakeLockTimer = null;
let phrasesList = null;
let playerControls = null;
let recognition = null;

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
        tracer.log('Wake Lock активирован');
        */
}

async function disableWakeLock() {
    if (wakeLock !== null) {
        await wakeLock.release();
        wakeLock = null;
        //tracer.log('Wake Lock деактивирован');
    }

    if (_vkWakeLockTimer != null) {
        clearInterval(_vkWakeLockTimer);
        _vkWakeLockTimer = null;
        //tracer.log('Wake Lock деактивирован');
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

function debounce(func, wait, start = null) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        clearTimeout(timeout);
        if (start) start();
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
        <div class="alert ${alertClass} alert-dismissible fade show position-fixed end-0 m-3" role="alert">
            ${message}
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert"></button>
        </div>
    `);
    
    $('body').append(alert);
    setTimeout(() => alert.alert('close'), 3000);
}

class Phrase {
    constructor(data, type) {
        this.native     = data['native'];
        this.target     = data['target'];
        this.direction  = data['direction'];
        this.context    = data['context'];
        this.difficulty_level = data['difficulty_level'];
        this.type       = type;
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

Phrase.createList = (sourceList, type)=>{
    let result = [];
    for (let key in sourceList)
        result.push(new Phrase(sourceList[key], type));
    return result;
}

$(document).ready(function() {
    
    // Инициализируем синтезатор речи
    speechSynthesizer = new SpeechSynthesizer(SPEECH_CONFIG);

    // Инициализируем менеджер состояния
    stateManager = new StateManager();
    stateManager.loadState();

    playerControls = new PlayerControls({
        autoHideDelay: 0
    });

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
        currentPhrase: null,
        playStart: false,
        scaleBlockUpdater: debounce(() => {
            let block = elements.phraseScaleBlock;
            let scale = Math.min(1, block.parent().innerHeight() / block.height());
            block.css('scale', scale);
        }, 50)
    };

    // DOM элементы
    const elements = {
        phraseText: $('#phraseText'),
        phraseHint: $('#phraseHint'),
        phraseScaleBlock: $('.scale-block'),
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
        tvScreenToggle: $('#tvScreenToggle'),
        repeatLength: $('#repeatLength'),
        repeatCount: $('#repeatCount'),
        currentRepeat: $('#currentRepeat'),
        genderVoice: $('#genderVoice'),
        recognizeToggle: $('#recognizeToggle')
    };
            
    // Создаем объект распознавания
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition)
        recognition = new VRecognition(new SpeechRecognition());
    else $('#recognizeToggleForm').css('display', 'none');

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
        phrasesList = new PhrasesListView($('#other-content .list-view'));
        
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
        });
    }

    function initPhraseList() {
        /*
        fullPhraseList(elements.phraseListSelect);
        fullPhraseList(elements.phraseListPlayer);
        */
        phrasesList.setDefaultList(Object.assign({all: 'Все фразы (смешанные)'}, phrasesData), 
            state.currentListType, 'Предустановленные типы фраз');
    }

    // Загрузка списка фраз
    function loadPhraseList(resetIndex = false) {
        if (state.currentListType === 'all') {
            // Смешиваем все фразы
            appData.currentPhraseList = [];
            Object.keys(phrasesData).forEach(key => {
                appData.currentPhraseList = appData.currentPhraseList.concat(Phrase.createList(phrasesData[key], key));
            });
        } else {
            appData.currentPhraseList = Phrase.createList(phrasesData[state.currentListType], state.currentListType) || [];
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
        setCurrentPhraseIndex(getProgressIndex());
    }

    function setProgress(curentRepeat, a_index) {
        let newParams = {
            currentRepeat: curentRepeat,
            index: a_index
        }
        
        state.progress[state.currentListType] = $.extend(state.progress[state.currentListType], newParams);
        stateManager.updatePlaybackState({
            progress: state.progress
        });
        return 0;
    }

    function getProgressIndex() {
        if (typeof state.progress[state.currentListType] == 'object')
            return state.progress[state.currentListType].index;
        return 0;
    }

    function getCurentRepeat() {
        if (typeof state.progress[state.currentListType] == 'object')
            return state.progress[state.currentListType].currentRepeat;
        return 0;
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

        elements.progressControl.click((e)=>{
            if (appData.currentPhraseList) {
                const rect = e.target.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const index = Math.round(appData.currentPhraseList.length * clickX / rect.width);
                setProgress(0, index);
                setCurrentPhraseIndex(index);
                if (stateManager.isPlaying && !stateManager.isPaused)
                    playCurrentPhrase();
            }
        });

        $(window).on('select_phrase_list', (e, type)=>{
            setCurrentType(type);
        });

        $(window).on('resize', function() {
            updateSizePlayerTexts();
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
            direction: $('[data-direction].active').data('direction'),
            order: $('[data-order].active').data('order'),
            showTvScreen: elements.tvScreenToggle.prop('checked'),
            recognize: elements.recognizeToggle.prop('checked'),
            repeatLength: elements.repeatLength.val(),
            repeatCount: elements.repeatCount.val(),
            genderVoice: elements.genderVoice.val()
        };

        if (newSettings.repeatCount < getCurentRepeat())
            setProgress(0, getProgressIndex());
        
        // Проверяем, изменился ли список фраз
        const listChanged = stateManager.hasListChanged(
            state.currentListType, 
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
            $(window).trigger('selected_list_type', state.currentListType);
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
            stopRecognition();

            // Сохраняем ключ текущего списка
            const listKey = stateManager.generateListKey(
                state.currentListType, 
                state.order, 
                phrasesData
            );

            stateManager.updateSettings(state);
            stateManager.setCurrentListData(listKey);
            stateManager.updatePlaybackState({
                currentPhraseIndex: state.currentPhraseIndex,
                showingFirstLang: state.showingFirstLang,
                currentListType: state.currentListType,
                order: state.order,
            });
            loadPhraseList(true);
            
            $(window).trigger('selected_list_type', state.currentListType);

            if (stateManager.isPlaying) {
                debouncePage(()=>{
                    speechSynthesizer.waitForCompletion()
                        .then(()=>{
                            playCurrentPhrase();
                        });
                });
            }
        }
    }

    // Применить состояние TV-экрана
    function applyTvScreenState() {
        const tvScreen = $('.tv-screen');
        if (state.showTvScreen)
            tvScreen.show();
        else tvScreen.hide();
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
        
        stateManager.isPlaying  = true;
        stateManager.isPaused   = false;
        state.showingFirstLang  = true;
        appData.missOne         = state.repeatLength > 1;
        
        // Сохраняем состояние
        stateManager.updatePlaybackState({
            showingFirstLang: true
        });
        
        updateControls();
        playCurrentPhrase();

        $(window).trigger("playback", 'start');
    }

    // Переключить паузу
    function togglePause() {
        if (!stateManager.isPlaying) return;

        speechSynthesizer.stop();
        stateManager.isPaused = !stateManager.isPaused;
        
        if (stateManager.isPaused) {
            clearTimeout(state.timeoutId);
            clearInterval(state.progressInterval);
            $(window).trigger("playback", 'stop');
        } else {
            appData.missOne  = state.repeatLength > 1;
            playCurrentPhrase();
            $(window).trigger("playback", 'start');
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
        stopRecognition();
        updateControls();
        updateDisplay();
    }

    function stopRecognition() {
        if (recognition)
            recognition.stop();
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
            appData.missOne = true;

            if ((state.repeatCount > 0) && (state.currentPhraseIndex % state.repeatLength == 0))
                setProgress(0, state.currentPhraseIndex);

            updateDisplay();
            debouncePage(()=>{  
            
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

    function calcTime(lang, forSpeak = true) {
        if (stateManager.state.recognize)
            return state.pauseBetweenPhrases * 1000 + 
                appData.currentPhrase[lang].length * AppConst.charTime[lang];

        else return (forSpeak ? Math.max(state.pauseBetweenPhrases - 1, 0) : state.pauseBetweenPhrases) * 1000 + 
                appData.currentPhrase[lang].length * AppConst.charTime[lang];
    }

    function incCurrentPhraseIndex() {
        let newIndex = (state.currentPhraseIndex + 1) % appData.currentPhraseList.length;

        let newRepeat = getCurentRepeat();
        if ((state.repeatCount > 0) && (newIndex % state.repeatLength == 0)) {
            if (!appData.missOne) {

                newRepeat += 1;
                if (newRepeat > state.repeatCount)
                    newRepeat = 0;
                else newIndex = Math.max(0, newIndex - state.repeatLength);

                tracer.log(`newRepeat: ${newIndex}, newIndex: ${newIndex}`);
            }
        }

        appData.missOne = false;
        setProgress(newRepeat, newIndex);
        setCurrentPhraseIndex(newIndex);
    }

    function setCurrentPhraseIndex(index) {
        let newIndex = Math.max(0, Math.min(index, appData.currentPhraseList.length - 1));

        state.currentPhraseIndex = newIndex;
        state.showingFirstLang = true;
        appData.currentPhrase = appData.currentPhraseList[state.currentPhraseIndex];

        stateManager.updatePlaybackState({
            currentPhraseIndex: state.currentPhraseIndex
        });

        setProgress(getCurentRepeat(), newIndex);
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

                    if (secondLang == 'target')
                        startCurrentRecognition(secondLang);

                    speakPause(() => {
                        state.showingFirstLang = false;
                        playCurrentPhrase();
                    }, firstLang);
                });
        } else {

            showPhrase(secondLang);
            speechSynthesizer.speak(appData.currentPhrase, secondLang, 
                    appData.currentPhrase.type, state.speed, state.genderVoice)
                .then((result)=>{

                    if (firstLang == 'target')
                        startCurrentRecognition(firstLang);
                    
                    speakPause(() => {
                        incCurrentPhraseIndex();
                        playCurrentPhrase();
                    }, secondLang);
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

                startCurrentRecognition('target');                
                speakPause(() => {
                    incCurrentPhraseIndex();
                    playCurrentPhrase();
                }, speakLang);
            });
    }

    function startCurrentRecognition(phraseDirect) {
        if (recognition && stateManager.state.recognize) 
            recognition.startRecognition(calcTime(phraseDirect, false), appData.currentPhrase, phraseDirect);
    }

    function speakPause(callback, phraseDirect) {
        clearTimeout(state.timeoutId);
        state.timeoutId = setTimeout(callback, calcTime(phraseDirect));
    }

    function updateSizeText(elem, k = 1, maxSize = 36, minSize = 18) {
        let text = elem.text();
        let width = elem.closest('.phrase-container').innerWidth();
        let wk = 2.75;
        let size = Math.max(Math.min(1 / text.length * width * wk, maxSize * k), minSize * k);
        elem.css('font-size', size);
    }

    function setText(elem, text, k = 1) {
        if (elem.data('text') != text) {
            elem.data('text', text);

            elem.text(text);

            updateSizeText(elem, k);
            return true;
        }
        return false;
    }

    function updateSizePlayerTexts() {
        updateSizeText(elements.phraseText, 1);
        updateSizeText(elements.phraseHint, 0.7);
        appData.scaleBlockUpdater();
    }

    function updatePhrases(text, hint) {
        return setText(elements.phraseText, text, 1) &&
                setText(elements.phraseHint, hint, 0.7);
    }

    // Показать фразу
    function showPhrase(lang) {
        let updated = false;

        if (lang === 'target') {
            updated = updatePhrases(appData.currentPhrase.target, appData.currentPhrase.native);

            elements.phraseText.addClass('text-info');
            elements.phraseHint.removeClass('text-info').addClass('text-muted');
        } else {
            updated = updatePhrases(appData.currentPhrase.native, appData.currentPhrase.target);

            elements.phraseText.removeClass('text-info');
            elements.phraseHint.addClass('text-info');
        }
        
        if (updated) {
            appData.scaleBlockUpdater();
            // Анимация
            elements.phraseScaleBlock.addClass('animate-text');
            setTimeout(() => {
                elements.phraseScaleBlock.removeClass('animate-text');
            }, 500);
        }
    }

    // Озвучить текущую фразу
    function speakCurrentPhrase(lang) {
        if (!appData.currentPhrase) return;
        return speechSynthesizer.speak(appData.currentPhrase, lang, 
                    appData.currentPhrase.type, state.speed, state.genderVoice);
    }

    function refreshProgressBar() {
        let percent = (appData.currentPhraseList && (appData.currentPhraseList.length > 0)) ? 
                        Math.round(state.currentPhraseIndex / (appData.currentPhraseList.length - 1) * 100) : 0;
        elements.progressBar.css('width', percent + '%');
    }

    // Обновить отображение
    function updateDisplay() {
        if (appData.currentPhraseList.length === 0) {
            updatePhrases('Список фраз пуст', 'Выберите список фраз ниже');
            elements.phraseCounter.text('0 / 0');
            elements.phraseType.text('Не выбран');
            return;
        }
        
        if (appData.currentPhrase) {

            let showLang = state.direction === 'target-native' ? 'target' : 'native';

            if (isBothDirectionsMode()) {
                let tton = state.direction === 'target-native-both';
                if (!state.showingFirstLang)
                    showLang = tton ? 'native' : 'target';
                else showLang = tton ? 'target' : 'native';
            }

            showPhrase(showLang);
            
            let currentRepeat = getCurentRepeat();
            elements.phraseCounter.text(`${state.currentPhraseIndex + 1} / ${appData.currentPhraseList.length}`);
            elements.phraseType.text(appData.currentPhrase.FormatType());
            elements.currentRepeat.html((state.repeatCount > 0) && (currentRepeat > 0) ? 
                ('<i class="bi bi-repeat"></i> ' + currentRepeat + '-й раз') : '');
        }

        refreshProgressBar();
    }

    // Обновить кнопки управления
    function updateControls() {
        let isPlay = stateManager.isPlaying && !stateManager.isPaused;

        if (isPlay) enableWakeLock();
        else disableWakeLock();

        // Обновить контролы плеера
        if (playerControls)
            playerControls.updatePlayButton(isPlay);

        if (!isPlay)
            elements.progressBar.removeClass('progress-bar-animated');
        else if (!elements.progressBar.hasClass('progress-bar-animated'))
            elements.progressBar.addClass('progress-bar-animated');
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