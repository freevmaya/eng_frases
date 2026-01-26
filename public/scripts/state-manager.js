// Класс для управления состоянием приложения и localStorage
class StateManager {
    constructor() {
        this.isPlaying;
        this.isPaused;

        this.STORAGE_KEY = 'english_trainer_state';
        this.DEFAULT_STATE = {
            // Настройки воспроизведения
            speed: 1.0,
            pauseBetweenPhrases: 2,
            pauseBetweenLanguages: 2,
            
            // Направление и порядок
            direction: 'native-target-both',
            order: 'sequential',
            currentListType: 'Present simple',
            
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
            currentRepeat: 0,

            genderVoice: 'male'
        };
        
        this.state = { ...this.DEFAULT_STATE };
    }
    
    // Загрузка состояния из localStorage
    loadState() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.state = { ...this.DEFAULT_STATE, ...parsed };
                return true;
            }
        } catch (error) {
            console.error('Ошибка загрузки состояния:', error);
        }
        return false;
    }
    
    // Сохранение состояния в localStorage
    saveState() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
            return true;
        } catch (error) {
            console.error('Ошибка сохранения состояния:', error);
            return false;
        }
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