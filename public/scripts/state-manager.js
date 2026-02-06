// Класс для управления состоянием приложения и localStorage
class StateManager {
    constructor(config) {
        this.isPlaying;
        this.isPaused;
        this.isServer = false;
        this.config = $.extend({
            use_server: true
        }, config);

        this.STORAGE_KEY = 'english_trainer_state';
        this.DEFAULT_STATE = {
            // Настройки воспроизведения
            speed: 1.0,
            pauseBetweenPhrases: 2,
            
            // Направление и порядок
            direction: 'native-target-both',
            order: 'sequential',
            currentListType: 'Present simple',
            progress: {},
            
            // Состояние воспроизведения
            currentPhraseIndex: 0,
            showingFirstLang: true,
            
            // Данные текущего списка
            currentListKey: null, // Ключ для отслеживания изменений списка
            randomSeed: null, // Для воссоздания случайного порядка
            showTvScreen: true,
            recognize: false,

            repeatLength: 5,
            repeatCount: 0,

            genderVoice: 'male',

            backgroundPlayback: true,
            useSpeakPhrase: true
        };
        
        this.state = { ...this.DEFAULT_STATE };

        this.try_saveStateToServer = debounce(()=>{
            this.saveStateServer();
        }, 1000);

        //['beforeunload', 'unload', 'pagehide', 'visibilitychange', 'blur', 'popstate'];

        window.addEventListener('beforeunload', (e)=>{
            this.saveImmediately();
        });

        window.addEventListener('unload', (e)=>{
            this.saveImmediately();
        });

        window.addEventListener('pagehide', (e)=>{
            this.saveImmediately();
        });

        window.addEventListener('freeze', (e)=>{
            this.saveImmediately();
        });

        window.addEventListener('visibilitychange', (e)=>{
            if (document.visibilityState != 'visible')
                this.saveImmediately();
        });

        window.addEventListener('blur', (e)=>{
            this.saveImmediately();
        });
    }

    saveImmediately() {
        if (this.isServer)
            this.saveStateServer();
        else this.saveState();
    }

    saveStateServer() {
        if (this.state) {
            if (this.config.use_server) {
                Ajax({
                    action: 'setUserState',
                    data: this.state
                })
                .then((response)=>{
                    if (!response) {
                        this.isServer = false;
                        this.saveStateLocale();
                    }
                })
                .catch((e)=>{
                    this.isServer = false;
                    this.saveStateLocale();
                });
            } else this.saveStateLocale();
        }
    }

    saveStateLocale() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
    }
    
    // Загрузка состояния из localStorage
    loadState() {
        return new Promise((resolve, reject)=>{

            let returnDefault = ()=>{

                let saved = localStorage.getItem(this.STORAGE_KEY);
                if (saved)
                    saved = JSON.parse(saved);

                this.state = { ...this.DEFAULT_STATE, ...saved };

                //Удаляем со старой версией
                if (this.state.currentPhraseList)
                    delete(this.state.currentPhraseList);

                resolve(this.state);
            }

            if (this.config.use_server) {
                try {
                    Ajax({
                        action: 'getUserState'
                    }).then((data)=>{
                        if (data && data.hasOwnProperty('state')) {
                            this.isServer = true;
                            this.state = { ...this.DEFAULT_STATE, ...data.state };
                            resolve(this.state);
                        }
                        else {
                            this.isServer = data == 0;
                            returnDefault();
                        }
                    }).catch(()=>{
                        returnDefault();                    
                    });
                } catch (error) {
                    console.error('Ошибка загрузки состояния:', error);
                    reject(error);
                }
            } else returnDefault();
        });
    }
    
    // Сохранение состояния в localStorage
    saveState() {
        if (this.isServer)
            this.try_saveStateToServer();
        else this.saveStateLocale();
    }
    
    // Обновление настроек
    updateSettings(settings) {
        const oldListType = this.state.currentListType;
        
        // Обновляем состояние
        Object.assign(this.state, settings);
        
        // Возвращаем информацию об изменениях
        return {
            listChanged: oldListType !== this.state.currentListType,
            settingsChanged: true
        };
    }
    
    // Проверка, изменился ли список фраз
    hasListChanged(newListType, newOrder, phrasesData) {
        const oldKey = this.state.currentListKey;
        const newKey = this.generateListKey(newListType, newOrder, phrasesData);
        return oldKey !== newKey;
    }
    
    // Обновление состояния воспроизведения
    updatePlaybackState(state) {
        const playbackKeys = ['currentPhraseIndex', 'showingFirstLang'];
        playbackKeys.forEach(key => {
            if (state[key] !== undefined) {
                this.state[key] = state[key];
            }
        });
        this.saveState();
    }
    
    // Сброс состояния воспроизведения
    resetPlayback() {
        this.state.currentPhraseIndex = 0;
        this.state.showingFirstLang = true;
        this.saveState();
    }
    
    // Получение текущего состояния
    getState() {
        return { ...this.state };
    }
    
    // Установка данных текущего списка
    setCurrentListData(listKey, randomSeed = null) {
        this.state.currentListKey = listKey;
        this.state.randomSeed = randomSeed;
        this.saveState();
    }
    
    // Генерация ключа для списка
    generateListKey(listType, order, phrasesData) {
        if (listType === 'all') {
            // Для "всех фраз" учитываем количество фраз в каждом списке
            let totalPhrases = 0;
            Object.keys(phrasesData).forEach(key => {
                totalPhrases += phrasesData[key].length;
            });
            return `all_${order}_${totalPhrases}`;
        } else {
            // Для конкретного списка учитываем его имя и количество фраз
            const count = phrasesData[listType] ? phrasesData[listType].length : 0;
            return `${listType}_${order}_${count}`;
        }
    }
    
    // Сброс к состоянию по умолчанию
    resetToDefault() {
        this.state = { ...this.DEFAULT_STATE };
        localStorage.removeItem(this.STORAGE_KEY);
    }
}