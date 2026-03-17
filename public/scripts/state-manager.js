class StateManager {
    constructor(config) {
        this.isPlaying;
        this.isPaused;
        this.lastHash = '';
        this.config = $.extend({
            use_server: true
        }, config);

        this.STORAGE_KEY = 'english_trainer_state';
        this.DEFAULT_STATE = {
            speed: 1.0,
            pauseBetweenPhrases: 3,
            
            direction: 'target2-native-target-both',
            order: 'sequential',
            currentListType: 'Present simple',
            progress: {},
            
            currentPhraseIndex: 0,
            indexInMode: 0,
            
            currentListKey: null,
            randomSeed: null,
            showTvScreen: true,
            recognize: false,

            repeatLength: 5,
            repeatCount: 0,

            genderVoice: 'male',

            backgroundPlayback: true,
            useSpeakPhrase: true,
            paid_use: {},
            shared: []
        };
        
        this.state = { ...this.DEFAULT_STATE };

        if (typeof new_user != 'undefined')
            localStorage.removeItem(this.STORAGE_KEY);

        this.try_saveStateToServer = debounce(()=>{
            this.saveStateServer();
        }, 1000, ()=>{
            this.lastHash = this.getHash();
        });

        window.addEventListener('beforeunload', (e)=>{
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

    getPaidUse(service, defValue = null) {
        let all = this.get('paid_use', {});

        if (typeof all[service] == 'undefined')
            return defValue;
        return all[service];
    }

    setPaidUse(service, value) {
        this.state.paid_use = {...this.state.paid_use, ...{[service]: value}};
        this.saveState();
    }

    get(name, defValue = null) {
        if (typeof this.state[name] == 'undefined')
            return defValue;
        return this.state[name];
    }

    set(name, value) {
        this.state[name] = value;
        this.saveState();
    }

    getHash() {
        return CryptoJS.MD5(JSON.stringify(this.state)).toString();
    }

    isChanges() {
        return this.lastHash != this.getHash();
    }

    saveImmediately() {
        if (this.isChanges()) {
            if (this.config.use_server)
                this.saveStateServer();
            else this.saveState();
        }
    }
    
    saveState() {
        if (this.isChanges()) {
            if (this.config.use_server)
                this.try_saveStateToServer();
            else this.saveStateLocale();
        }
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
                        this.config.use_server = false;
                        this.saveStateLocale();
                    }
                })
                .catch((e)=>{
                    this.config.use_server = false;
                    this.saveStateLocale();
                });
            } else this.saveStateLocale();
            this.lastHash = this.getHash();
        }
    }

    saveStateLocale() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
        this.lastHash = this.getHash();
    }
    
    loadState() {
        return new Promise((resolve, reject)=>{

            let returnDefault = ()=>{

                let saved = localStorage.getItem(this.STORAGE_KEY);
                if (saved)
                    saved = JSON.parse(saved);

                this.state = { ...this.DEFAULT_STATE, ...saved };

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
                            this.config.use_server = true;
                            this.state = { ...this.DEFAULT_STATE, ...data.state };

                            resolve(this.state);
                        }
                        else {
                            this.config.use_server = data == 0;
                            returnDefault();
                        }
                    }).catch((error)=>{
                        tracer.error(error);
                        returnDefault();                    
                    });
                } catch (error) {
                    console.error(Lang("error_loading_state"), error);
                    reject(error);
                }
            } else returnDefault();
        });
    }
    
    updateSettings(settings) {
        const oldListType = this.state.currentListType;
        
        Object.assign(this.state, settings);
        
        return {
            listChanged: oldListType !== this.state.currentListType,
            settingsChanged: true
        };
    }
    
    hasListChanged(newListType, newOrder, phrasesData) {
        const oldKey = this.state.currentListKey;
        const newKey = this.generateListKey(newListType, newOrder, phrasesData);
        return oldKey !== newKey;
    }
    
    updatePlaybackState(state) {
        const playbackKeys = ['currentPhraseIndex', 'currentPhraseId', 'indexInMode', 'progress', 'paid_use'];
        playbackKeys.forEach(key => {
            if (state[key] !== undefined) {
                this.state[key] = state[key];
            }
        });
        this.saveState();
    }
    
    resetPlayback() {
        this.state.currentPhraseIndex = 0;
        this.state.indexInMode = 0;
        this.saveState();
    }
    
    getState() {
        return { ...this.state };
    }
    
    setCurrentListData(listKey, randomSeed = null) {
        this.state.currentListKey = listKey;
        this.state.randomSeed = randomSeed;
        this.saveState();
    }
    
    generateListKey(listType, order, phrasesData) {
        if (listType === 'all') {
            let totalPhrases = 0;
            Object.keys(phrasesData).forEach(key => {
                totalPhrases += phrasesData[key].length;
            });
            return `all_${order}_${totalPhrases}`;
        } else {
            const count = phrasesData[listType] ? phrasesData[listType].length : 0;
            return `${listType}_${order}_${count}`;
        }
    }
    
    resetToDefault() {
        this.state = { ...this.DEFAULT_STATE };
        localStorage.removeItem(this.STORAGE_KEY);
    }
}