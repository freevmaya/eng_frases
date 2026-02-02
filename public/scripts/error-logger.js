class ErrorLogger {
    constructor(options = {}) {
        this.config = {
            endpoint: '/error.php',
            appId: 'web-app',
            userId: null,
            sessionId: this.generateSessionId(),
            logToConsole: true,
            sendToServer: true,
            ...options
        };
        
        this.init();
    }
    
    init() {

        this.originalError = console.error;
        this.originalWarn = console.warn;
        this.setupErrorHandlers();
        this.setupUnhandledRejection();
        this.setupConsoleOverrides();
        this.setupPerformanceMonitoring();

        if (this.config.userId)
            this.setUser(this.config.userId);
    }
    
    setupErrorHandlers() {
        // Ошибки JavaScript
        window.addEventListener('error', (e) => {
            tracer.log(e.filename);
            this.logError({
                type: 'js_error',
                message: e.message,
                filename: e.filename,
                lineno: e.lineno,
                colno: e.colno,
                stack: e.error?.stack,
                timestamp: Date.now()
            });
        });
        
        // Ошибки загрузки ресурсов
        window.addEventListener('load', () => {
            const resources = performance.getEntriesByType('resource');
            resources.forEach(res => {
                if (res.initiatorType === 'script' || res.initiatorType === 'css') {
                    if (res.duration > 5000 || res.transferSize === 0) {
                        this.logError({
                            type: 'resource_error',
                            name: res.name,
                            duration: res.duration,
                            size: res.transferSize
                        });
                    }
                }
            });
        });
    }
    
    setupUnhandledRejection() {
        window.addEventListener('unhandledrejection', (e) => {
            this.logError({
                type: 'promise_rejection',
                reason: e.reason?.message || String(e.reason),
                stack: e.reason?.stack,
                timestamp: Date.now()
            });
        });
    }
    
    setupConsoleOverrides() {
        
        console.error = (...args) => {
            this.logError({
                type: 'console_error',
                args: args.map(arg => String(arg)),
                timestamp: Date.now()
            });
            this.originalError.apply(console, args);
        };
        
        console.warn = (...args) => {
            this.logError({
                type: 'console_warning',
                args: args.map(arg => String(arg)),
                timestamp: Date.now()
            });
            this.originalWarn.apply(console, args);
        };
    }
    
    setupPerformanceMonitoring() {
        if (window.performance && performance.getEntriesByType) {
            const observer = new PerformanceObserver((list) => {
                list.getEntries().forEach(entry => {
                    if (entry.name.includes('error') || entry.duration > 1000) {
                        this.logError({
                            type: 'performance_error',
                            name: entry.name,
                            duration: entry.duration,
                            entryType: entry.entryType
                        });
                    }
                });
            });
            
            observer.observe({ entryTypes: ['longtask', 'paint', 'layout-shift'] });
        }
    }
    
    logError(errorData) {
        const logEntry = {
            ...errorData,
            appId: this.config.appId,
            userId: this.config.userId,
            sessionId: this.config.sessionId,
            url: window.location.href,
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            timestamp: Date.now()
        };
        
        // Лог в консоль
        if (this.config.logToConsole) {
            this.originalError(errorData);
        }
        
        // Отправка на сервер
        if (this.config.sendToServer) {
            this.sendToServer(logEntry);
        }
        
        // Сохранение в localStorage (fallback)
        //this.saveToLocalStorage(logEntry);
        
        return logEntry;
    }
    
    sendToServer(data) {
        // Используем sendBeacon для надежной отправки
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        
        if (navigator.sendBeacon) {
            navigator.sendBeacon(this.config.endpoint, blob);
        } else {
            // Fallback: fetch с keepalive
            fetch(this.config.endpoint, {
                method: 'POST',
                body: JSON.stringify(data),
                keepalive: true,
                headers: { 'Content-Type': 'application/json' }
            }).catch(() => {
                // Сохраняем для повторной отправки
                this.queueForRetry(data);
            });
        }
    }
    
    saveToLocalStorage(data) {
        try {
            const logs = JSON.parse(localStorage.getItem('error_logs') || '[]');
            logs.push(data);
            if (logs.length > 100) logs.shift(); // Лимит
            localStorage.setItem('error_logs', JSON.stringify(logs));
        } catch (e) {
            console.warn('Cannot save to localStorage:', e);
        }
    }
    
    queueForRetry(data) {
        const queue = JSON.parse(sessionStorage.getItem('error_queue') || '[]');
        queue.push(data);
        sessionStorage.setItem('error_queue', JSON.stringify(queue));
        
        // Пробуем отправить при следующей загрузке
        window.addEventListener('load', () => this.retryFailedLogs());
    }
    
    retryFailedLogs() {
        const queue = JSON.parse(sessionStorage.getItem('error_queue') || '[]');
        if (queue.length > 0) {
            queue.forEach(data => this.sendToServer(data));
            sessionStorage.removeItem('error_queue');
        }
    }
    
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    // Публичные методы
    setUser(id) {
        this.config.userId = id;
    }
    
    logCustom(type, data) {
        return this.logError({
            type: `custom_${type}`,
            ...data,
            timestamp: Date.now()
        });
    }
    
    getLogs() {
        try {
            return JSON.parse(localStorage.getItem('error_logs') || '[]');
        } catch {
            return [];
        }
    }
    
    clearLogs() {
        localStorage.removeItem('error_logs');
    }
}

/*
// Использование
const logger = new ErrorLogger({
    endpoint: 'error.php',
    appId: 'my-web-app'
});

// Установка пользователя
logger.setUser('user_123');

// Кастомное логирование
logger.logCustom('payment_error', { amount: 100, reason: 'insufficient_funds' });
*/