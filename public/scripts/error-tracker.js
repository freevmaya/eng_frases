// Комбинированный подход
const ErrorTracker = {
    init(config) {
        // 1. Используем window.onerror как основной
        const originalOnerror = window.onerror;
        this.config = config;
        
        window.onerror = (msg, source, line, col, error) => {
            this.handleError({
                message: msg,
                source: source || 'inline-script',
                line: line,
                column: col || 0,
                error: error
            });
            
            // Вызываем оригинальный обработчик если был
            if (typeof originalOnerror === 'function') {
                return originalOnerror(msg, source, line, col, error);
            }
            
            return false; // Разрешаем стандартную обработку
        };
        
        // 2. Event listener как fallback
        window.addEventListener('error', (e) => {
            // Если событие уже обработано window.onerror, пропускаем
            if (e.defaultPrevented) return;
            
            this.handleError({
                message: e.message,
                source: e.filename || window.location.href,
                line: e.lineno,
                column: e.colno,
                error: e.error
            });
        }, true);

        window.addEventListener('load', () => {
            const resources = performance.getEntriesByType('resource');
            resources.forEach(res => {
                if (res.initiatorType === 'script' || res.initiatorType === 'css') {
                    if (res.duration > 10000) {
                        this.handleError({
                            message: 'resource_error',
                            source: res.name + ':' + res.transferSize,
                            error: 'Long loading time'
                        });
                    }
                }
            });
        });
    },
    
    handleError(details) {
        // Добавляем дополнительную информацию
        const errorInfo = {
            ...details,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            // Определяем тип скрипта
            scriptType: details.source === window.location.href ? 'inline' : 'external'
        };
        
        // Отправляем на сервер
        this.sendToServer(errorInfo);
    },

    sendToServer(data) {
        data.version = this.config.version;
        Ajax({
            action: 'addError',
            data: data
        });
    }
};