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
            fallbackToSpeech: config.fallbackToSpeech !== false,
            checkAudioBeforePlay: config.checkAudioBeforePlay !== false,
            autoGenerateAudio: config.autoGenerateAudio !== false,
            audioTimeout: config.audioTimeout || 2000,
            generationTimeout: config.generationTimeout || 30000,
            ...config
        };
        
        this.currentUtterance = null;
        this.currentAudio = null;
        this.audioQueue = [];
        this.audioCache = [];
        
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

        return CryptoJS.MD5(phrase.trim()
                                .split(/\s+/)
                                .join(' ')
                                .toLowerCase()).toString();
    }

    getBaseUrl(genderVoice = 'male') {
        return this.config.audioBaseUrl.replace(/<genderVoice>/, genderVoice);
    }

    // Формирование URL к аудиофайлу
    async getAudioUrl(phrase, language, category = null, genderVoice = 'male') {

        const hash = await this.hash(phrase.trim());
        const fileName = `${language}_${hash}.mp3`;
        
        let fullUrl = `${this.getBaseUrl(genderVoice).replace(/\/$/, '')}/${language}/${fileName}`;
        
        return {
            fileName,
            url: fullUrl,
            language,
            hash,
            phrase: phrase.trim(),
            category
        };
    }

    // Проверка аудиофайла на сервере через API
    async checkAudioOnServer(text, language, category = null) {
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
    async smartSpeak(phraseObj, phraseType, category = null, speed = 1.0, genderVoice = 'male') {
        const cleanText = phraseObj.CleanText(phraseType);
        const language = phraseObj.Language(phraseType);
        
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
                
            const localUrlInfo = await this.getAudioUrl(cleanText, language, category, genderVoice);
            console.log(`Attemp play ${phraseObj[phraseType]}: ${localUrlInfo.url}`);

            if (this.config.noServer)
                return await this.playAudioFromUrl(localUrlInfo.url);
            
            if (this.audioCache.includes(localUrlInfo.url)) {
                console.log(`Found local audio: ${localUrlInfo.fileName}`);
                return await this.playAudioFromUrl(localUrlInfo.url);
            }
            
            // 2. Проверяем на сервере
            console.log(`Checking audio "${cleanText}" on server...`);
            const checkResult = await this.checkAudioOnServer(cleanText, language, category);
            
            if (checkResult.status === 'found') {
                this.audioCache.push(localUrlInfo.url);
                console.log(`Audio "${cleanText}" found on server: ${checkResult.data.filename}`);
                
                // Пробуем проиграть файл с сервера
                const serverUrlInfo = {
                    fileName: checkResult.data.filename,
                    url: `${this.getBaseUrl(genderVoice).replace(/\/$/, '')}/${language}/${checkResult.data.filename}`.replace('//', '/')
                };
                
                try {
                    return await this.playAudioFromUrl(serverUrlInfo.url);
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
                        return await this.playAudioFromUrl(generatedUrlInfo.url);
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
                return this._speakWithSynthesis(phraseObj, phraseType, speed);
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
                return this._speakWithSynthesis(phraseObj, phraseType, speed);
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

    isPlayingAudio() {
        return this.currentAudio && 
                (!this.currentAudio.paused && 
                 !this.currentAudio.ended && 
                 this.currentAudio.readyState >= 4);
    }

    // Воспроизведение MP3 файла по URL
    async playAudioFromUrl(fileUrl) {

        // Обновляем тип занятости с 'processing' на 'playing'
        this._setBusy('playing');

        try {
            
            let audio;
            if (this.preloadedAudios.has(fileUrl)) {
                audio = this.preloadedAudios.get(fileUrl);
                audio.currentTime = 0;
            } else {
                audio = new Audio();
                audio.src = fileUrl;
                audio.preload = 'auto';
                this.preloadedAudios.set(fileUrl, audio);
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
                        url: fileUrl,
                        duration: audio.duration
                    });
                };
                
                const onError = (error) => {
                    cleanup();
                    if (this._isBusyWith('playing')) {
                        this._afterFinishPlay();
                        console.error('Audio playback error:', error, fileUrl);
                        reject(new Error(`Audio playback failed: ${fileUrl}`));
                    }
                };
                
                const cleanup = () => {
                    clearTimeout(timeoutId);
                    audio.removeEventListener('ended', onEnded);
                    audio.removeEventListener('error', onError);
                };
                
                timeoutId = setTimeout(() => {
                    if (this.currentAudio && !this.isPlayingAudio() &&
                        (this.currentAudio.src == fileUrl)) {
                        cleanup();
                        this._afterFinishPlay();
                        reject(new Error(`Audio playback timeout: ${fileUrl}`));
                    }
                }, this.config.audioTimeout);
                
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
            this._afterFinishPlay();
            throw error;
        }
    }

    _afterFinishPlay() {
        this._clearBusy();
        this.currentAudio = null;
    }

    _afterFinishSpeak() {
        this._clearBusy();
        this.currentUtterance = null;
    }

    // Основной метод воспроизведения (обратная совместимость)
    async speak(phraseObj, phraseType = 'target', category = null, speed = 1.0, genderVoice = 'male') {

        if (this.state.isBusy) {
            return;
            await this.waitForCompletion();
        }

        if ((phraseType == 'native') && phraseObj.isQuestion(phraseType))
            $(window).trigger('question_phrase');

        return this.smartSpeak(phraseObj, phraseType, category, speed, genderVoice);
    }

    // Внутренний метод для синтеза речи
    _speakWithSynthesis(phraseObj, phraseType = 'target', speed = 1.0) {
        if (!this.state.hasSpeechSynthesis) return false;

        const text = phraseObj.CleanText(phraseType);
        const language = phraseObj.Language(phraseType);
        
        try {
            this._setBusy('speaking');
            
            const utterance = new SpeechSynthesisUtterance(text);
            this.currentUtterance = utterance;
            
            utterance.lang = LanguageMap[language];// phraseType === 'target' ? 'en-US' : 'ru-RU';
            utterance.rate = speed;
            utterance.volume = 1;
            
            if (this.state.voicesLoaded && this.state.voices.length > 0) {

                const voice = this.state.voices.find(v => v.lang.startsWith(language));
                if (voice) utterance.voice = voice;
            }

            return new Promise((resolve, reject)=>{
            
                utterance.onend = () => {
                    this._afterFinishSpeak();
                    resolve({
                        success: true
                    });
                };
                
                utterance.onerror = (event) => {
                    console.error('Speech synthesis error:', event);
                    this._afterFinishSpeak();
                    resolve({
                        success: false,
                        error: event
                    });
                };
                
                speechSynthesis.speak(utterance);

            })
            
        } catch (error) {
            console.error('Speech synthesis failed:', error);
            this._clearBusy();
            this.currentUtterance = null;
            return false;
        }
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
        this.audioCache = [];
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
                fallbackToSpeech: this.config.fallbackToSpeech,
                autoGenerateAudio: this.config.autoGenerateAudio
            }
        };
    }
}
/*
// Пример использования
async function exampleUsage() {
    const synthesizer = new SpeechSynthesizer({
        audioBaseUrl: 'data/audio_files',
        apiBaseUrl: 'http://localhost:5000/api/',
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
*/

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SpeechSynthesizer };
}