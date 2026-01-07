/**
 * Класс для обработки медиа-кнопок на наушниках и других устройств
 */
class MediaKeysHandler {
    constructor(playerControls) {
        this.playerControls = playerControls;
        this.isSupported = 'mediaSession' in navigator;
        this.isPlaying = false;
        this.currentTrack = 0;
        this.totalTracks = 0;
        
        this.init();
    }
    
    init() {
        if (!this.isSupported) {
            console.warn('Media Session API не поддерживается в этом браузере');
            return;
        }
        
        this.setupMediaSession();
        this.setupEventListeners();
    }
    
    setupMediaSession() {
        // Настройка метаданных трека
        navigator.mediaSession.metadata = new MediaMetadata({
            title: 'English Phrases Trainer',
            artist: 'Английские фразы',
            album: 'Обучение языку',
            artwork: [
                { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
            ]
        });
        
        // Обработчики действий
        navigator.mediaSession.setActionHandler('play', () => {
            this.handlePlay();
        });
        
        navigator.mediaSession.setActionHandler('pause', () => {
            this.handlePause();
        });
        
        navigator.mediaSession.setActionHandler('previoustrack', () => {
            this.handlePreviousTrack();
        });
        
        navigator.mediaSession.setActionHandler('nexttrack', () => {
            this.handleNextTrack();
        });
        
        // Поддержка seek (перемотка)
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
            this.handleSeekBackward(details);
        });
        
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
            this.handleSeekForward(details);
        });
        
        // Поддержка остановки
        navigator.mediaSession.setActionHandler('stop', () => {
            this.handleStop();
        });
    }
    
    setupEventListeners() {
        // Обработка клавиатурных событий (для тестирования)
        document.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });
        
        // Обработка события видимости страницы
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.updatePlaybackState('paused');
            }
        });
        
        // Обработка события фокуса
        window.addEventListener('focus', () => {
            this.updatePlaybackState();
        });
    }
    
    handlePlay() {
        console.log('Media key: Play');
        this.isPlaying = true;
        
        // Запуск воспроизведения в основном приложении
        if (window.togglePlay && typeof window.togglePlay === 'function') {
            window.togglePlay();
        }
        
        // Обновление состояния Media Session
        navigator.mediaSession.playbackState = 'playing';
        this.updatePositionState();
    }
    
    handlePause() {
        console.log('Media key: Pause');
        this.isPlaying = false;
        
        // Пауза в основном приложении
        if (window.togglePause && typeof window.togglePause === 'function') {
            window.togglePause();
        }
        
        navigator.mediaSession.playbackState = 'paused';
    }
    
    handlePreviousTrack() {
        console.log('Media key: Previous Track');
        
        // Переход к предыдущей фразе
        if (window.prevPhrase && typeof window.prevPhrase === 'function') {
            window.prevPhrase();
        }
        
        this.updateTrackInfo();
    }
    
    handleNextTrack() {
        console.log('Media key: Next Track');
        
        // Переход к следующей фразе
        if (window.nextPhrase && typeof window.nextPhrase === 'function') {
            window.nextPhrase();
        }
        
        this.updateTrackInfo();
    }
    
    handleSeekBackward(details) {
        console.log('Media key: Seek Backward', details);
        
        // Возврат на 10 секунд или перемотка
        if (window.seekBackward && typeof window.seekBackward === 'function') {
            window.seekBackward(details.seekOffset || 10);
        }
    }
    
    handleSeekForward(details) {
        console.log('Media key: Seek Forward', details);
        
        // Перемотка вперед на 10 секунд
        if (window.seekForward && typeof window.seekForward === 'function') {
            window.seekForward(details.seekOffset || 10);
        }
    }
    
    handleStop() {
        console.log('Media key: Stop');
        this.isPlaying = false;
        
        // Остановка воспроизведения
        if (window.stopPlayback && typeof window.stopPlayback === 'function') {
            window.stopPlayback();
        }
        
        navigator.mediaSession.playbackState = 'none';
    }
    
    handleKeyDown(e) {
        // Обработка клавиш для тестирования
        switch(e.code) {
            case 'MediaPlayPause':
                e.preventDefault();
                this.isPlaying ? this.handlePause() : this.handlePlay();
                break;
                
            case 'MediaTrackPrevious':
                e.preventDefault();
                this.handlePreviousTrack();
                break;
                
            case 'MediaTrackNext':
                e.preventDefault();
                this.handleNextTrack();
                break;
                
            case 'MediaStop':
                e.preventDefault();
                this.handleStop();
                break;
                
            case 'Space':
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    this.isPlaying ? this.handlePause() : this.handlePlay();
                }
                break;
                
            case 'ArrowLeft':
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.handlePreviousTrack();
                }
                break;
                
            case 'ArrowRight':
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.handleNextTrack();
                }
                break;
        }
    }
    
    // Обновление информации о текущем треке
    updateTrackInfo(phraseData = null) {
        if (!this.isSupported) return;
        
        if (phraseData) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: phraseData.english || 'Английская фраза',
                artist: phraseData.russian || 'Перевод',
                album: 'English Phrases Trainer',
                artwork: [
                    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
                ]
            });
        }
        
        this.updatePositionState();
    }
    
    // Обновление состояния позиции (для прогресса)
    updatePositionState(duration = 60, position = 0, playbackRate = 1.0) {
        if (!this.isSupported || !navigator.mediaSession.setPositionState) return;
        
        try {
            navigator.mediaSession.setPositionState({
                duration: duration, // Длительность в секундах
                playbackRate: playbackRate,
                position: position // Текущая позиция в секундах
            });
        } catch (error) {
            console.log('Position state update failed:', error);
        }
    }
    
    // Обновление состояния воспроизведения
    updatePlaybackState(state = null) {
        if (!this.isSupported) return;
        
        if (state) {
            navigator.mediaSession.playbackState = state;
        } else if (window.stateManager) {
            const currentState = window.stateManager.getState();
            navigator.mediaSession.playbackState = 
                currentState.isPlaying && !currentState.isPaused ? 'playing' : 'paused';
        }
    }
    
    // Обновление информации о прогрессе
    updateProgress(currentIndex, totalCount) {
        this.currentTrack = currentIndex;
        this.totalTracks = totalCount;
        
        this.updateTrackInfo();
    }
    
    // Установка состояния воспроизведения
    setPlaying(isPlaying) {
        this.isPlaying = isPlaying;
        this.updatePlaybackState(isPlaying ? 'playing' : 'paused');
    }
    
    // Получение состояния поддержки
    getSupportStatus() {
        return {
            mediaSession: this.isSupported,
            actions: {
                play: navigator.mediaSession && !!navigator.mediaSession.setActionHandler('play'),
                pause: navigator.mediaSession && !!navigator.mediaSession.setActionHandler('pause'),
                previous: navigator.mediaSession && !!navigator.mediaSession.setActionHandler('previoustrack'),
                next: navigator.mediaSession && !!navigator.mediaSession.setActionHandler('nexttrack')
            }
        };
    }
}