// Класс для управления синтезом речи и воспроизведением MP3 файлов
class SpeechSynthesizer {
    constructor(config = {}) {
        this.state = {
            hasSpeechSynthesis: 'speechSynthesis' in window,
            speechError: false,
            isSpeaking: false,
            isPlayingAudio: false,
            voices: [],
            voicesLoaded: false,
            useFallbackSound: false
        };
        
        // Конфигурация
        this.config = {
            audioBaseUrl: config.audioBaseUrl || './audio_files/',
            useCachedAudio: config.useCachedAudio !== false,
            fallbackToSpeech: config.fallbackToSpeech !== false,
            checkAudioBeforePlay: config.checkAudioBeforePlay !== false,
            audioTimeout: config.audioTimeout || 10000, // 10 секунд
            ...config
        };
        
        this.currentUtterance = null;
        this.currentAudio = null;
        this.audioQueue = [];
        this.audioCache = new Map(); // Кэш проверенных файлов
        
        this.init();
    }

    // Инициализация синтезатора речи
    init() {
        if (this.state.hasSpeechSynthesis) {
            this.loadVoices();
        } else {
            console.warn('Speech synthesis not available');
            this.state.speechError = true;
        }
        
        // Предзагрузка аудио элементов
        this.preloadedAudios = new Map();
    }

    // Загрузка доступных голосов
    loadVoices() {
        if (!this.state.hasSpeechSynthesis) return;

        // Пытаемся получить голоса сразу
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
            this.state.voices = voices;
            this.state.voicesLoaded = true;
        }

        // Устанавливаем обработчик для загрузки голосов
        speechSynthesis.onvoiceschanged = () => {
            const updatedVoices = speechSynthesis.getVoices();
            if (updatedVoices.length > 0) {
                this.state.voices = updatedVoices;
                this.state.voicesLoaded = true;
            }
        };
    }

    // Вычисление MD5 хэша строки
    md5(text) {
        if (!text) return '';
        
        // Используем CryptoJS для надежного MD5
        const hash = CryptoJS.MD5(text).toString();
        
        // Проверяем, что хэш имеет 32 символа
        if (hash.length !== 32) {
            console.warn(`MD5 hash length is ${hash.length}, expected 32. Padding...`);
            return hash.padStart(32, '0');
        }
        
        return hash;
    }

    // Формирование URL к аудиофайлу
    async getAudioUrl(phrase, phraseType = 'target', category = null) {
        if (!phrase || !phrase.trim()) {
            throw new Error('Phrase cannot be empty');
        }
        
        const cleanPhrase = phrase.trim();
        
        // Определяем префикс языка
        const langPrefix = phraseType === 'target' ? 'en' : 'ru';
        
        // Вычисляем MD5 хэш (гарантированно 32 символа)
        const hash = await this.md5(cleanPhrase);
        
        // Проверяем длину хэша
        if (hash.length !== 32) {
            console.error(`Invalid MD5 hash length: ${hash.length}, expected 32`);
            // Используем fallback хэш
            const fallbackHash = this._simpleHash32(cleanPhrase);
            console.log(`Using fallback hash: ${fallbackHash}`);
        }
        
        // Формируем имя файла
        const fileName = `${langPrefix}_${hash}.mp3`;
        
        // Формируем URL
        const baseUrl = this.config.audioBaseUrl.replace(/\/$/, '');
        let fullUrl;
        
        if (category && category.trim()) {
            fullUrl = `${baseUrl}/${category.trim()}/${fileName}`;
        } else {
            fullUrl = `${baseUrl}/${fileName}`;
        }
        
        console.log(`Generated audio URL for "${cleanPhrase.substring(0, 30)}...": ${fileName}`);
        
        return {
            fileName,
            url: fullUrl,
            langPrefix,
            hash,
            phrase: cleanPhrase,
            phraseType,
            category
        };
    }

    // Проверка существования аудиофайла по URL
    async checkAudioUrlExists(url) {
        const cacheKey = `check_${url}`;
        
        // Проверяем кэш
        if (this.audioCache.has(cacheKey)) {
            return this.audioCache.get(cacheKey);
        }
        
        try {
            // Используем fetch с HEAD для проверки без загрузки всего файла
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch(url, {
                method: 'HEAD',
                signal: controller.signal,
                headers: {
                    'Accept': 'audio/mpeg,audio/*'
                }
            });
            
            clearTimeout(timeoutId);
            
            const exists = response.ok && response.headers.get('content-type')?.includes('audio/');
            
            // Кэшируем результат на 5 минут
            this.audioCache.set(cacheKey, exists);
            if (exists) {
                // Также кэшируем URL как доступный
                this.audioCache.set(url, true);
            }
            
            return exists;
            
        } catch (error) {
            // Кэшируем отрицательный результат на 1 минуту
            this.audioCache.set(cacheKey, false);
            return false;
        }
    }

    // Поиск аудиофайла в разных категориях
    async findAudioUrl(phrase, phraseType = 'target', categories = null) {
        const cleanPhrase = phrase.trim();
        
        // Если категории не указаны, пробуем без категории
        if (!categories) {
            const urlInfo = await this.getAudioUrl(cleanPhrase, phraseType);
            const exists = await this.checkAudioUrlExists(urlInfo.url);
            
            if (exists) {
                return urlInfo;
            }
        }
        
        // Если указаны категории или не нашли в корне
        const categoriesToCheck = categories || [
            'common', 'phrases', 'sentences',
            'Past simple', 'Present continuous', 'Future tense',
            'Verbs', 'Nouns', 'Adjectives'
        ];
        
        for (const category of categoriesToCheck) {
            const urlInfo = await this.getAudioUrl(cleanPhrase, phraseType, category);
            const exists = await this.checkAudioUrlExists(urlInfo.url);
            
            if (exists) {
                console.log(`Found audio in category: ${category}`);
                return urlInfo;
            }
        }
        
        return null;
    }

    // Воспроизведение MP3 файла по URL
    async playAudioFromUrl(urlInfo, phrase) {
        if (this.state.isPlayingAudio || this.state.isSpeaking) {
            console.log('Already playing audio or speaking');
            return false;
        }

        try {
            this.state.isPlayingAudio = true;
            
            // Проверяем предзагруженное аудио
            let audio;
            if (this.preloadedAudios.has(urlInfo.url)) {
                audio = this.preloadedAudios.get(urlInfo.url);
                audio.currentTime = 0; // Перематываем в начало
            } else {
                // Создаем новый аудио элемент
                audio = new Audio();
                audio.src = urlInfo.url;
                audio.preload = 'auto';
                
                // Кэшируем для будущего использования
                this.preloadedAudios.set(urlInfo.url, audio);
            }
            
            this.currentAudio = audio;
            
            // Настройка аудио
            audio.volume = 1.0;
            audio.playbackRate = 1.0;
            
            return new Promise((resolve, reject) => {
                let timeoutId;
                
                const onLoaded = () => {
                    console.log(`Audio loaded: ${urlInfo.fileName}`);
                };
                
                const onEnded = () => {
                    cleanup();
                    this._afterFinishPlay();
                    resolve({
                        success: true,
                        type: 'audio',
                        urlInfo: urlInfo,
                        duration: audio.duration
                    });
                };
                
                const onError = (error) => {
                    cleanup();
                    this._afterFinishPlay();
                    console.error('Audio playback error:', error, urlInfo.url);
                    reject(new Error(`Audio playback failed: ${urlInfo.fileName}`));
                };
                
                const onTimeout = () => {
                    cleanup();
                    this._afterFinishPlay();
                    reject(new Error(`Audio playback timeout: ${urlInfo.fileName}`));
                };
                
                const cleanup = () => {
                    clearTimeout(timeoutId);
                    audio.removeEventListener('loadeddata', onLoaded);
                    audio.removeEventListener('ended', onEnded);
                    audio.removeEventListener('error', onError);
                };
                
                // Устанавливаем таймаут
                timeoutId = setTimeout(onTimeout, this.config.audioTimeout);
                
                // Добавляем обработчики
                audio.addEventListener('loadeddata', onLoaded);
                audio.addEventListener('ended', onEnded);
                audio.addEventListener('error', onError);
                
                // Запуск воспроизведения
                const playPromise = audio.play();
                
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        cleanup();
                        this._afterFinishPlay();
                        reject(error);
                    });
                }
            });
            
        } catch (error) {
            console.error('Error playing audio:', error);
            this.state.isPlayingAudio = false;
            this.currentAudio = null;
            throw error;
        }
    }

    _afterFinishPlay() {
        setTimeout(() => {
            this.state.isPlayingAudio = false;
            this.currentAudio = null;
        }, 100);
    }

    _afterFinishSpeak() {
        setTimeout(() => {
            this.state.isSpeaking = false;
            this.currentUtterance = null;
        }, 100);
    }

    // Основной метод воспроизведения фразы
    async speak(phrase, phraseType = 'target', category = null, speed = 1.0) {
        if (!phrase || !phrase.trim()) {
            return {
                success: false,
                error: 'Empty phrase'
            };
        }

        // Проверяем, не говорим ли мы уже
        if (this.state.isSpeaking || this.state.isPlayingAudio) {
            return {
                success: false,
                error: 'Already speaking or playing'
            };
        }

        const cleanText = phrase.replace(/\([^()]*\)|\[[^\][]*\]/g, '').trim();
        
        // Пытаемся использовать сохраненный аудиофайл
        if (this.config.useCachedAudio) {
            try {
                let urlInfo;
                
                // Если указана категория, сначала проверяем её
                if (category) {
                    urlInfo = await this.getAudioUrl(cleanText, phraseType, category);
                    
                    if (this.config.checkAudioBeforePlay) {
                        const exists = await this.checkAudioUrlExists(urlInfo.url);
                        if (!exists) {
                            console.log(`Audio not found in category ${category}, searching...`);
                            urlInfo = null;
                        }
                    }
                }
                
                // Если не нашли по категории или не проверяли, ищем везде
                if (!urlInfo) {
                    urlInfo = await this.findAudioUrl(cleanText, phraseType, category ? [category] : null);
                }
                
                // Если нашли файл, воспроизводим его
                if (urlInfo) {
                    console.log(`Playing cached audio: ${urlInfo.fileName}`);
                    
                    try {
                        const result = await this.playAudioFromUrl(urlInfo, cleanText);
                        return {
                            success: true,
                            type: 'audio',
                            urlInfo: urlInfo,
                            phrase: cleanText,
                            phraseType: phraseType
                        };
                    } catch (playError) {
                        console.error('Failed to play audio:', playError);
                        // Продолжаем к fallback
                    }
                }
                
                // Если не нашли аудиофайл и разрешен fallback, используем синтез речи
                if (this.config.fallbackToSpeech && this.state.hasSpeechSynthesis) {
                    console.log('Audio file not found, falling back to speech synthesis');
                    const synthesisResult = this._speakWithSynthesis(cleanText, phraseType, speed);
                    
                    if (synthesisResult) {
                        return {
                            success: true,
                            type: 'synthesis',
                            fallback: true,
                            phrase: cleanText,
                            phraseType: phraseType
                        };
                    }
                }
                
                return {
                    success: false,
                    type: 'none',
                    error: 'No audio file found and speech synthesis fallback failed',
                    phrase: cleanText
                };
                
            } catch (error) {
                console.error('Error in speak method:', error);
                
                // При ошибке пробуем синтез речи
                if (this.config.fallbackToSpeech && this.state.hasSpeechSynthesis) {
                    const synthesisResult = this._speakWithSynthesis(cleanText, phraseType, speed);
                    
                    if (synthesisResult) {
                        return {
                            success: true,
                            type: 'synthesis',
                            fallback: true,
                            error: error.message,
                            phrase: cleanText
                        };
                    }
                }
                
                return {
                    success: false,
                    type: 'none',
                    error: error.message,
                    phrase: cleanText
                };
            }
            
        } else {
            // Используем только синтез речи
            const synthesisResult = this._speakWithSynthesis(cleanText, phraseType, speed);
            return {
                success: synthesisResult,
                type: 'synthesis',
                phrase: cleanText
            };
        }
    }

    // Внутренний метод для синтеза речи
    _speakWithSynthesis(text, phraseType = 'target', speed = 1.0) {
        if (!this.state.hasSpeechSynthesis) return false;
        
        try {
            this.state.isSpeaking = true;
            
            const utterance = new SpeechSynthesisUtterance(text);
            this.currentUtterance = utterance;
            
            // Устанавливаем язык
            utterance.lang = phraseType === 'target' ? 'en-US' : 'ru-RU';
            utterance.rate = speed;
            utterance.volume = 1;
            
            // Ищем подходящий голос
            if (this.state.voicesLoaded && this.state.voices.length > 0) {
                const langPrefix = phraseType === 'target' ? 'en' : 'ru';
                const voice = this.state.voices.find(v => v.lang.startsWith(langPrefix));
                if (voice) utterance.voice = voice;
            }
            
            // События для отслеживания состояния
            utterance.onend = () => {
                this._afterFinishSpeak();
            };
            
            utterance.onerror = (event) => {
                console.error('Speech synthesis error:', event);
                this._afterFinishSpeak();
            };
            
            speechSynthesis.speak(utterance);
            return true;
            
        } catch (error) {
            console.error('Speech synthesis failed:', error);
            this.state.isSpeaking = false;
            this.currentUtterance = null;
            return false;
        }
    }

    // Воспроизведение пары фраз (target и native)
    async speakPhrasePair(phrasePair, category = null, speed = 1.0, delayBetween = 500) {
        const results = {};
        
        // Воспроизведение английской версии (target)
        if (phrasePair.target && phrasePair.target.trim()) {
            results.target = await this.speak(
                phrasePair.target, 
                'target', 
                category, 
                speed
            );
            
            // Пауза между фразами
            if (results.target.success && phrasePair.native) {
                await this.waitForCompletion();
                await new Promise(resolve => setTimeout(resolve, delayBetween));
            }
        }
        
        // Воспроизведение русской версии (native)
        if (phrasePair.native && phrasePair.native.trim()) {
            results.native = await this.speak(
                phrasePair.native, 
                'native', 
                category, 
                speed
            );
        }
        
        return results;
    }

    // Ожидание завершения текущего воспроизведения
    async waitForCompletion(timeout = 30000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            const checkInterval = setInterval(() => {
                if (!this.state.isSpeaking && !this.state.isPlayingAudio) {
                    clearInterval(checkInterval);
                    resolve(true);
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    this.stop();
                    resolve(false);
                }
            }, 100);
        });
    }

    // Предзагрузка аудиофайлов для списка фраз
    async preloadAudios(phrases, phraseType = 'target', category = null) {
        const loadPromises = [];
        
        for (const phrase of phrases) {
            if (!phrase || !phrase.trim()) continue;
            
            const cleanText = phrase.replace(/\([^()]*\)|\[[^\][]*\]/g, '').trim();
            
            // Получаем URL для фразы
            const urlInfo = await this.getAudioUrl(cleanText, phraseType, category);
            
            // Проверяем, не загружено ли уже
            if (this.preloadedAudios.has(urlInfo.url)) continue;
            
            // Создаем промис для загрузки
            const loadPromise = new Promise((resolve) => {
                const audio = new Audio();
                audio.src = urlInfo.url;
                audio.preload = 'auto';
                
                audio.addEventListener('loadeddata', () => {
                    this.preloadedAudios.set(urlInfo.url, audio);
                    console.log(`Preloaded: ${urlInfo.fileName}`);
                    resolve();
                });
                
                audio.addEventListener('error', () => {
                    console.warn(`Failed to preload: ${urlInfo.fileName}`);
                    resolve();
                });
                
                // Запускаем загрузку
                audio.load();
            });
            
            loadPromises.push(loadPromise);
            
            // Ограничиваем параллельные загрузки
            if (loadPromises.length >= 5) {
                await Promise.all(loadPromises);
                loadPromises.length = 0;
            }
        }
        
        // Ждем оставшиеся загрузки
        if (loadPromises.length > 0) {
            await Promise.all(loadPromises);
        }
        
        console.log(`Preloaded ${this.preloadedAudios.size} audio files`);
    }

    // Очистка кэша предзагруженных аудио
    clearAudioCache() {
        this.preloadedAudios.forEach(audio => {
            audio.pause();
            audio.src = '';
        });
        this.preloadedAudios.clear();
        this.audioCache.clear();
        console.log('Audio cache cleared');
    }

    // Остановка текущего воспроизведения
    stop() {
        // Останавливаем воспроизведение аудио
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.state.isPlayingAudio = false;
            this.currentAudio = null;
        }
        
        // Останавливаем синтез речи
        if (this.state.hasSpeechSynthesis) {
            speechSynthesis.cancel();
            this.state.isSpeaking = false;
            this.currentUtterance = null;
        }
    }

    // Проверка доступности аудиофайла для фразы
    async checkAudioAvailability(phrase, phraseType = 'target', category = null) {
        try {
            const cleanText = phrase.replace(/\([^()]*\)|\[[^\][]*\]/g, '').trim();
            const urlInfo = await this.findAudioUrl(cleanText, phraseType, category ? [category] : null);
            
            return {
                available: !!urlInfo,
                urlInfo: urlInfo
            };
        } catch (error) {
            return {
                available: false,
                error: error.message
            };
        }
    }

    // Получение статуса синтезатора
    getStatus() {
        return {
            available: this.isAvailable(),
            speaking: this.state.isSpeaking,
            playingAudio: this.state.isPlayingAudio,
            voicesLoaded: this.state.voicesLoaded,
            voicesCount: this.state.voices.length,
            preloadedAudiosCount: this.preloadedAudios.size,
            config: {
                audioBaseUrl: this.config.audioBaseUrl,
                useCachedAudio: this.config.useCachedAudio,
                fallbackToSpeech: this.config.fallbackToSpeech
            }
        };
    }
}

// Дополнительный класс для работы с JSON файлами фраз
class PhraseManager {
    constructor(jsonFilePath) {
        this.jsonFilePath = jsonFilePath;
        this.phrasesData = null;
    }

    // Загрузка JSON файла с фразами
    async loadPhrases() {
        try {
            const response = await fetch(this.jsonFilePath);
            if (!response.ok) {
                throw new Error(`Failed to load JSON: ${response.status}`);
            }
            
            this.phrasesData = await response.json();
            return this.phrasesData;
            
        } catch (error) {
            console.error('Error loading phrases:', error);
            throw error;
        }
    }

    // Получение всех фраз из категории
    getPhrasesByCategory(category) {
        if (!this.phrasesData) return null;
        return this.phrasesData[category] || null;
    }

    // Получение всех категорий
    getCategories() {
        if (!this.phrasesData) return [];
        return Object.keys(this.phrasesData);
    }

    // Получение пары фраз по индексу в категории
    getPhrasePair(category, index) {
        if (!this.phrasesData || !this.phrasesData[category]) return null;
        return this.phrasesData[category][index] || null;
    }
}

/*
// Пример использования
async function exampleUsage() {
    // Создаем синтезатор с настройками
    const synthesizer = new SpeechSynthesizer({
        audioBaseUrl: 'https://example.com/audio_files/',
        useCachedAudio: true,
        fallbackToSpeech: true,
        checkAudioBeforePlay: true,
        audioTimeout: 15000
    });
    
    // Создаем менеджер фраз
    const phraseManager = new PhraseManager('phrases.json');
    await phraseManager.loadPhrases();
    
    // Получаем первую категорию
    const categories = phraseManager.getCategories();
    if (categories.length === 0) return;
    
    const firstCategory = categories[0];
    const phrases = phraseManager.getPhrasesByCategory(firstCategory);
    
    // Предзагрузка аудио для английских фраз
    const englishPhrases = phrases.map(p => p.target).filter(Boolean);
    await synthesizer.preloadAudios(englishPhrases, 'target', firstCategory);
    
    // Воспроизведение фраз
    for (const phrasePair of phrases) {
        console.log(`Playing: ${phrasePair.target} / ${phrasePair.native}`);
        
        const result = await synthesizer.speakPhrasePair(phrasePair, firstCategory, 1.0, 1000);
        
        if (result.target?.success || result.native?.success) {
            console.log('Playback successful');
        } else {
            console.log('Playback failed, both audio and synthesis failed');
        }
        
        // Ждем между фразами
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Получение статуса
    console.log('Synthesizer status:', synthesizer.getStatus());
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SpeechSynthesizer, PhraseManager };
}
*/