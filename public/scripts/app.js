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
    },
    directions: {
        'quiz': [{
                show: {
                    text: 'target',
                    blur: ['text']
                }, 
                speak: 'target', 
                listen: 'native'
            },{
                show: {
                    text: 'target'
                }, 
                speak: 'target', 
                listen: 'native'
            },{
                show: 'native', 
                speak: 'native'
            }
        ],
        'native-target': [
            {
                show: 'native', 
                speak: 'target', 
                listen: 'target'
            }
        ],
        'target-native': [
            {
                show: 'target', 
                speak: 'native', 
                listen: 'target'
            }
        ],
        'native-target2': [
            {
                show: 'native', 
                speak: 'target', 
                listen: 'target'
            },{
                show: 'native', 
                speak: 'target', 
                listen: 'target'
            }
        ],
        'native-target-both': [
            {
                show: 'native', 
                speak: 'native', 
                listen: 'target'
            },{
                show: 'target', 
                speak: 'target', 
                listen: 'target'
            }
        ],
        'target-native-both': [{
                show: 'target', 
                speak: 'target', 
                listen: 'target'
            },{
                show: 'native', 
                speak: 'native', 
                listen: 'target'
            }
        ],
        'native-target2-both': [
            {
                show: 'native', 
                speak: 'native', 
                listen: 'target'
            },{
                show: 'target', 
                speak: 'target', 
                listen: 'target'
            },{
                show: 'target', 
                speak: 'target', 
                listen: 'target'
            }
        ],
        'target2-native-both': [{
                show: 'target', 
                speak: 'target', 
                listen: 'target'
            },{
                show: 'target', 
                speak: 'target', 
                listen: 'target'
            },{
                show: 'native', 
                speak: 'native', 
                listen: 'target'
            }
        ],
        'target2-native-target-both': [{
                show: 'target', 
                speak: 'target', 
                listen: 'target'
            },{
                show: 'target', 
                speak: 'target', 
                listen: 'target'
            },{
                show: 'native', 
                speak: 'native', 
                listen: 'target'
            },{
                show: 'target', 
                speak: 'target', 
                listen: 'target'
            }
        ],
        'dialog_prepare': [
            {
                show: 'target',
                speak: 'target',
                listen: 'target',
                genderVoice: 0,
                nextPhrase: true
            },{
                show: 'target',
                speak: 'target',
                listen: 'target',
                genderVoice: 1,
                nextPhrase: true
            }
        ],
        'dialog_exam': [
            {
                show: 'target',
                speak: 'target',
                listen: 'target',
                genderVoice: 0,
                nextPhrase: true
            },{
                show: 'target',
                speak: {
                    direct: 'target',
                    volume: 0
                },
                listen: 'target',
                genderVoice: 1,
                nextPhrase: true
            }
        ]
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
            tracer.log('Wake Lock error:', err);
        }
    } else tracer.log("navigator not have wakeLock");

    if (wakeLock)
        tracer.log('Wake Lock activated');
}

async function disableWakeLock() {
    if (wakeLock !== null) {
        await wakeLock.release();
        wakeLock = null;
        tracer.log('Wake Lock deactivated');
    }

    if (_vkWakeLockTimer != null) {
        clearInterval(_vkWakeLockTimer);
        _vkWakeLockTimer = null;
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
    showAlert(isEmpty(message) ? Lang("something_went_wrong") : message);
}

function Confirm(message, title=Lang("confirm")) {
    return Alert(message, title, true);
}

function Alert(message, title=Lang("info"), showCancel = false) {
    let modal = $('#сonfirm');
    modal.find('.content').html(message);
    modal.find('.modal-title').text(title);
    modal.find('.btn.btn-secondary').css('display', showCancel ? 'block' : 'none');
    modal.modal('show');
    return new Promise((resolve, reject)=>{
        modal.find('.btn-primary').click(()=>{
            resolve(true);
        });
    });
}

class Phrase {
    constructor(data, type) {
        this.id         = data['id'];
        this.native     = data['native'];
        this.target     = data['target'];
        this.direction  = data['direction'];
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

function Application() {
    
    speechSynthesizer = new SpeechSynthesizer(SPEECH_CONFIG);

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
        selectTypeRecently: false,
        timeoutId: null,
        pageScrollTimerId: null,
        playStart: false,
        scaleBlockUpdater: debounce(() => {
            let block = elements.phraseScaleBlock;
            let scale = block.closest('.phrase-container').innerHeight() / block.height();
            block.css('scale', `calc(min(${scale}, var(--min-scale))`);
        }, 5),
        backgroundAudio: null,
        quizAnswered: false
    };

    const elements = {
        mode_direction: $('#mode-direction'),
        phraseText: $('#phraseText'),
        phraseHint: $('#phraseHint'),
        phraseScaleBlock: $('.scale-block'),
        phraseCounter: $('#phraseCounter'),
        phraseType: $('#phraseType'),
        progressBar: $('#progressBar'),
        progressControl: $('#progressControl'),
        saveDirection: $('#saveDirection'),
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
        useSpeakPhrase: $('#useSpeakPhrase'),
        deskBlock: $('#desk-block')
    };
            
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition)
        recognition = new VRecognition(new SpeechRecognition());
    else $('#recognizeToggleForm').css('display', 'none');

    function init() {
        initElements();
        setupEventListeners();
        applyTvScreenState();

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

    function initElements() {
        let keys = Object.keys(AppConst.directions);
        keys.forEach(key=>{
            elements.mode_direction.append(`<option value="${key}">` + Lang(key) + `</option>`);
        });
    }

    function setInitParams(init_params) {
        state = {...state, ...init_params};
        if (init_params.type)
            state.currentListType   = init_params.type;
        if (init_params.voice)
            state.voiceType = init_params.voice;
        if (init_params.translate_direct)
            state.direction = init_params.translate_direct == LANGUAGE + '-ru' ? 'target-native-both' : 'native-target-both';
        if (init_params.pause)
            state.pauseBetweenPhrases = init_params.pause;
    }

    function afterLoadList(data) {

        phrasesData = data;
        phrasesList = new PhrasesListView($('#other-content .list-view'));

        if (typeof app_init_params != 'undefined')
            setInitParams(app_init_params);
        
        initPhraseList();

        $(window).trigger('phrases_loaded');

        $('body').addClass('page-loaded');

        if (typeof userApp == 'undefined') 
            initCurrentType();
    }

    function initCurrentType() {

        let type = state.currentListType;
        if (typeof phrasesData[type] == 'undefined') {
            if (type == '_favorites') {
                updateFavorites();
                setCurrentType('_favorites', true);
            } else setCurrentType(Object.keys(phrasesData)[0]);
        }
        else {
            loadPhraseList();

            if (appData.currentPhrase) {
                updateDisplay();
            }

            refreshDescription();
        }
    }

    function loadList() {
        Ajax({
            action: 'getList'
        }).then(afterLoadList);
    }

    function initPhraseList() {
        phrasesList.setDefaultList(Object.assign({all: Lang("all_phrases_mixed")}, phrasesData), 
            state.currentListType, Lang("preset_phrase_types"));
    }

    function loadPhraseList(resetIndex = false) {
        if (state.currentListType === 'all') {
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
        
        if (state.order === 'random') {
            const seed = state.randomSeed || Date.now();
            state.randomSeed = seed;
            shuffleArrayWithSeed(appData.currentPhraseList, seed);
            stateManager.setCurrentListData(state.currentListKey, seed);
        } else {
            state.randomSeed = null;
        }
        
        setCurrentPhraseIndex(getProgressIndex());
    }

    function getProgress() {
        return state.progress[state.currentListType] ? state.progress[state.currentListType] : {
            currentRepeat: 0,
            index: 0
        };
    }

    function setProgress(curentRepeat, a_index) {
        let params = {
            currentRepeat: curentRepeat,
            index: a_index
        };
        if (state.saveDirection)
            params.direction = state.direction;

        setProgressObject(params);
    }

    function setProgressObject(newParams) {

        let progress = {}
        Object.keys(state.progress).forEach((key)=>{progress[key] = state.progress[key];});
        
        progress[state.currentListType] = {...progress[state.currentListType], ...newParams};
        stateManager.updatePlaybackState({
            progress: progress
        });
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

    function setupEventListeners() {
        elements.nextBtn.click(nextPhrase);
        elements.prevBtn.click(prevPhrase);
        elements.regenerateBtn.click(()=>{

            let directLang = AppConst.directions[state.direction][state.indexInMode].speak;

            let phrase = appData.currentPhrase[directLang];
            tracer.log(`Attempt regenerate ${phrase}, ${state.genderVoice}`);
            speechSynthesizer.Regenerate(appData.currentPhrase, directLang, state.genderVoice);
        });

        elements.playButton[0].addEventListener('click', () => {
            togglePlay();
        });
        
        elements.settingsToggle.click(() => {
            openSettingsModal();
        });
        
        elements.applySettings.click(() => {
            applySettingsFromModal();
            $('#settingsModal').modal('hide');
        });
        
        elements.pauseSlider.on('input', function() {
            const value = parseFloat($(this).val());
            elements.pauseValue.text(value + ' ' + Lang("sec"));
        });
        
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

        $(window).on('start-play', function() {
            startPlayback();
        });

        $(window).on('stop-play', function() {
            stopPlayback();
        });

        $(window).on('recognized', onRecognized);
        $(window).on('pre_recognized', onPreRecognized);

        $(window).on('on_user_id', (e, user_id)=>{
            if (isNumeric(user_id))
                stateManager.config.use_server = true;
        })

        $(window).on('play_autio_error', function(e, error) {
            if (error.name == 'NotAllowedError') {
                showAlert(Lang("browser_blocks_audio_click_play"));
                stopPlayback();
            } else if (error.name == 'AbortError') {
                showAlert(Lang("playback_interrupted_click_play"));
                stopPlayback();
            } else if (error.name == 'No speech synthesis') {
                showAlert(Lang("cannot_play_this_phrase"));
                stopPlayback();
            }

            if (typeof ErrorTracker !== 'undefined')
                ErrorTracker.handleError({
                    error: 'play_autio_error',
                    message: error.name,
                    source: 'app.js'
                });
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

        elements.deskBlock.click(()=>{
            toggleDeskBlock();
        });

        elements.deskBlock.find('.score').click(()=>{
            Confirm(Lang('reset-score-question'))
                .then(()=>{
                    setScore(0, 0);
                });
        });

        $(window).on('favorites_list', (e)=>{
            updateFavorites();
            if (phrasesData['_favorites'].length > 0)
                setCurrentType('_favorites');
        });
    }

    function updateFavorites() {

        if (typeof phrase_favorites != 'undefined') {
            let items = [];
            Object.keys(phrasesData).forEach((key)=>{
                if (key != '_favorites')
                    phrasesData[key].forEach((item)=>{
                        if (phrase_favorites.includes(parseInt(item.id)))
                            items.push(item);
                    });
            });
            phrasesData['_favorites'] = items;
            if (items.length == 0)
                showAlert(Lang('favorites_empty'));
        }
    }

    function onPreRecognized(e, result) {
        stat.updateTimer('recognize', {value: result, phrase_id: appData.currentPhrase.id});
    }

    function onRecognized(e, result, text) {
        if (isQuiz() && !appData.quizAnswered) {
            let quiz_block = elements.deskBlock.find('.quiz-block');
            let ok = (result == 'success') || (result == 'almost');

            if (ok) {
                elem = quiz_block.find('.correct');

                elem.removeClass('btn-outline-secondary').addClass('btn-outline-success');
                stopQuestionQuiz();
                appData.quizAnswered = true;
                elements.deskBlock.find('.quiz-block .title').text(Lang('quiz-title-stop'));
            }
            addScope(ok ? 1 : 0, ok ? 0 : 1);
        }
        stat.stopTimer('recognize');
    }

    function isQuiz() {
        return state.direction == 'quiz';
    }

    function refreshDeskBlock() {
        elements.deskBlock.toggleClass('quiz', isQuiz());
        if (isQuiz() && appData.currentPhrase) {
            elements.deskBlock.find('.quiz-block .title').text(Lang(appData.quizAnswered ? 'quiz-title-stop' : (isPlaying() ? 'quiz-title' : 'quiz-title-play')));

            if (state.indexInMode == 0) {
                updateScore();
                if (appData.currentPhrase.incorrectList)
                    refreshIncorrectList();
                else {
                    appData.currentPhrase.incorrectList = {};
                    if (appData.currentPhrase.id) {
                        Ajax({
                            action: 'getIncorrect',
                            data: {
                                phrase_id: appData.currentPhrase.id
                            }
                        })
                        .then((data)=>{
                            if (data.success) {

                                let list = shuffleArrayWithSeed(data.list, Date.now());
                                appData.currentPhrase.incorrectList = list.slice(0, 3);
                                refreshIncorrectList();
                            } else UnawailableQuiz();
                        })
                        .catch((e)=>{
                            UnawailableQuiz();
                        });
                    } else UnawailableQuiz();
                }
            } else if (state.indexInMode == 1) {
                stopQuestionQuiz(!isPlaying() || appData.quizAnswered, !isPlaying());
            }
            else if (state.indexInMode > 1) {
                stopQuestionQuiz(true, false, true);
                if (!appData.quizAnswered)
                    addScope(0, 1);
            }
        }
    }

    function stopQuestionQuiz(stop = true, keep = false, tips = false) {
        elements.deskBlock.find('.quiz-block')
            .toggleClass('stop', stop)
            .toggleClass('keep', keep)
            .toggleClass('tips', tips);
    }

    function updateScore() {
        let progress = {...{success: 0, loss: 0, award: 0}, ...getProgress()};
        let scoreElem = elements.deskBlock.find('.quiz-block .score');
        let k = progress.success / progress.loss;
        let scoreText = progress.success + '/' + progress.loss;

        scoreElem.html(progress.award > 0 ? `<i class="bi bi-award"></i><span>${scoreText}</span>` : scoreText);
        scoreElem.toggleClass('success', k > 1).toggleClass('loss', k < 1);
    }

    function addScope(successAdd = 0, lossAdd = 0) {
        let progress = getProgress();
        
        setScore((progress.success ? progress.success : 0) + successAdd,
                (progress.loss ? progress.loss : 0) + lossAdd);

        stat.push(successAdd > 0 ? 'quiz_success' : 'quiz_loss', appData.currentPhrase.id, statParams());
    }

    function totalScore() {
        let total = 0;
        Object.keys(state.progress).forEach(key=>{
            total += state.progress[key].success ? state.progress[key].success : 0;
        });
        return total;
    }

    function setScore(success = 0, loss = 0) {
        let progress = {...{
            success: 0, 
            loss: 0, 
            award: 0
        }, ...getProgress()};

        let award = (success > 5) ? (success / Math.max(loss, 1) > 1.5 ? 1 : 0) : 0;
        if (award != progress.award) {

            $(window).trigger(award ? 'award' : 'dismiss', totalScore());
            progress.award = award;

        } else {

            if (progress.success < success)
                $(window).trigger('success');
            else if (progress.loss < loss)
                $(window).trigger('loss');

            progress.success = success;
            progress.loss = loss;
        }

        setProgressObject(progress);
        updateScore();
    }

    function clickAnwer(e) {
        let elem = $(e.currentTarget);
        let ok = elem.text() == appData.currentPhrase.native;
        elem.removeClass('btn-outline-secondary').addClass(ok ? 'btn-outline-success' : 'btn-outline-danger');
        stopQuestionQuiz();
        appData.quizAnswered = true;
        elements.deskBlock.find('.quiz-block .title').text(Lang('quiz-title-stop'));
        addScope(ok ? 1 : 0, ok ? 0 : 1);
    }

    function UnawailableQuiz() {
        let quiz_block = elements.deskBlock.find('.quiz-block .content');
        quiz_block.empty();
        elements.deskBlock.css('display', 'none');
        phrasesList.refreshAccordion();
        showAlert(Lang('dont_available_quiz'));
    }

    function refreshIncorrectList() {
        let list = appData.currentPhrase.incorrectList;
        if (list && !appData.quizAnswered) {
            let quiz_block = elements.deskBlock.find('.quiz-block .content');

            if (list.length > 0) {

                elements.deskBlock.css('display', 'block');
                list = [...list];
                list.push({
                    correct: true,
                    incorrect_text: appData.currentPhrase.native
                });
                let tlist = shuffleArrayWithSeed(list, Date.now());

                let buttons = quiz_block.find('.btn');

                tlist.forEach((item, i)=>{
                    let aitem;
                    if (i < buttons.length) {
                        aitem = $(buttons[i]);
                        aitem.removeClass('btn-outline-success btn-outline-danger correct');
                    }
                    else {
                        aitem = $(`<button class="btn btn-sm"></button>`);
                        aitem.click(clickAnwer);
                    }
                    aitem.toggleClass('btn-outline-secondary', true);
                    aitem.toggleClass('correct', item.correct === true);
                    aitem.text(item.incorrect_text);
                    quiz_block.append(aitem);
                });

                stopQuestionQuiz(!isPlaying(), !isPlaying());
            }
            
            phrasesList.refreshAccordion();
        }
    }

    function toggleDeskBlock() {
        if (!isQuiz()) {
            let desc_block = elements.deskBlock.find('.description-block');

            if (elements.deskBlock.find('.dropdown').css('display') != 'none') {
                desc_block.toggleClass('expanded', ...arguments);
                setTimeout(()=>{
                    phrasesList.refreshAccordion();
                    let btn = elements.deskBlock.find('.btn');
                    btn.removeClass('bi-caret-down-fill bi-caret-up-fill');
                    btn.addClass(desc_block.hasClass('expanded') ? 'bi-caret-up-fill' : 'bi-caret-down-fill');
                }, 500);
            }
        }
    }

    function visibleDeskBlock(visible) {
        elements.deskBlock.toggleClass('hide', !visible);
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

    function openSettingsModal() {

        if (stateManager.isPlaying)
            stopPlayback();

        elements.speedValue.text(state.speed.toFixed(1) + 'x');

        elements.mode_direction.val(state.direction);
        
        elements.pauseSlider.val(state.pauseBetweenPhrases);
        elements.pauseValue.text(state.pauseBetweenPhrases + ' ' + Lang("sec"));
        elements.tvScreenToggle.prop('checked', state.showTvScreen);
        elements.recognizeToggle.prop('checked', state.recognize);
        elements.backgroundPlayback.prop('checked', state.backgroundPlayback);
        elements.useSpeakPhrase.prop('checked', state.useSpeakPhrase);
        elements.saveDirection.prop('checked', state.saveDirection);

        elements.repeatLength.val(state.repeatLength);
        elements.repeatCount.val(state.repeatCount);
        elements.genderVoice.val(state.genderVoice);

        $(`[data-order="${state.order}"]`).addClass('active').siblings().removeClass('active');
        
        $('#settingsModal').modal('show');
    }

    function applySettingsFromModal() {

        let direction = elements.mode_direction.val();
        state.indexInMode = Math.min(AppConst.directions[direction].length - 1, state.indexInMode);

        const newSettings = {

            pauseBetweenPhrases: parseFloat(elements.pauseSlider.val()),
            direction: direction,
            order: $('[data-order].active').data('order'),
            showTvScreen: elements.tvScreenToggle.prop('checked'),
            recognize: elements.recognizeToggle.prop('checked'),
            repeatLength: elements.repeatLength.val(),
            repeatCount: elements.repeatCount.val(),
            genderVoice: elements.genderVoice.val(),
            backgroundPlayback: elements.backgroundPlayback.prop('checked'),
            useSpeakPhrase: elements.useSpeakPhrase.prop('checked'),
            indexInMode: state.indexInMode,
            saveDirection: elements.saveDirection.prop('checked')
        };

        if (newSettings.repeatCount < getCurentRepeat())
            setProgress(0, getProgressIndex());
        
        const listChanged = stateManager.hasListChanged(
            state.currentListType, 
            newSettings.order, 
            phrasesData
        );
        
        const changes = stateManager.updateSettings(newSettings);
        Object.assign(state, stateManager.getState());

        if (newSettings.saveDirection)
            setProgressObject({direction: state.direction});
        
        if (changes.listChanged || listChanged) {
            loadPhraseList();
            
            const listKey = stateManager.generateListKey(
                state.currentListType, 
                state.order, 
                phrasesData
            );
            stateManager.setCurrentListData(listKey);
            $(window).trigger('selected_list_type', state.currentListType);
        }
        
        stateManager.saveState();
        updateDisplay();
        refreshDescription();

        if (changes.settingsChanged || changes.listChanged) {
            applyTvScreenState();
        }

        $(window).trigger('apply_settings');
    }

    function setCurrentType(type = null, updateRequire = false) {

        let keys = Object.keys(phrasesData);
        keys.push('all');

        if (!type || !keys.includes(type))
            type = keys[0];

        if ((state.currentListType != type) || updateRequire) {

            state.currentListType = type;

            if (state.saveDirection) {
                let progress = getProgress();
                if (progress && progress.direction)
                    state.direction = progress.direction;
            }

            speechSynthesizer.stop();
            stopRecognition();

            const listKey = stateManager.generateListKey(
                state.currentListType, 
                state.order, 
                phrasesData
            );

            stateManager.updateSettings(state);
            stateManager.setCurrentListData(listKey);
            stateManager.updatePlaybackState({
                currentPhraseIndex: state.currentPhraseIndex,
                indexInMode: state.indexInMode,
                currentListType: state.currentListType,
                order: state.order,
            });
            loadPhraseList(true);

            $(window).trigger('selected_list_type', state.currentListType);

            appData.selectTypeRecently = true;
            setTimeout(()=>{
                appData.selectTypeRecently = false;
            }, 1000);

            refreshDescription();

            if (preferModes) {
                let prefer = preferModes[state.currentListType];
                if (prefer && prefer != state.direction) {
                    Confirm(Lang('prefer_mode_confirm', [Lang(prefer)]))
                        .then((result)=>{
                            if (result)
                                stateManager.set('direction', state.direction = prefer);
                        });

                    if (stateManager.isPlaying)
                        stopPlayback();
                    return;
                }
            }

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

    function refreshDescription() {

        if (isQuiz()) {
            visibleDeskBlock(true);
        } else {
            let item = typeDescriptions.hasOwnProperty(state.currentListType) ? 
                            typeDescriptions[state.currentListType] : false;

            visibleDeskBlock(item);
            if (item)
                elements.deskBlock.find('.description').html(`<h4>${item.name}</h4>${item.description}`);
        }

        phrasesList.refreshAccordion();
    }

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
                audio.loop = true;

                appData.backgroundAudio = audio;
            }

            appData.backgroundAudio.play();
        }
    }

    function stopBackgroundAudio() {

        if (appData.backgroundAudio)
            speechSynthesizer.stopAudio(appData.backgroundAudio);
    }

    function startPlayback() {
        if (appData.currentPhraseList.length === 0) {
            showAlert(Lang("phrase_list_empty"), 'warning');
            return;
        }
        
        stateManager.isPlaying  = true;
        stateManager.isPaused   = false;
        state.indexInMode       = 0;
        appData.missOne         = state.repeatLength > 1;
        
        stateManager.updatePlaybackState({
            indexInMode: state.indexInMode
        });
        
        updateControls();
        //playBackgrounAudio();
        playCurrentPhrase();

        $(window).trigger("playback", 'start');
    }

    function togglePause() {
        if (!stateManager.isPlaying) return;

        speechSynthesizer.stop();
        stateManager.isPaused = !stateManager.isPaused;
        
        if (stateManager.isPaused) {
            clearTimeout(appData.timeoutId);
            $(window).trigger("playback", 'stop');
            stopRecognition();
            refreshDeskBlock();
            //stopBackgroundAudio();

        } else {
            appData.missOne  = state.repeatLength > 1;

            //playBackgrounAudio();
            playCurrentPhrase();
            $(window).trigger("playback", 'start');
        }
        
        updateControls();
    }

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
            
                stateManager.updatePlaybackState({
                    currentPhraseIndex: state.currentPhraseIndex
                });
                
                if (stateManager.isPlaying)
                    playCurrentPhrase();
            });
        }
    }

    function nextPhrase() {
        setCurrentPhraseIndexNextOrPrev((state.currentPhraseIndex + 1) % appData.currentPhraseList.length);
    }

    function prevPhrase() {
        setCurrentPhraseIndexNextOrPrev(state.currentPhraseIndex > 0 ? 
                state.currentPhraseIndex - 1 : 
                appData.currentPhraseList.length - 1);
    }

    function isBothDirectionsMode() {
        return state.direction.includes('both');
    }

    function calcTime(lang) {
        return Math.round(Math.max(state.pauseBetweenPhrases - 1, 0) * 1000 + (state.useSpeakPhrase ? appData.currentPhrase[lang].length * AppConst.charTime[lang] : 0));
    }

    function setNextType() {
        let keys = Object.keys(phrasesData);
        for (let i=0; i<keys.length; i++)
            if (keys[i] == state.currentListType) {
                let nextType = keys[(i + 1) % keys.length];
                state.progress[nextType] = {
                    currentRepeat: 0,
                    index: 0
                };
                setCurrentType(nextType);
                return;
            }
    }

    function incCurrentPhraseIndex() {

        newIndex = state.currentPhraseIndex + 1;

        if (newIndex >= appData.currentPhraseList.length) {
            newIndex = 0;
            /*
            setNextType();
            return;
            */
        }

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
        $(window).trigger('next_phrase', newIndex);
    }

    function statParams() {
        return {
            phrase_id: appData.currentPhrase.id,
            direction: state.direction,
            type: state.currentListType,
            pause: state.pauseBetweenPhrases
        }
    }

    function setCurrentPhraseIndex(index) {
        let newIndex = Math.max(0, Math.min(index, appData.currentPhraseList.length - 1));

        if (state.currentPhraseIndex != newIndex) {
            appData.quizAnswered    = false;
        }

        state.currentPhraseIndex    = newIndex;
        state.indexInMode           = 0;
        appData.currentPhrase       = appData.currentPhraseList[state.currentPhraseIndex];
        state.currentPhraseId       = appData.currentPhrase.id;

        stateManager.updatePlaybackState({
            currentPhraseIndex: state.currentPhraseIndex,
            currentPhraseId: state.currentPhraseId
        });

        setProgress(getCurentRepeat(), newIndex);
        refreshProgressBar();
        updateDisplay();

        speechSynthesizer.stop();

        $(window).trigger('set_current_phrase', appData.currentPhrase);

        if (isPlaying())
            stat.push('cur_phrase', statParams());
    }

    function _speak(showLang, speakLang, then, genderVoice = null) {
        clearTimeout(appData.timeoutId);

        showPhrase(showLang);

        let startTime = Date.now();

        let lang = isStr(speakLang) ? speakLang : speakLang.direct;
        tracer.log(`${state.currentListType}: ${state.currentPhraseIndex} start ${appData.currentPhrase[lang]}`);

        if (isNumeric(genderVoice)) {
            let cidx = VOICES.indexOf(state.genderVoice);
            genderVoice = VOICES[(cidx + genderVoice) % VOICES.length];
        }

        speechSynthesizer.speak(appData.currentPhrase, speakLang, 
                    appData.currentPhrase.type, state.speed, genderVoice ? genderVoice : state.genderVoice)
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

    function playCurrentPhrase() {
        if (!stateManager.isPlaying || stateManager.isPaused) return;
        
        if (state.currentPhraseIndex >= appData.currentPhraseList.length) {
            setCurrentPhraseIndex(0);
        }
        
        appData.currentPhrase = appData.currentPhraseList[state.currentPhraseIndex];
        updateDisplay();

        let directionMode = AppConst.directions[state.direction];

        let modeSetting = directionMode[state.indexInMode];
        _speak(modeSetting.show, modeSetting.speak, ()=>{

            let isRecognizeStart = false;
            if (!(isQuiz() && appData.quizAnswered))
                isRecognizeStart = startCurrentRecognition(modeSetting.listen);
                
            speakPause(() => {
                if (isRecognizeStart)
                    summingUpRecognition();

                if (state.indexInMode < directionMode.length - 1) {
                    state.indexInMode++;
                    if (modeSetting.nextPhrase) {
                        let lastInMode = state.indexInMode;
                        incCurrentPhraseIndex();
                        state.indexInMode = lastInMode;
                    }
                }
                else incCurrentPhraseIndex();
                playCurrentPhrase();
            }, modeSetting.speak);
        }, modeSetting.genderVoice);
    }

    function summingUpRecognition() {
        if (recognition && stateManager.state.recognize) 
            recognition.SummingUp();
    }

    function startCurrentRecognition(phraseDirect) {

        if (phraseDirect && recognition && stateManager.state.recognize) {
            let direct = isStr(phraseDirect) ? phraseDirect : phraseDirect.direct;
            recognition.startRecognition(appData.currentPhrase, direct);

            stat.startTimer('recognize');
            return true;
        }
        return false;
    }

    function speakPause(callback, phraseDirect) {
        clearTimeout(appData.timeoutId);
        let delay = calcTime(isStr(phraseDirect) ? phraseDirect : phraseDirect.direct);

        if (isNumeric(delay) && (delay > 0))
            appData.timeoutId = setTimeout(callback, delay);
        else callback();
    }

    function updateSizeText(elem, k = 1, maxSize = 36, minSize = 18) {
        let text = elem.text();
        let width = elem.closest('.phrase-container').innerWidth();
        let wk = 3.5;
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

    function showPhrase(langObj) {
        let updated = false;
        
        let hastObj = typeof langObj == 'object';
        let lang = hastObj ? langObj.text : langObj;

        if (lang === 'target') {
            updated = updatePhrases(appData.currentPhrase.target, appData.currentPhrase.native);

            elements.phraseText.addClass('text-target');
            elements.phraseHint.removeClass('text-target').addClass('text-muted');
        } else {
            updated = updatePhrases(appData.currentPhrase.native, appData.currentPhrase.target);

            elements.phraseText.removeClass('text-target');
            elements.phraseHint.addClass('text-target');
        }

        let showText = true;
        let showHint = true;

        if (hastObj) {
            showText = typeof langObj.text != 'undefined';
            showHint = typeof langObj.hint != 'undefined';
        }

        let hasBlur = hastObj && (typeof langObj.blur != 'undefined');
        elements.phraseText.toggleClass('blur', hasBlur && langObj.blur.includes('text'));
        elements.phraseHint.toggleClass('blur', hasBlur && langObj.blur.includes('hint'));

        elements.phraseText.css('display', showText ? 'block' : 'none');
        elements.phraseHint.css('display', showHint ? 'block' : 'none');
        
        if (updated) {
            
            updateSizePlayerTexts();
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

    function updateDisplay() {
        if (appData.currentPhraseList.length === 0) {
            updatePhrases(Lang("phrase_list_empty"), Lang("select_list_below"));
            elements.phraseCounter.text('0 / 0');
            elements.phraseType.text(Lang("not_selected"));
            return;
        }
        
        if (appData.currentPhrase) {

            let showLang = AppConst.directions[state.direction][state.indexInMode].show;
            showPhrase(showLang);
            
            let currentRepeat = getCurentRepeat();
            elements.phraseCounter.text(`${state.currentPhraseIndex + 1} / ${appData.currentPhraseList.length}`);
            elements.phraseType.text(appData.currentPhrase.FormatType());
            elements.currentRepeat.html((state.repeatCount > 0) && (currentRepeat > 0) ? 
                ('<i class="bi bi-repeat"></i> ' + strEnum(currentRepeat, Lang("time_format"), 'ru')) : '');
        }

        refreshProgressBar();
        refreshDeskBlock();
    }

    function updateControls() {
        let isPlay = isPlaying();

        if (isPlay) enableWakeLock();
        else disableWakeLock();

        if (playerControls)
            playerControls.updatePlayButton(isPlay);

        if (!isPlay)
            elements.progressBar.removeClass('progress-bar-animated');
        else if (!elements.progressBar.hasClass('progress-bar-animated'))
            elements.progressBar.addClass('progress-bar-animated');
    }
};

$(document).ready(function() {
    let isModalOpen = false;
    let backButtonPressed = false;

    $(document).on('show.bs.modal', function() {
        isModalOpen = true;
        history.pushState({ modalOpen: true }, '');
    });

    $(document).on('hidden.bs.modal', function() {
        isModalOpen = false;
        if (history.state && history.state.modalOpen) {
            history.back();
        }
    });

    window.addEventListener('popstate', function(e) {
        if (isModalOpen) {
            $('.modal.show').modal('hide');
            history.pushState(null, '', window.location.href);
            e.preventDefault();
        }
    });

    $(document).on('click', '[data-bs-toggle="modal"]', function() {
        isModalOpen = true;
        history.pushState({ modalOpen: true }, '');
    });

    Application();
});