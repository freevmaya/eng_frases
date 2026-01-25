// Класс для управления синтезом речи и воспроизведением MP3 файлов
class SpeechSynthesizer {
    constructor(config = {}) {
        this.state = {
            hasSpeechSynthesis: 'speechSynthesis' in window,
            speechError: false,
            isBusy: false, // Объединенная переменная состояния
            busyType: null, // Тип текущей операции: 'speaking', 'playing', 'generating'
            voices: [],
            voicesLoaded: false,
            useFallbackSound: false
        };
        
        // Конфигурация
        this.config = {
            audioBaseUrl: config.audioBaseUrl || './audio_files/',
            apiBaseUrl: config.apiBaseUrl || 'http://localhost:5000/api/',
            useCachedAudio: config.useCachedAudio !== false,
            fallbackToSpeech: config.fallbackToSpeech !== false,
            checkAudioBeforePlay: config.checkAudioBeforePlay !== false,
            autoGenerateAudio: config.autoGenerateAudio !== false,
            audioTimeout: config.audioTimeout || 10000,
            generationTimeout: config.generationTimeout || 30000,
            ...config
        };
        
        this.currentUtterance = null;
        this.currentAudio = null;
        this.audioQueue = [];
        this.audioCache = new Map();
        
        this.init();
    }

    // Добавляем вспомогательные методы для управления состоянием
    _setBusy(type) {
        this.state.isBusy = true;
        this.state.busyType = type;
    }

    _clearBusy() {
        this.state.isBusy = false;
        this.state.busyType = null;
    }

    _isBusyWith(type = null) {
        if (!this.state.isBusy) return false;
        if (type) return this.state.busyType === type;
        return true;
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

        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
            this.state.voices = voices;
            this.state.voicesLoaded = true;
        }

        speechSynthesis.onvoiceschanged = () => {
            const updatedVoices = speechSynthesis.getVoices();
            if (updatedVoices.length > 0) {
                this.state.voices = updatedVoices;
                this.state.voicesLoaded = true;
            }
        };
    }

    hash(phrase) {
        if (!phrase) return '';
        
        const normalizedPhrase = phrase.trim()
                                       .split(/\s+/)
                                       .join(' ')
                                       .toLowerCase();
        
        const languageMap = {
            'target': 'en',
            'native': 'ru'
        };
        return CryptoJS.MD5(normalizedPhrase).toString();
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

    getBaseUrl(genderVoice = 'male') {
        return this.config.audioBaseUrl.replace(/<genderVoice>/, genderVoice);
    }

    // Формирование URL к аудиофайлу
    async getAudioUrl(phrase, phraseType = 'target', category = null, genderVoice = 'male') {
        const langPrefix = phraseType === 'target' ? 'en' : 'ru';
        const hash = await this.hash(phrase.trim());
        const fileName = `${langPrefix}_${hash}.mp3`;
        
        let fullUrl;

        // Изменено: теперь langPrefix вместо category
        fullUrl = `${this.getBaseUrl(genderVoice).replace(/\/$/, '')}/${langPrefix}/${fileName}`;
        
        return {
            fileName,
            url: fullUrl,
            langPrefix,
            hash,
            phrase: phrase.trim(),
            phraseType,
            category
        };
    }

    // Проверка существования аудиофайла по URL
    async checkAudioUrlExists(url) {
        const cacheKey = `check_${url}`;
        
        if (this.audioCache.has(cacheKey)) {
            return this.audioCache.get(cacheKey);
        }

        return false;
    }

    // Проверка аудиофайла на сервере через API
    async checkAudioOnServer(text, language = 'en', category = null) {
        try {
            const response = await fetch(`${this.config.apiBaseUrl}check-audio`, {
                method: 'POST',
                mode: 'cors',
                credentials: 'omit',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    language: language,
                    type: category
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            return result;
            
        } catch (error) {
            console.error('Error checking audio on server:', error);
            return {
                status: 'error',
                message: error.message
            };
        }
    }

    // Генерация аудиофайла на сервере
    async generateAudioOnServer(text, language = 'en', category = null, genderVoice = 'male') {
        if (this._isBusyWith('generating')) {
            return {
                status: 'error',
                message: 'Already generating audio'
            };
        }
        
        this._setBusy('generating');

        showAlert('Звуковой файл фразы генерируется!');
        
        try {
            console.log(`Requesting audio generation for: "${text.substring(0, 50)}..."`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.generationTimeout);
            
            const response = await fetch(`${this.config.apiBaseUrl}generate-audio`, {
                method: 'POST',
                mode: 'cors',
                credentials: 'omit',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    language: language,
                    type: category
                })
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Generation result:', result);
            
            // Очищаем кэш для этого файла
            const urlInfo = await this.getAudioUrl(text, language === 'en' ? 'target' : 'native', category, genderVoice);
            this.audioCache.delete(`check_${urlInfo.url}`);
            this.audioCache.delete(urlInfo.url);
            
            return result;
            
        } catch (error) {
            console.error('Error generating audio on server:', error);
            return {
                status: 'error',
                message: error.message
            };
        } finally {
            this._clearBusy();
        }
    }

    // Умное воспроизведение с проверкой и генерацией
    async smartSpeak(text, language = 'en', category = null, speed = 1.0, genderVoice = 'male') {
        const cleanText = text.replace(/\([^()]*\)|\[[^\][]*\]/g, '').trim();
        const phraseType = language === 'en' ? 'target' : 'native';
        
        // Проверяем, занят ли плеер
        if (this.state.isBusy) {
            return {
                success: false,
                error: `Player is busy with ${this.state.busyType}`,
                busyType: this.state.busyType
            };
        }

        // Устанавливаем состояние занятости в начале операции
        this._setBusy('processing');

        try {
            if (this.config.noServer) {
                const localUrlInfo = await this.getAudioUrl(cleanText, phraseType, category, genderVoice);
                return await this.playAudioFromUrl(localUrlInfo, cleanText);
            }
            
            // 1. Сначала проверяем локально
            if (this.config.useCachedAudio) {
                const localUrlInfo = await this.getAudioUrl(cleanText, phraseType, category, genderVoice);
                const localExists = await this.checkAudioUrlExists(localUrlInfo.url);
                
                if (localExists) {
                    console.log(`Found local audio: ${localUrlInfo.fileName}`);
                    return await this.playAudioFromUrl(localUrlInfo, cleanText);
                }
            }
            
            // 2. Проверяем на сервере
            console.log(`Checking audio "${text}" on server...`);
            const checkResult = await this.checkAudioOnServer(cleanText, language, category);
            
            if (checkResult.status === 'found') {
                console.log(`Audio "${text}" found on server: ${checkResult.data.filename}`);
                
                // Пробуем проиграть файл с сервера
                const serverUrlInfo = {
                    fileName: checkResult.data.filename,
                    // Изменено: теперь langPrefix вместо category
                    url: `${this.getBaseUrl(genderVoice).replace(/\/$/, '')}/${language}/${checkResult.data.filename}`.replace('//', '/'),
                    langPrefix: language,
                    hash: checkResult.data.filename.replace(`${language}_`, '').replace('.mp3', ''),
                    phrase: cleanText,
                    phraseType: phraseType,
                    category: checkResult.data.category
                };
                
                try {
                    return await this.playAudioFromUrl(serverUrlInfo, cleanText);
                } catch (playError) {
                    console.warn('Failed to play server audio, trying fallback...', playError);
                }
            }
            
            // 3. Если не нашли, генерируем на сервере (если разрешено)
            if (this.config.autoGenerateAudio) {
                console.log('Audio not found, generating on server...');
                const generationResult = await this.generateAudioOnServer(cleanText, language, category);
                
                if (generationResult.status === 'success' || generationResult.status === 'ok') {
                    console.log('Audio generated successfully:', generationResult.data.filename);
                    
                    // Даем серверу время на сохранение файла
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Пробуем проиграть сгенерированный файл
                    const generatedUrlInfo = {
                        fileName: generationResult.data.filename,
                        url: generationResult.data.filepath || 
                             // Изменено: теперь language вместо category
                             `${this.getBaseUrl(genderVoice).replace(/\/$/, '')}/${language}/${generationResult.data.filename}`.replace('//', '/'),
                        langPrefix: language,
                        hash: generationResult.data.filename.replace(`${language}_`, '').replace('.mp3', ''),
                        phrase: cleanText,
                        phraseType: phraseType,
                        category: generationResult.data.category
                    };
                    
                    try {
                        return await this.playAudioFromUrl(generatedUrlInfo, cleanText);
                    } catch (playError) {
                        console.warn('Failed to play generated audio, trying fallback...', playError);
                    }
                } else {
                    console.warn('Audio generation failed:', generationResult.message);
                }
            }
            
            // 4. Fallback на локальный синтез речи
            if (this.config.fallbackToSpeech && this.state.hasSpeechSynthesis) {
                console.log('Using fallback speech synthesis');
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
            
            // Если ничего не сработало, очищаем состояние
            this._clearBusy();
            return {
                success: false,
                type: 'none',
                error: 'No audio available and fallback failed',
                phrase: cleanText
            };
            
        } catch (error) {
            console.error('Error in smartSpeak:', error);
            
            // Final fallback
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
            
            // Очищаем состояние при ошибке
            this._clearBusy();
            return {
                success: false,
                type: 'none',
                error: error.message,
                phrase: cleanText
            };
        }
    }

    // Воспроизведение MP3 файла по URL
    async playAudioFromUrl(urlInfo, phrase) {
        // Проверяем, занят ли плеер
        if (this.state.isBusy && this.state.busyType !== 'processing') {
            return {
                success: false,
                error: `Player is busy with ${this.state.busyType}`,
                busyType: this.state.busyType
            };
        }

        // Обновляем тип занятости с 'processing' на 'playing'
        this._setBusy('playing');

        try {
            console.log(`Play: ${phrase}`);
            
            let audio;
            if (this.preloadedAudios.has(urlInfo.url)) {
                audio = this.preloadedAudios.get(urlInfo.url);
                audio.currentTime = 0;
            } else {
                audio = new Audio();
                audio.src = urlInfo.url;
                audio.preload = 'auto';
                this.preloadedAudios.set(urlInfo.url, audio);
            }
            
            this.currentAudio = audio;
            
            audio.volume = 1.0;
            audio.playbackRate = 1.0;
            
            return new Promise((resolve, reject) => {
                let timeoutId;
                
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
                    audio.removeEventListener('ended', onEnded);
                    audio.removeEventListener('error', onError);
                };
                
                timeoutId = setTimeout(onTimeout, this.config.audioTimeout);
                
                audio.addEventListener('ended', onEnded);
                audio.addEventListener('error', onError);
                
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
            this._clearBusy();
            this.currentAudio = null;
            throw error;
        }
    }

    _afterFinishPlay() {
        setTimeout(() => {
            this._clearBusy();
            this.currentAudio = null;
        }, 100);
    }

    _afterFinishSpeak() {
        setTimeout(() => {
            this._clearBusy();
            this.currentUtterance = null;
        }, 100);
    }

    // Основной метод воспроизведения (обратная совместимость)
    async speak(phrase, phraseType = 'target', category = null, speed = 1.0, genderVoice = 'male') {
        const language = phraseType === 'target' ? 'en' : 'ru';

        if (this.state.isBusy)
            await this.waitForCompletion();

        if ((phrase[phrase.length - 1] == '?') && (language == 'ru'))
            $(window).trigger('question_phrase');

        console.log(`Attemp play ${phrase}`);

        return this.smartSpeak(phrase, language, category, speed, genderVoice);
    }

    // Внутренний метод для синтеза речи
    _speakWithSynthesis(text, phraseType = 'target', speed = 1.0) {
        if (!this.state.hasSpeechSynthesis) return false;
        
        try {
            this._setBusy('speaking');
            
            const utterance = new SpeechSynthesisUtterance(text);
            this.currentUtterance = utterance;
            
            utterance.lang = phraseType === 'target' ? 'en-US' : 'ru-RU';
            utterance.rate = speed;
            utterance.volume = 1;
            
            if (this.state.voicesLoaded && this.state.voices.length > 0) {
                const langPrefix = phraseType === 'target' ? 'en' : 'ru';
                const voice = this.state.voices.find(v => v.lang.startsWith(langPrefix));
                if (voice) utterance.voice = voice;
            }
            
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
            this._clearBusy();
            this.currentUtterance = null;
            return false;
        }
    }

    // Воспроизведение пары фраз (target и native)
    async speakPhrasePair(phrasePair, category = null, speed = 1.0, delayBetween = 500) {
        const results = {};
        
        if (phrasePair.target && phrasePair.target.trim()) {
            results.target = await this.smartSpeak(
                phrasePair.target, 
                'en', 
                category, 
                speed
            );
            
            if (results.target.success && phrasePair.native) {
                await this.waitForCompletion();
                await new Promise(resolve => setTimeout(resolve, delayBetween));
            }
        }
        
        if (phrasePair.native && phrasePair.native.trim()) {
            results.native = await this.smartSpeak(
                phrasePair.native, 
                'ru', 
                category, 
                speed
            );
        }
        
        return results;
    }

    // Предварительная генерация аудио на сервере
    async pregenerateAudios(phrases, language = 'en', category = null) {
        const results = [];
        
        for (const phrase of phrases) {
            if (!phrase || !phrase.trim()) continue;
            
            const cleanText = phrase.replace(/\([^()]*\)|\[[^\][]*\]/g, '').trim();
            
            console.log(`Pre-generating audio for: "${cleanText.substring(0, 50)}..."`);
            
            try {
                // Сначала проверяем
                const checkResult = await this.checkAudioOnServer(cleanText, language, category);
                
                if (checkResult.status === 'found') {
                    results.push({
                        phrase: cleanText,
                        status: 'already_exists',
                        filename: checkResult.data.filename
                    });
                    continue;
                }
                
                // Генерируем если нет
                const genResult = await this.generateAudioOnServer(cleanText, language, category);
                
                if (genResult.status === 'success' || genResult.status === 'ok') {
                    results.push({
                        phrase: cleanText,
                        status: 'generated',
                        filename: genResult.data.filename
                    });
                } else {
                    results.push({
                        phrase: cleanText,
                        status: 'error',
                        error: genResult.message
                    });
                }
                
                // Небольшая пауза между запросами
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                results.push({
                    phrase: cleanText,
                    status: 'error',
                    error: error.message
                });
            }
        }
        
        return results;
    }

    // Ожидание завершения текущего воспроизведения
    async waitForCompletion(timeout = 30000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            const checkInterval = setInterval(() => {
                if (!this.state.isBusy) {
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

    // Проверка состояния сервера
    async checkServerHealth() {
        try {
            const response = await fetch(`${this.config.apiBaseUrl}health`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            return result;
            
        } catch (error) {
            console.error('Error checking server health:', error);
            return {
                status: 'error',
                message: error.message
            };
        }
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
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
        
        if (this.state.hasSpeechSynthesis) {
            speechSynthesis.cancel();
            this.currentUtterance = null;
        }
        
        this._clearBusy();
    }

    // Получение статуса синтезатора
    getStatus() {
        return {
            available: this.isAvailable(),
            isBusy: this.state.isBusy,
            busyType: this.state.busyType,
            voicesLoaded: this.state.voicesLoaded,
            voicesCount: this.state.voices.length,
            preloadedAudiosCount: this.preloadedAudios.size,
            config: {
                audioBaseUrl: this.config.audioBaseUrl,
                apiBaseUrl: this.config.apiBaseUrl,
                useCachedAudio: this.config.useCachedAudio,
                fallbackToSpeech: this.config.fallbackToSpeech,
                autoGenerateAudio: this.config.autoGenerateAudio
            }
        };
    }
}

// Пример использования
async function exampleUsage() {
    const synthesizer = new SpeechSynthesizer({
        audioBaseUrl: 'data/audio_files',
        apiBaseUrl: 'http://localhost:5000/api/',
        useCachedAudio: true,
        fallbackToSpeech: true,
        autoGenerateAudio: true, // Включить автоматическую генерацию
        generationTimeout: 30000
    });
    
    // Проверяем состояние сервера
    const health = await synthesizer.checkServerHealth();
    console.log('Server health:', health);
    
    if (health.status !== 'healthy') {
        console.warn('Server might not be available. Some features may not work.');
    }
    
    // Умное воспроизведение
    const result = await synthesizer.smartSpeak(
        "What do you do?",
        'en',
        'Past simple',
        1.0
    );
    
    console.log('Playback result:', result);
    
    // Получение статуса
    console.log('Synthesizer status:', synthesizer.getStatus());
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SpeechSynthesizer };
}