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
        
        // Аудио элемент для Bluetooth
        this.audioElement = null;
        this.silentAudioUrl = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA=='; // 1 секунда тишины
        
        this.init();
    }
    
    init() {
        // Сначала создаем аудио элемент
        this.setupAudioElement();
        
        // Затем настраиваем Media Session
        if (!this.isSupported) {
            console.warn('Media Session API не поддерживается в этом браузере');
            console.log('Используем fallback для Bluetooth кнопок');
            this.setupFallbackListeners();
            return;
        }
        
        this.setupMediaSession();
        this.setupEventListeners();
    }
    
    setupAudioElement() {
        // Используем существующий элемент или создаем новый
        this.audioElement = document.getElementById('bluetoothAudio');
        
        if (!this.audioElement) {
            this.audioElement = document.createElement('audio');
            this.audioElement.id = 'bluetoothAudio';
            this.audioElement.style.display = 'none';
            this.audioElement.loop = true;
            
            // Добавляем источник с тихим звуком
            const source = document.createElement('source');
            source.src = this.silentAudioUrl;
            source.type = 'audio/wav';
            this.audioElement.appendChild(source);
            
            document.body.appendChild(this.audioElement);
        }
        
        // Настраиваем аудио
        this.audioElement.volume = 0.01; // Почти беззвучно
        this.audioElement.preload = 'auto';
        
        // События аудио
        this.audioElement.addEventListener('play', () => {
            console.log('Bluetooth audio element started');
        });
        
        this.audioElement.addEventListener('pause', () => {
            console.log('Bluetooth audio element paused');
        });
    }
    
    setupMediaSession() {
        if (!this.isSupported) return;
        
        try {
            // Настройка метаданных трека с полной информацией
            navigator.mediaSession.metadata = new MediaMetadata({
                title: 'English Phrases Trainer',
                artist: 'Изучение английского языка',
                album: 'Фразы и предложения',
                artwork: [
                    { src: 'icon-96.png', sizes: '96x96', type: 'image/png' },
                    { src: 'icon-128.png', sizes: '128x128', type: 'image/png' },
                    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'icon-256.png', sizes: '256x256', type: 'image/png' },
                    { src: 'icon-384.png', sizes: '384x384', type: 'image/png' },
                    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
                ]
            });
            
            // ОЧЕНЬ ВАЖНО: Установка состояния воспроизведения
            navigator.mediaSession.playbackState = 'none';
            
            // Установка всех обработчиков с проверкой поддержки
            try {
                navigator.mediaSession.setActionHandler('play', () => {
                    console.log('Bluetooth Media Key: PLAY pressed');
                    this.handlePlay();
                });
            } catch (e) {
                console.log('Play action not supported:', e.message);
            }
            
            try {
                navigator.mediaSession.setActionHandler('pause', () => {
                    console.log('Bluetooth Media Key: PAUSE pressed');
                    this.handlePause();
                });
            } catch (e) {
                console.log('Pause action not supported:', e.message);
            }
            
            try {
                navigator.mediaSession.setActionHandler('previoustrack', () => {
                    console.log('Bluetooth Media Key: PREVIOUS pressed');
                    this.handlePreviousTrack();
                });
            } catch (e) {
                console.log('Previous track action not supported:', e.message);
            }
            
            try {
                navigator.mediaSession.setActionHandler('nexttrack', () => {
                    console.log('Bluetooth Media Key: NEXT pressed');
                    this.handleNextTrack();
                });
            } catch (e) {
                console.log('Next track action not supported:', e.message);
            }
            
            try {
                navigator.mediaSession.setActionHandler('stop', () => {
                    console.log('Bluetooth Media Key: STOP pressed');
                    this.handleStop();
                });
            } catch (e) {
                console.log('Stop action not supported:', e.message);
            }
            
            try {
                navigator.mediaSession.setActionHandler('seekbackward', (details) => {
                    console.log('Bluetooth Media Key: SEEK BACKWARD', details);
                    this.handleSeekBackward(details);
                });
            } catch (e) {
                console.log('Seek backward action not supported:', e.message);
            }
            
            try {
                navigator.mediaSession.setActionHandler('seekforward', (details) => {
                    console.log('Bluetooth Media Key: SEEK FORWARD', details);
                    this.handleSeekForward(details);
                });
            } catch (e) {
                console.log('Seek forward action not supported:', e.message);
            }
            
            console.log('Media Session configured for Bluetooth headphones');
            
        } catch (error) {
            console.error('Error setting up Media Session:', error);
        }
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
        console.log('Bluetooth Media Key: Play');
        this.isPlaying = true;
        
        // ВАЖНО: Запускаем аудио элемент для активации Bluetooth
        if (this.audioElement) {
            this.audioElement.play().catch(e => {
                console.log('Audio play error (expected):', e.message);
            });
        }
        
        // Обновление состояния Media Session
        navigator.mediaSession.playbackState = 'playing';
        
        // Запуск воспроизведения в основном приложении
        if (window.togglePlay && typeof window.togglePlay === 'function') {
            window.togglePlay();
        }
        
        this.updatePositionState();
    }
    
    handlePause() {
        console.log('Bluetooth Media Key: Pause');
        this.isPlaying = false;
        
        // Пауза аудио элемента
        if (this.audioElement) {
            this.audioElement.pause();
        }
        
        // Пауза в основном приложении
        if (window.togglePause && typeof window.togglePause === 'function') {
            window.togglePause();
        }
        
        navigator.mediaSession.playbackState = 'paused';
    }
    
    setupVisibilityHandlers() {
        // ВАЖНО: Браузеры блокируют аудио при скрытии вкладки
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('Page hidden, suspending audio');
                if (this.audioContextManager) {
                    this.audioContextManager.suspend();
                }
            } else {
                console.log('Page visible, resuming audio');
                if (this.audioContextManager && this.isPlaying) {
                    this.audioContextManager.resume();
                }
            }
        });
        
        // Обработка фокуса окна
        window.addEventListener('focus', () => {
            console.log('Window focused');
            this.activateAudio();
        });
        
        window.addEventListener('blur', () => {
            console.log('Window blurred');
        });
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
        console.log('Bluetooth Media Key: Stop');
        this.isPlaying = false;
        
        // Остановка аудио элемента
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
        }
        
        // Остановка воспроизведения
        if (window.stopPlayback && typeof window.stopPlayback === 'function') {
            window.stopPlayback();
        }
        
        navigator.mediaSession.playbackState = 'none';
    }

    // Fallback для браузеров без Media Session API
    setupFallbackListeners() {
        console.log('Setting up fallback listeners for Bluetooth');
        
        // Обработка клавиш медиа-управления
        document.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });
        
        // Обработка событий от аудио элемента
        if (this.audioElement) {
            this.audioElement.addEventListener('play', () => {
                console.log('Fallback: Audio play triggered');
                this.handlePlay();
            });
            
            this.audioElement.addEventListener('pause', () => {
                console.log('Fallback: Audio pause triggered');
                this.handlePause();
            });
        }
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
        // Безопасная проверка без вызова setActionHandler
        const checkSupport = () => {
            const support = {
                basic: {
                    mediaSession: 'mediaSession' in navigator,
                    audioContext: 'AudioContext' in window || 'webkitAudioContext' in window,
                    htmlAudio: 'HTMLAudioElement' in window
                },
                mediaSessionDetails: {}
            };
            
            if (support.basic.mediaSession) {
                const ms = navigator.mediaSession;
                support.mediaSessionDetails = {
                    metadata: 'metadata' in ms,
                    playbackState: 'playbackState' in ms,
                    setActionHandler: 'setActionHandler' in ms,
                    setPositionState: 'setPositionState' in ms
                };
                
                // Проверяем, какие действия доступны (без вызова)
                support.mediaSessionDetails.supportedActions = [];
                const testActions = ['play', 'pause', 'previoustrack', 'nexttrack', 'stop'];
                
                testActions.forEach(action => {
                    try {
                        // Безопасная проверка - пробуем установить null и сразу очистить
                        ms.setActionHandler(action, null);
                        ms.setActionHandler(action, null); // Очищаем
                        support.mediaSessionDetails.supportedActions.push(action);
                    } catch (e) {
                        // Действие не поддерживается
                    }
                });
            }
            
            return support;
        };
        
        try {
            return checkSupport();
        } catch (error) {
            return {
                error: error.message,
                basic: {
                    mediaSession: 'mediaSession' in navigator,
                    userAgent: navigator.userAgent.substring(0, 100)
                }
            };
        }
    }
}