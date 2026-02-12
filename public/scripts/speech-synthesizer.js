class SpeechSynthesizer {
    constructor(config = {}) {
        this.state = {
            hasSpeechSynthesis: 'speechSynthesis' in window,
            speechError: false,
            isBusy: false,
            busyType: null,
            voices: [],
            voicesLoaded: false,
            useFallbackSound: false
        };
        
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
        
        this.init();
    }

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

    isBusy() {
        return this.state.isBusy;
    }

    init() {
        if (this.state.hasSpeechSynthesis) {
            this.loadVoices();
        } else {
            console.warn('Speech synthesis not available');
            this.state.speechError = true;
        }
        
        this.loadedAudios = new Map();
    }

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
                                   .normalize('NFC')
                                   .split(/\s+/)
                                   .join(' ')
                                   .toLowerCase();
        return CryptoJS.MD5(normalizedPhrase).toString();
    }

    getBaseUrl(genderVoice = 'male') {
        return this.config.audioBaseUrl.replace(/<genderVoice>/, genderVoice);
    }

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

    async checkAudioOnServer(text, language, category = null, gender='male') {
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
                    type: category,
                    gender: gender
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            return result;
            
        } catch (error) {
            tracer.error('Error checking audio on server:', error);
            return {
                status: 'error',
                message: error.message
            };
        }
    }

    async generateAudioOnServer(text, language = 'en', category = null, 
                            gender = 'male', voice_name = '', rewrite = false) {
        if (this._isBusyWith('generating')) {
            return {
                status: 'error',
                message: Lang("already_generating_audio")
            };
        }
        
        this._setBusy('generating');

        showAlert(Lang("generating_audio_file"));
        
        try {
            tracer.log(Lang("requesting_audio_generation_for").replace('%1', text.substring(0, 50)));
            
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
                    type: category,
                    gender: gender,
                    voice_name: voice_name,
                    rewrite: rewrite
                })
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            tracer.log('Generation result:', result);
            
            return result;
            
        } catch (error) {
            tracer.error('Error generating audio on server:', error);
            return {
                status: 'error',
                message: error.message
            };
        } finally {
            this._clearBusy();
        }
    }
    
    async Regenerate(phraseObj, phraseType = 'target', genderVoice = 'male') {

        if (this.state.isBusy)
            return;

        const cleanText = phraseObj.CleanText(phraseType);
        const language = phraseObj.Language(phraseType);

        try {
                
            const localUrlInfo = await this.getAudioUrl(cleanText, language, null, genderVoice);
            const generationResult = await this.generateAudioOnServer(cleanText, language, null, genderVoice, '', true);
        } catch (error) {
            tracer.error(error);
        }
    }

    async smartSpeak(phraseObj, phraseType, category = null, speed = 1.0, genderVoice = 'male') {
        const cleanText = phraseObj.CleanText(phraseType);
        const language = phraseObj.Language(phraseType);
        
        if (this.state.isBusy) {
            return {
                success: false,
                error: Lang("player_busy_with").replace('%1', this.state.busyType),
                busyType: this.state.busyType
            };
        }

        this._setBusy('processing');

        try {
                
            const localUrlInfo = await this.getAudioUrl(cleanText, language, category, genderVoice);

            try {
                return await this.playAudioFromUrl(localUrlInfo.url);
            } catch(e) {

                if (e.name == 'Error') {
            
                    if (this.config.autoGenerateAudio) {
                        tracer.log('Audio not found, generating on server...');
                        const generationResult = await this.generateAudioOnServer(cleanText, language, category, genderVoice);
                        
                        if (generationResult.status === 'success' || generationResult.status === 'ok') {
                            tracer.log('Audio generated successfully:', generationResult.data.filename);
                            
                            await new Promise(resolve => setTimeout(resolve, 500));
                            
                            try {
                                return await this.playAudioFromUrl(localUrlInfo.url);
                            } catch (playError) {
                                console.warn('Failed to play generated audio, trying fallback...', playError);
                            }
                        } else {
                            console.warn('Audio generation failed:', generationResult.message);
                        }
                    }
                }
            }
            
            if (this.config.fallbackToSpeech && this.state.hasSpeechSynthesis) {
                tracer.log('Using fallback speech synthesis');
                return this._speakWithSynthesis(phraseObj, phraseType, speed);
            } else {

                $(window).trigger("play_autio_error", {
                    name: 'No speech synthesis'
                });
                return await new Promise(resolve => setTimeout(resolve, cleanText.length * AppConst.charTime[phraseType]));
            }
            
            this._clearBusy();
            return {
                success: false,
                type: 'none',
                error: 'No audio available and fallback failed',
                phrase: cleanText
            };
            
        } catch (error) {

            tracer.error('Error in smartSpeak:', error);
            
            if (this.config.fallbackToSpeech && this.state.hasSpeechSynthesis) {
                return this._speakWithSynthesis(phraseObj, phraseType, speed);
            } else {

                $(window).trigger("play_autio_error", {
                    name: 'No speech synthesis'
                });
                return await new Promise(resolve => setTimeout(resolve, cleanText.length * AppConst.charTime[phraseType]));
            }
            
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

    async playAudioFromUrl(fileUrl) {

        this._setBusy('playing');

        try {
            
            let audio;
            if (this.loadedAudios.has(fileUrl)) {
                audio = this.loadedAudios.get(fileUrl);
                audio.currentTime = 0;
            } else {
                audio = new Audio();
                audio.src = fileUrl;
                audio.preload = 'auto';

                if (typeof ErrorTracker !== 'undefined')
                    ErrorTracker.attachResourceErrorHandler(audio);
            }

            this._stopPlayback();
            this.currentAudio = audio;
            
            audio.volume = 1.0;
            audio.playbackRate = 1.0;
            
            return new Promise((resolve, reject) => {
                let timeoutId;

                const onLoaded = ()=>{
                    tracer.log(`Set loaded: ${fileUrl}`);
                }
                
                const onEnded = () => {
                    cleanup();
                    resolve({
                        success: true,
                        type: 'audio',
                        url: fileUrl,
                        duration: audio.duration
                    });
                };

                const onPause = ()=>{
                    let finish = audio.currentTime == audio.duration;
                    cleanup();
                    if (finish) {
                        resolve({
                            success: true,
                            type: 'audio',
                            url: fileUrl,
                            duration: audio.duration
                        });
                    }
                }
                
                const onError = (error) => {
                    if (this._isBusyWith('playing')) {
                        cleanup();
                        tracer.error('Audio playback error:', error, fileUrl);
                        reject(new Error(Lang("audio_playback_failed").replace('%1', fileUrl)));
                    } else cleanup();
                };
                
                const cleanup = () => {
                    clearTimeout(timeoutId);
                    audio.removeEventListener('ended', onEnded);
                    audio.removeEventListener('error', onError);
                    audio.removeEventListener('pause', onPause);
                    audio.removeEventListener('loadeddata', onLoaded);
                    this._afterFinishPlay();
                };
                
                audio.addEventListener('ended', onEnded);
                audio.addEventListener('error', onError);
                audio.addEventListener('pause', onPause);
                audio.addEventListener('loadeddata', onLoaded);
                
                tracer.log(`Play:${fileUrl}`);
                const playPromise = audio.play();
                
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        cleanup();
                        tracer.error(error);
                        $(window).trigger("play_autio_error", error);
                        reject(error);
                    });
                }
            });
            
        } catch (error) {
            tracer.error('Error playing audio:', error);
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

    async speak(phraseObj, phraseType = 'target', category = null, speed = 1.0, genderVoice = 'male') {

        if (this.state.isBusy) {
            return;
        }

        if ((phraseType == 'native') && phraseObj.isQuestion(phraseType))
            $(window).trigger('question_phrase');

        return this.smartSpeak(phraseObj, phraseType, category, speed, genderVoice);
    }

    _speakWithSynthesis(phraseObj, phraseType = 'target', speed = 1.0) {
        if (!this.state.hasSpeechSynthesis) return false;

        const text = phraseObj.CleanText(phraseType);
        const language = phraseObj.Language(phraseType);
        
        try {
            this._setBusy('speaking');
            
            const utterance = new SpeechSynthesisUtterance(text);
            this.currentUtterance = utterance;
            
            utterance.lang = LanguageMap[language];
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
                    tracer.error('Speech synthesis error:', event);
                    this._afterFinishSpeak();
                    resolve({
                        success: false,
                        error: event
                    });
                };

                this._stopPlayback();
                speechSynthesis.speak(utterance);

            })
            
        } catch (error) {
            tracer.error('Speech synthesis failed:', error);
            this._clearBusy();
            this.currentUtterance = null;
            return false;
        }
    }

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

    async checkServerHealth() {
        try {
            const response = await fetch(`${this.config.apiBaseUrl}health`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            return result;
            
        } catch (error) {
            tracer.error('Error checking server health:', error);
            return {
                status: 'error',
                message: error.message
            };
        }
    }

    clearAudioCache() {
        this.loadedAudios.forEach(audio => {
            audio.pause();
            audio.src = '';
        });
        this.loadedAudios.clear();
        tracer.log('Audio cache cleared');
    }

    stopAudio(audio) {
        if (audio.currentTime < audio.duration) {

            const filename = audio.src.split('/').pop();
            let count = 0;

            afterCondition(()=>{
                count++;
                return audio.currentTime > 0;
            }, ()=>{
                let msg = Lang("pause_with_filename_and_time").replace('%1', filename).replace('%2', audio.currentTime).replace('%3', count);
                if (count > 1)
                    tracer.error(msg);
                else tracer.log(msg);
                
                audio.pause();
                audio.currentTime = 0;
            }, 1000, 100);
        }
    }

    _stopPlayback() {
        if (this.currentAudio) {
            this.stopAudio(this.currentAudio);
            this.currentAudio = null;
        }
        
        if (this.state.hasSpeechSynthesis) {
            speechSynthesis.cancel();
            this.currentUtterance = null;
        }
    }

    stop() {
        this._stopPlayback();
        this._clearBusy();
    }

    getStatus() {
        return {
            available: this.isAvailable(),
            isBusy: this.state.isBusy,
            busyType: this.state.busyType,
            voicesLoaded: this.state.voicesLoaded,
            voicesCount: this.state.voices.length,
            loadedAudiosCount: this.loadedAudios.size,
            config: {
                audioBaseUrl: this.config.audioBaseUrl,
                apiBaseUrl: this.config.apiBaseUrl,
                fallbackToSpeech: this.config.fallbackToSpeech,
                autoGenerateAudio: this.config.autoGenerateAudio
            }
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SpeechSynthesizer };
}