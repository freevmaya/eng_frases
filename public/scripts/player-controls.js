// Класс для управления элементами управления плеером
class PlayerControls {
    constructor(options = {}) {
        this.options = {
            autoHideDelay: 5000, // 5 секунд
            showAnimationDuration: 300,
            ...options
        };
        
        this.elements = {
            parent: null,
            container: null,
            playButton: null,
            prevBtn: null,
            nextBtn: null,
            playIcon: null
        };
        
        this.state = {
            visible: false,
            autoHideTimeout: null,
            isPlaying: false,
            controlsEnabled: true
        };
        
        this.init();
    }
    
    // Инициализация
    init() {
        this.elements.container = $('#playButtonsContainer');
        this.elements.playButton = $('#playButton');
        this.elements.prevBtn = $('#prevBtn');
        this.elements.nextBtn = $('#nextBtn');
        this.elements.playIcon = $('#playButton i');
        this.elements.parent = this.elements.container.closest(".card");

        this.elements.container.css('pointer-events', 'none');
        
        this.setupEventListeners();
        this.show(true); // Начальное состояние - скрыто
    }
    
    // Настройка обработчиков событий
    setupEventListeners() {
        const self = this;
        
        // Показ контролов по клику на контейнер
        this.elements.parent.click(function(e) {
            if (!isAnyInputElement(e.target) && self.state.controlsEnabled && !self.state.visible) {
                e.stopPropagation();
                self.show();
                self.resetAutoHide();
            }
        });

        $('body').click((e) => {
            if (this.state.visible && !$(e.target).is(self.elements.container))
                self.hide();
        });
        
        // Обработчики для кнопок
        this.elements.playButton.click(function(e) {
            e.stopPropagation();
            if (self.state.controlsEnabled) {
                self.resetAutoHide();
            }
        });
        
        this.elements.prevBtn.click(function(e) {
            e.stopPropagation();
            if (self.state.controlsEnabled) {
                self.resetAutoHide();
            }
        });
        
        this.elements.nextBtn.click(function(e) {
            e.stopPropagation();
            if (self.state.controlsEnabled) {
                self.resetAutoHide();
            }
        });
        
        // Предотвращаем скрытие при наведении на контролы
        this.elements.container.hover(
            function() {
                if (self.state.autoHideTimeout) {
                    clearTimeout(self.state.autoHideTimeout);
                }
            },
            function() {
                if (self.state.visible) {
                    self.resetAutoHide();
                }
            }
        );
    }
    
    // Показать контролы
    show(noAutoHide=false) {
        if (this.state.visible || !this.state.controlsEnabled) return;
        
        clearTimeout(this.state.autoHideTimeout);
        this.state.visible = true;
        this.elements.container
            .addClass('show controls-active')
            .css('pointer-events', 'auto');
        if (!noAutoHide)
            this.resetAutoHide();
    }
    
    // Скрыть контролы
    hide() {
        if (!this.state.visible) return;
        
        clearTimeout(this.state.autoHideTimeout);
        
        this.state.visible = false;
        this.elements.container
            .removeClass('controls-active show')
            .css('pointer-events', 'none')
    }
    
    // Сброс таймера автоскрытия
    resetAutoHide() {
        clearTimeout(this.state.autoHideTimeout);
        
        this.state.autoHideTimeout = setTimeout(() => {
            this.hide();
        }, this.options.autoHideDelay);
    }
    
    // Обновить состояние кнопки воспроизведения
    updatePlayButton(isPlaying) {
        this.state.isPlaying = isPlaying;
        
        if (isPlaying) {
            this.elements.playIcon
                .removeClass('bi-play-fill')
                .addClass('bi-pause-fill');
        } else {
            this.elements.playIcon
                .removeClass('bi-pause-fill')
                .addClass('bi-play-fill');
        }
    }
    
    // Включить/выключить контролы
    setEnabled(enabled) {
        this.state.controlsEnabled = enabled;
        
        if (enabled) {
            this.elements.container.removeClass('disabled');
            this.elements.playButton.prop('disabled', false);
            this.elements.prevBtn.prop('disabled', false);
            this.elements.nextBtn.prop('disabled', false);
        } else {
            this.elements.container.addClass('disabled');
            this.elements.playButton.prop('disabled', true);
            this.elements.prevBtn.prop('disabled', true);
            this.elements.nextBtn.prop('disabled', true);
        }
    }
    
    // Обновить состояние кнопок навигации
    updateNavigationButtons(hasPrev, hasNext) {
        this.elements.prevBtn.prop('disabled', !hasPrev);
        this.elements.nextBtn.prop('disabled', !hasNext);
        
        if (!hasPrev) {
            this.elements.prevBtn.css('opacity', 0.5);
        } else {
            this.elements.prevBtn.css('opacity', 1);
        }
        
        if (!hasNext) {
            this.elements.nextBtn.css('opacity', 0.5);
        } else {
            this.elements.nextBtn.css('opacity', 1);
        }
    }
    
    // Получить текущее состояние
    getState() {
        return {
            visible: this.state.visible,
            isPlaying: this.state.isPlaying,
            enabled: this.state.controlsEnabled
        };
    }
}