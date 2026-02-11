let wakeLock = null;
let speechSynthesizer = null;
let stateManager = null;
let _vkWakeLockTimer = null;
let phrasesList = null;
let playerControls = null;
let recognition = null;


const AppConst = {
    charTime: {
        target: 20,
        native: 30
    }
}

async function enableWakeLock() {

    if (typeof vkBridge !== 'undefined') {
        if (_vkWakeLockTimer != null) clearInterval(_vkWakeLockTimer);
        _vkWakeLockTimer = setInterval(() => {
            vkBridge.send('VKWebAppTapticImpactOccurred', {
                style: 'light'
            }).catch(() => {});
        }, 60000);
    }

    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
        } catch (err) {
            tracer.log('Wake Lock ошибка:', err);
        }
    } else tracer.log("navigator not have wakeLock");

    if (wakeLock)
        tracer.log('Wake Lock активирован');
}

async function disableWakeLock() {
    if (wakeLock !== null) {
        await wakeLock.release();
        wakeLock = null;
        tracer.log('Wake Lock деактивирован');
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
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `);
    
    $('body').append(alert);
    setTimeout(() => alert.alert('close'), 3000);
}

function Wrong(message=null) {
    showAlert(isEmpty(message) ? "Что-то пошло не так!" : message);
}

function Confirm(message, title='Подтвердить') {
    let modal = $('#сonfirm');
    modal.find('.content').html(message);
    modal.find('.modal-title').text(title);
    modal.modal('show');
    return new Promise((resolve, reject)=>{
        modal.find('.btn-primary').click(()=>{
            resolve(true);
        });
    });
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


function showAdvices() {
    let list = [
        `<p>Для эффективного запоминания и доведения речевых навыков до автоматизма рекомендуем чередовать последовательность воспроизведения русской и английской версий фраз.</p><p>Так вы будете тренировать не только автоматизм произношения, но и скоростное восприятие речи на слух.</p>`,

        `<p>В настройках вы найдёте все необходимые для этого параметры: паузу между фразами, последовательность перевода, различные варианты озвучки, повторы и др.</p>
        <p>Рекомендуем повторять английские фразы вслед за диктором — это важно! Так вы формируете речевую моторику.</p>`,

        `<p>Выбирайте в настройках режим «Оба направления».</p>
        <p>В этом режиме:
        <ul>
            <li>Сначала прослушайте фразу на русском и попытайтесь вслух произнести её перевод на английский до того, как зазвучит голос диктора.</li>
            <li>Затем прослушайте правильный перевод и снова повторите фразу за диктором.</li>
        </ul>
        </p>`,


        `<p>Если не успеваете, увеличьте паузу между фразами в настройках приложения.</p>
        <p>Можно также сменить направление на «Английский → Русский».</p><p>В этом случае:
        <ul>
            <li>Прослушайте фразу на английском и попытайтесь перевести её на русский вслух до озвучки диктором.</li>
            <li>Затем слушайте правильный перевод.</li>
        </ul>
        </p><p>Так вы будете развивать навык понимания английской речи на слух.</p>`,

        `<p>Включите в настройках режим "Распознавание речи".</p>
        <p>Так вы сможете контролировать свое произношение, а также отслеживать свой прогресс обучения.
        </p>
        <p>Делитесь своим опытом, пишите пожелания и предложения по работе тренажёра в нашей группе.</p>
        <hr>
        <p><span class="bi bi-award me-2"><span> Успешного обучения!</p>`
    ];
    appAlert(list, 'Помощь, советы и рекомендации');
}

function Application() {
    
    // Инициализируем синтезатор речи
    speechSynthesizer = new SpeechSynthesizer(SPEECH_CONFIG);

    // Инициализируем менеджер состояния
    var state;
    if (window.stateManager)
        stateManager = window.stateManager;
    else stateManager = new StateManager();

    stateManager.loadState()
        .then((a_state)=>{
            state = a_state;
            init();
        })
        .catch(()=>{
            state = stateManager.getState();
            init();
        });

    playerControls = new PlayerControls({
        autoHideDelay: 0
    });

    var appData = {
        currentPhraseList: [],
        currentPhrase: null,
        timeoutId: null,
        pageScrollTimerId: null,
        playStart: false,
        scaleBlockUpdater: debounce(() => {
            let block = elements.phraseScaleBlock;
            let scale = Math.min(1, block.closest('.phrase-container').innerHeight() / block.height());
            block.css('scale', scale);
        }, 5),
        backgroundAudio: null
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
        regenerateBtn: $('#regenerateBtn'),
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
        recognizeToggle: $('#recognizeToggle'),
        backgroundPlayback: $('#backgroundPlayback'),
        useSpeakPhrase: $('#useSpeakPhrase')
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
                if (!stateManager.isPaused && stateManager.isPlaying && !state.backgroundPlayback)
                    stopPlayback();
            }
        });

        if (phrasesData)
            afterLoadList(phrasesData);
        else loadList();
    }

    function setInitParams(init_params) {
        tracer.log(init_params);

        state.currentListType = init_params.type;
        state.voiceType = init_params.voice;
        state.direction = init_params.translate_direct == 'en-ru' ? 'target-native-both' : 'native-target-both';
        state.pauseBetweenPhrases =init_params.pause;
    }

    function afterLoadList(data) {

        phrasesData = data;
        phrasesList = new PhrasesListView($('#other-content .list-view'));

        if (typeof app_init_params != 'undefined')
            setInitParams(app_init_params);
        
        initPhraseList();

        $(window).trigger('phrases_loaded');

        $('.page').addClass('page-loaded');

        if (typeof userApp == 'undefined') 
            initCurrentType();
    }

    function initCurrentType() {

        let type = state.currentListType;
        if (typeof phrasesData[type] == 'undefined')
            setCurrentType(Object.keys(phrasesData)[0]);
        else {
            loadPhraseList();

            // Восстанавливаем отображение из сохранённого состояния
            if (appData.currentPhrase) {
                updateDisplay();
            }
        }
    }

    function randomTest() {
        let keys = Object.keys(phrasesData);
        setTimeout(()=>{
            let index = Math.round(Math.random() * (keys.length - 1));
            setCurrentType(keys[index]);
            randomTest();
        }, 10 + Math.round(Math.random() * 100));
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
            let type = state.currentListType;
            if (typeof phrasesData[state.currentListType] == 'undefined')
                type = Object.keys(phrasesData)[0];

            appData.currentPhraseList = Phrase.createList(phrasesData[type], type) || [];
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
        elements.regenerateBtn.click(()=>{

            let directLang = state.direction === 'target-native' ? 'target' : (
                    state.direction === 'native-target' ? 'native' :
                        (state.direction === 'target-native-both' ? 'target' : 'native'));

            let phrase = appData.currentPhrase[directLang];
            tracer.log(`Attempt regenerate ${phrase}, ${state.genderVoice}`);
            speechSynthesizer.Regenerate(appData.currentPhrase, directLang, state.genderVoice);
        });

        elements.playButton[0].addEventListener('click', () => {
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

        (()=>{
            let index = 0;

            let replay = debounce(()=>{
                setCurrentPhraseIndex(index);
                startPlayback();
            }, 700);

            elements.progressControl.click((e)=>{
                if (appData.currentPhraseList) {
                    const rect = e.target.getBoundingClientRect();
                    const k = (e.clientX - rect.left) / rect.width;
                    index = Math.round(appData.currentPhraseList.length * k);
                    if (index != state.currentPhraseIndex) {
                        setCurrentPhraseIndex(index);
                        setProgress(0, index);

                        if (isPlaying()) {
                            stopPlayback();
                            replay();
                        }
                    }
                }
            });
        })();

        $(window).on('select_phrase_list', (e, type)=>{
            setCurrentType(type);
        });

        $(window).on('resize', function() {
            updateSizePlayerTexts();
        });

        window.addEventListener('focus', (e)=>{
            stateManager.loadState()
                .then(()=>{
                    let server_state = stateManager.getState();
                    if (server_state.currentListType != state.currentListType) {
                        state = server_state;
                        loadPhraseList();
                        updateDisplay();
                        $(window).trigger('selected_list_type', state.currentListType);
                    } else state = server_state;
                });
        });

        $(window).on('play_autio_error', function(e, error) {
            if (error.name == 'NotAllowedError') {
                showAlert("Ваш браузер блокирует проигрывание звука. Нажмите 'Воспроизвести'");
                stopPlayback();
            } else if (error.name == 'AbortError') {
                showAlert("Проигрывание прервано. Нажмите 'Воспроизвести'");
                stopPlayback();
            } else if (error.name == 'No speech synthesis') {
                showAlert("Невозможно проиграть эту фразу");
                stopPlayback();
            }
        });

        $(window).on('added_user_list', (e, item)=> {
            appendUserList(item.name, item.list);
        });


        $(window).on('user_list_loaded', (e, data)=>{

            if (data)
                Object.keys(data).forEach(key => {
                    appendUserList(key, data[key]);
                });

            if (appData.currentPhraseList.length == 0)
                initCurrentType();
        });       

        $(window).on('user_list_removed', (e, name)=>{
            if (phrasesData[name]) {
                delete(phrasesData[name]);
                if (state.currentListType == name)
                    setCurrentType();
            }
        });
    }

    function appendUserList(name, list) {

        if (phrasesData[name])
            list = mergePhrasesSimple([...phrasesData[name], ...list]);

        phrasesData[name] = list;
        if (state.currentListType == name) {
            state.currentListType = null;
            setCurrentType(name);
        }
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
        elements.backgroundPlayback.prop('checked', state.backgroundPlayback);
        elements.useSpeakPhrase.prop('checked', state.useSpeakPhrase);

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
            genderVoice: elements.genderVoice.val(),
            backgroundPlayback: elements.backgroundPlayback.prop('checked'),
            useSpeakPhrase: elements.useSpeakPhrase.prop('checked')
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

    function setCurrentType(type = null) {

        let keys = Object.keys(phrasesData);
        keys.push('all');

        if (!type || !keys.includes(type))
            type = keys[0];

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

    function isPlaying() {
        return stateManager.isPlaying && !stateManager.isPaused;
    }

    function togglePlay(e) {
        if (stateManager.isPaused || stateManager.isPlaying) {
            togglePause();
        } else {
            startPlayback();
        }
    }

    function playBackgrounAudio() {

        if (state.backgroundPlayback) {
            if (!appData.backgroundAudio) {
                let audio = new Audio();
                audio.src = 'data/sounds/silence.mp3';
                audio.preload = 'auto';
                audio.volume = 0.1;
                audio.playbackRate = 1.0;
                audio.loop = true; // Включаем зацикливание

                appData.backgroundAudio = audio;
            }

            appData.backgroundAudio.play();
        }
    }

    function stopBackgroundAudio() {

        if (appData.backgroundAudio)
            speechSynthesizer.stopAudio(appData.backgroundAudio);
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
        playBackgrounAudio();
        playCurrentPhrase();

        $(window).trigger("playback", 'start');
    }

    // Переключить паузу
    function togglePause() {
        if (!stateManager.isPlaying) return;

        speechSynthesizer.stop();
        stateManager.isPaused = !stateManager.isPaused;
        
        if (stateManager.isPaused) {
            clearTimeout(appData.timeoutId);
            $(window).trigger("playback", 'stop');
            stopRecognition();
            stopBackgroundAudio();

        } else {
            appData.missOne  = state.repeatLength > 1;

            playBackgrounAudio();
            playCurrentPhrase();
            $(window).trigger("playback", 'start');
        }
        
        updateControls();
    }

    // Остановить воспроизведение
    function stopPlayback() {
        stateManager.isPlaying = false;
        stateManager.isPaused = false;
        clearTimeout(appData.timeoutId);
        speechSynthesizer.stop();
        stopRecognition();
        updateControls();
        updateDisplay();
    }

    function stopRecognition() {
        if (recognition)
            recognition.Stop();
    }

    function debouncePage(callback) {

        clearTimeout(appData.timeoutId);

        if (appData.pageScrollTimerId) 
            clearTimeout(appData.pageScrollTimerId);

        appData.pageScrollTimerId = setTimeout(()=>{
            appData.pageScrollTimerId = null;
            callback();
        }, 500);
    }

    function setCurrentPhraseIndexNextOrPrev(index) {
        if (state.currentPhraseIndex != index) {

            setCurrentPhraseIndex(Math.max(0, Math.min(appData.currentPhraseList.length - 1, index)), false);

            if (state.repeatCount > 0) {
                appData.missOne = state.repeatLength > 1;

                if (state.currentPhraseIndex % state.repeatLength == 0)
                    setProgress(0, state.currentPhraseIndex);
            } else appData.missOne = true;

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

    function calcTime(lang) {
        return Math.round(Math.max(state.pauseBetweenPhrases - 1, 0) * 1000 + (state.useSpeakPhrase ? appData.currentPhrase[lang].length * AppConst.charTime[lang] : 0));
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

    function _speak(showLang, speakLang, then) {
        clearTimeout(appData.timeoutId);
        showPhrase(showLang);

        let startTime = Date.now();

        tracer.log(`${state.currentListType}: ${state.currentPhraseIndex} start ${appData.currentPhrase[speakLang]}`);
        speechSynthesizer.speak(appData.currentPhrase, speakLang, 
                    appData.currentPhrase.type, state.speed, state.genderVoice)
                .then((result) => {
                    if (isPlaying()) {
                        diff = Date.now() - startTime;
                        tracer.log(`${state.currentListType}: ${state.currentPhraseIndex} finish ${diff}`);
                        then();
                    }
                })
                .catch((error)=>{
                    tracer.error(error);
                    stopPlayback();
                });
    }

    // Воспроизведение в обоих направлениях
    function playBothDirections() {

        if (!isPlaying()) return;

        const isEnFirst = state.direction === 'target-native-both';
        const firstLang = isEnFirst ? 'target' : 'native';
        const secondLang = isEnFirst ? 'native' : 'target';
        
        if (state.showingFirstLang) {
            // Показываем и озвучиваем первый язык
            stopRecognition();

            _speak(firstLang, firstLang, ()=>{
                startCurrentRecognition('target');

                speakPause(() => {
                    summingUpRecognition();
                    state.showingFirstLang = false;
                    playCurrentPhrase();
                }, firstLang);
            });
        } else {
            _speak(secondLang, secondLang, ()=>{
                
                speakPause(() => {
                    summingUpRecognition();
                    incCurrentPhraseIndex();
                    playCurrentPhrase();
                }, secondLang);
            });
        }
    }

    // Воспроизведение в одном направлении
    function playSingleDirection() {

        if (!isPlaying()) return;

        const showLang = state.direction === 'target-native' ? 'target' : 'native';
        const speakLang = state.direction === 'target-native' ? 'native' : 'target';

        _speak(showLang, speakLang, ()=>{

            startCurrentRecognition('target');     
            speakPause(() => {
                summingUpRecognition();
                incCurrentPhraseIndex();
                playCurrentPhrase();
            }, speakLang);
        });
    }

    function summingUpRecognition(phraseDirect) {
        if (recognition && stateManager.state.recognize) 
            recognition.SummingUp();
    }

    function startCurrentRecognition(phraseDirect) {
        if (recognition && stateManager.state.recognize) 
            recognition.startRecognition(appData.currentPhrase, phraseDirect);
    }

    function speakPause(callback, phraseDirect) {
        clearTimeout(appData.timeoutId);
        let delay = calcTime(phraseDirect);

        if (isNumeric(delay) && (delay > 0))
            appData.timeoutId = setTimeout(callback, delay);
        else callback();
    }

    function updateSizeText(elem, k = 1, maxSize = 36, minSize = 18) {
        let text = elem.text();
        let width = elem.closest('.phrase-container').innerWidth();
        let wk = 2.3;
        let size = Math.max(Math.min(1 / text.length * width * wk, maxSize * k), minSize * k);
        elem.css('font-size', size);
    }

    function setText(elem, text, k = 1) {
        if (elem.data('text') != text) {
            elem.data('text', text);
            elem.text(text);
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

            elements.phraseText.addClass('text-target');
            elements.phraseHint.removeClass('text-target').addClass('text-muted');
        } else {
            updated = updatePhrases(appData.currentPhrase.native, appData.currentPhrase.target);

            elements.phraseText.removeClass('text-target');
            elements.phraseHint.addClass('text-target');
        }
        
        if (updated) {
            updateSizePlayerTexts();
            // Анимация
            elements.phraseScaleBlock.addClass('animate-text');
            setTimeout(() => {
                elements.phraseScaleBlock.removeClass('animate-text');
            }, 500);
        }
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
        let isPlay = isPlaying();

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
};

$(document).ready(function() {
    let isModalOpen = false;
    let backButtonPressed = false;

    // 2. Отслеживание bootstrap модальных окон
    $(document).on('show.bs.modal', function() {
        isModalOpen = true;
        // Добавляем состояние в историю
        history.pushState({ modalOpen: true }, '');
    });

    $(document).on('hidden.bs.modal', function() {
        isModalOpen = false;
        // Удаляем состояние из истории
        if (history.state && history.state.modalOpen) {
            history.back();
        }
    });

    // 3. Обработка браузерной кнопки "Назад"
    window.addEventListener('popstate', function(e) {
        if (isModalOpen) {
            // Закрываем все модальные окна
            $('.modal.show').modal('hide');
            
            // Блокируем переход назад
            history.pushState(null, '', window.location.href);
            e.preventDefault();
        }
    });

    // 5. Перехват всех ссылок и кнопок, которые могут открыть модальные окна
    $(document).on('click', '[data-bs-toggle="modal"]', function() {
        isModalOpen = true;
        history.pushState({ modalOpen: true }, '');
    });

    Application();
});