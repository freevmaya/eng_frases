// Класс для управления через кнопки наушников и медиа-сессию
class HeadphoneControls {
    constructor(playerController) {
        this.playerController = playerController;
        this.initialized = false;
        
        this.init();
    }
    
    // Инициализация
    init() {
        if (this.initialized) return;
        
        // Настраиваем Media Session API
        this.setupMediaSession();
        
        // Обработка клавиатурных событий (для кнопок наушников)
        this.setupKeyboardEvents();
        
        this.initialized = true;
        tracer.log('HeadphoneControls initialized');
    }
    
    // Настройка Media Session API
    setupMediaSession() {
        if (!('mediaSession' in navigator)) {
            console.warn('Media Session API not supported');
            return;
        }

        function audioFocus() {

            let elem = $('#audioElem');
            elem.focus();
            let machineEvent = new Event('click', {bubbles:true});
            elem[0].dispatchEvent(machineEvent);
        }
        
        // Устанавливаем действия
        navigator.mediaSession.setActionHandler('play', () => {
            tracer.log("Play");
            playerControls.show();
            this.playerController.togglePlay();
        });
        
        navigator.mediaSession.setActionHandler('pause', () => {
            tracer.log("Pause");
            playerControls.show();
            this.playerController.togglePlay();
        });
        
        navigator.mediaSession.setActionHandler('previoustrack', () => {
            tracer.log("previoustrack");
            //this.playerController.prevPhrase();
        });
        
        navigator.mediaSession.setActionHandler('nexttrack', () => {
            tracer.log("nexttrack");
            //this.playerController.nextPhrase();
        });
        
        // Обработка остановки
        navigator.mediaSession.setActionHandler('stop', () => {
            tracer.log("stop");
            //this.playerController.stopPlayback();
        });
        
        // Обновляем состояние медиа-сессии
        this.updateMediaMetadata();
    }
    
    // Настройка обработки клавиатурных событий
    setupKeyboardEvents() {
        document.addEventListener('keydown', (event) => {
            // Игнорируем события, если фокус в поле ввода
            if (event.target.tagName === 'INPUT' || 
                event.target.tagName === 'TEXTAREA' ||
                event.target.isContentEditable) {
                return;
            }
            
            switch (event.code) {
                case 'MediaPlayPause':
                case 'Space':
                    event.preventDefault();
                    this.playerController.togglePlay();
                    break;
                    
                case 'MediaTrackPrevious':
                case 'ArrowLeft':
                    event.preventDefault();
                    this.playerController.prevPhrase();
                    break;
                    
                case 'MediaTrackNext':
                case 'ArrowRight':
                    event.preventDefault();
                    this.playerController.nextPhrase();
                    break;
                    
                case 'MediaStop':
                    event.preventDefault();
                    this.playerController.stopPlayback();
                    break;
            }
        });
    }
    
    // Обновление метаданных медиа-сессии
    updateMediaMetadata(title = '', artist = '', album = '') {
        if (!('mediaSession' in navigator)) return;
        
        navigator.mediaSession.metadata = new MediaMetadata({
            title: title || 'English Phrases Trainer',
            artist: artist || 'Language Learning',
            album: album || 'Phrases Practice',
            artwork: [
                { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
            ]
        });
    }
    
    // Обновление состояния воспроизведения в медиа-сессии
    updatePlaybackState(isPlaying, isPaused = false) {
        if (!('mediaSession' in navigator)) return;
        
        navigator.mediaSession.playbackState = isPlaying ? 
            (isPaused ? 'paused' : 'playing') : 'none';
    }
    
    // Обновление позиции (для прогресса)
    updatePositionState(duration, position) {
        if (!('mediaSession' in navigator) || 
            !navigator.mediaSession.setPositionState) return;
        
        if (duration > 0) {
            navigator.mediaSession.setPositionState({
                duration: duration,
                playbackRate: 1.0,
                position: position
            });
        }
    }
    
    // Обновление информации о текущей фразе
    updateCurrentPhraseInfo(phrase, index, total) {
        if (!phrase) return;
        
        const title = phrase.target || phrase.native || 'No phrase';
        const artist = `Phrase ${index + 1} of ${total}`;
        const album = phrase.type || 'English Training';
        
        this.updateMediaMetadata(title, artist, album);
    }
    
    // Очистка медиа-сессии
    clearMediaSession() {
        if (!('mediaSession' in navigator)) return;
        
        navigator.mediaSession.playbackState = 'none';
        if (navigator.mediaSession.metadata) {
            navigator.mediaSession.metadata = null;
        }
    }
    
    // Остановка
    destroy() {
        document.removeEventListener('keydown', this.handleKeydown);
        this.clearMediaSession();
        this.initialized = false;
    }
}