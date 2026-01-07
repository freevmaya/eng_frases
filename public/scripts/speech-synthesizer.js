// Класс для управления синтезом речи
class SpeechSynthesizer {
    constructor() {
        this.state = {
            hasSpeechSynthesis: 'speechSynthesis' in window,
            speechError: false,
            isSpeaking: false,
            voices: [],
            voicesLoaded: false,
            useFallbackSound: false
        };
        
        this.currentUtterance = null;
        
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

    _afterFinishSpeak() {
        setTimeout(() => {
            this.state.isSpeaking = false;
            this.currentUtterance = null;
        }, 100);
    }

    // Озвучивание фразы
    speak(text, isEnglish = true, speed = 1.0) {
        if (!this.state.hasSpeechSynthesis) {
            console.log('Speech synthesis not supperted. Text:', text);
            return false;
        }

        if (this.state.speechError || this.state.isSpeaking) {
            console.log('Speech synthesis not available or already speaking. Text:', text);
            return false;
        }

        // Очищаем текст от скобок
        const cleanText = text.replace(/\([^()]*\)|\[[^\][]*\]/g, '').trim();
        
        try {
            this.state.isSpeaking = true;
            
            const utterance = new SpeechSynthesisUtterance(cleanText);
            this.currentUtterance = utterance;
            
            utterance.lang = isEnglish ? 'en-US' : 'ru-RU';
            utterance.rate = speed;
            utterance.volume = 1;
            
            // Ищем подходящий голос
            if (this.state.voicesLoaded && this.state.voices.length > 0) {
                const langPrefix = isEnglish ? 'en' : 'ru';
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

    // Остановка текущего озвучивания
    stop() {
        if (this.state.hasSpeechSynthesis) {
            speechSynthesis.cancel();
            this.state.isSpeaking = false;
            this.currentUtterance = null;
        }
    }

    // Проверка, говорит ли синтезатор в данный момент
    isSpeakingNow() {
        return this.state.isSpeaking;
    }

    // Проверка доступности синтеза речи
    isAvailable() {
        return this.state.hasSpeechSynthesis && !this.state.speechError;
    }

    // Получение статуса синтезатора
    getStatus() {
        return {
            available: this.isAvailable(),
            speaking: this.state.isSpeaking,
            voicesLoaded: this.state.voicesLoaded,
            voicesCount: this.state.voices.length
        };
    }
}