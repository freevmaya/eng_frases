// Комбинированный подход
const ErrorTracker = {
    init(config) {
        // 1. Используем window.onerror как основной
        const originalOnerror = window.onerror;
        this.config = config;
        
        // Инициализируем список исключаемых доменов
        this.excludeDomains = config.excludeDomains || [];
        
        /*
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
        };*/
        
        // 2. Event listener как fallback
        window.addEventListener('error', (event) => {
            // Если событие уже обработано window.onerror, пропускаем
            if (event.defaultPrevented) return;
            
            // Проверяем, является ли ошибка ошибкой загрузки ресурса
            const target = event.target;
            if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK' || 
                target.tagName === 'IMG' || target.tagName === 'VIDEO' || target.tagName === 'AUDIO')) {
                
                // Это ошибка загрузки ресурса
                this.handleResourceLoadError(target);
                return;
            }
            
            // Обработка обычных JavaScript ошибок
            this.handleError({
                type: 'js_error',
                message: event.message,
                source: event.filename,
                line: event.lineno,
                column: event.colno,
                error: event.error
            });
        }, true);

        // Обработчик для отслеживания ошибок загрузки ресурсов через performance API
        window.addEventListener('load', () => {
            const resources = performance.getEntriesByType('resource');
            
            resources.forEach(res => {
                // Проверяем, не является ли ресурс из исключаемого домена
                if (this.isExcludedDomain(res.name)) {
                    return; // Пропускаем ресурсы из исключаемых доменов
                }
                
                // Отслеживаем длительную загрузку ресурсов
                if (res.duration > 10000) {
                    this.handleError({
                        type: 'slow_resource',
                        message: 'Slow resource loading',
                        source: res.name,
                        duration: res.duration,
                        initiatorType: res.initiatorType,
                        size: res.transferSize,
                        error: `Resource took ${Math.round(res.duration)}ms to load`
                    });
                }
            });
            
            // Проверяем неудачные загрузки через PerformanceObserver
            this.setupResourceLoadObserver();
        });

        // Отслеживание ошибок для динамически загружаемых ресурсов
        this.setupMutationObserver();

        this.prepareList = [];
        this.sendTimerId = 0;
    },

    pushPrepareList(data) {

        let found = this.prepareList.find(item => (item.message === data.message) && (item.source === data.source));
        if (found) {
            if (!found.count) found.count = 0;
            found.count++;
        } else this.prepareList.push(data);
    },

    sendToServer(data) {
        data.version = this.config.version;
        // Добавляем идентификатор сессии для группировки ошибок
        if (!data.sessionId) {
            data.sessionId = this.getSessionId();
        }
        
        // Добавляем информацию об исключаемых доменах для отладки
        data.excludeDomainsInfo = {
            configured: this.excludeDomains.length > 0,
            excluded: this.isExcludedDomain(data.source)
        };

        this.pushPrepareList(data);

        if (this.sendTimerId)
            clearTimeout(this.sendTimerId);

        this.sendTimerId = setTimeout(()=>{
        
            this.sendPrepareList();

            this.prepareList = [];
            this.sendTimerId = 0;

        }, 500 + (500 * (this.prepareList.length - 1)));
    },

    async sendPrepareList() {
        let tmp = [...this.prepareList];
        tmp.forEach(async (itm)=>{
            if (itm.count)
                itm.message = `${itm.message} (${itm.count})`;

            await Ajax({
                action: 'addError',
                data: itm
            });
        });
    },
    
    // Проверяет, находится ли URL в списке исключаемых доменов
    isExcludedDomain(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }
        url = url.toLowerCase();
        
        try {
            
            for (const domain of this.excludeDomains) {
                if (url.includes(domain.toLowerCase()) !== false)
                    return true;
            }
            
            return false;
        } catch (e) {
            // Если URL некорректный, не исключаем его
            console.debug('Error parsing URL for domain check:', url, e);
            return false;
        }
    },
    
    handleResourceLoadError(element) {
        const resourceType = element.tagName.toLowerCase();
        const resourceUrl = element.src || element.href;
        
        // Проверяем, не является ли ресурс из исключаемого домена
        if (this.isExcludedDomain(resourceUrl)) {
            console.debug(`Skipping error for excluded domain: ${resourceUrl}`);
            return; // Не отправляем ошибку для ресурсов из исключаемых доменов
        }
        
        const errorDetails = {
            type: 'resource_load_error',
            resourceType: resourceType,
            message: `Failed to load ${resourceType}: ${resourceUrl}`,
            source: resourceUrl,
            tagName: element.tagName,
            attributes: this.getElementAttributes(element),
            url: window.location.href,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        };

        // Добавляем дополнительную информацию в зависимости от типа ресурса
        switch(resourceType) {
            case 'script':
                errorDetails.errorType = 'script_load_failure';
                break;
            case 'link':
                const rel = element.getAttribute('rel');
                errorDetails.errorType = rel === 'stylesheet' ? 'css_load_failure' : 'link_load_failure';
                break;
            case 'img':
                errorDetails.errorType = 'image_load_failure';
                break;
            case 'video':
            case 'audio':
                errorDetails.errorType = 'media_load_failure';
                break;
        }

        this.sendToServer(errorDetails);
    },
    
    getElementAttributes(element) {
        const attributes = {};
        for (let attr of element.attributes) {
            // Не включаем слишком длинные атрибуты (например, data-* с большими значениями)
            if (attr.value && attr.value.length < 1000) {
                attributes[attr.name] = attr.value;
            } else if (attr.value) {
                attributes[attr.name] = attr.value.substring(0, 100) + '... [truncated]';
            }
        }
        return attributes;
    },
    
    setupResourceLoadObserver() {
        if ('PerformanceObserver' in window) {
            try {
                const resourceObserver = new PerformanceObserver((list) => {
                    list.getEntries().forEach((entry) => {
                        // entryType может быть 'resource', 'navigation' и т.д.
                        if (entry.entryType === 'resource') {
                            
                            // Проверяем, была ли ошибка загрузки
                            // В некоторых браузерах можно определить неудачные загрузки
                            // по transferSize = 0 и duration > 0
                            if (entry.transferSize === 0 && entry.duration > 0 && 
                                !entry.name.includes(window.location.origin)) {

                                // Если это запрос к /collect и transferSize=0, считаем это нормой
                                if (entry.name.includes('/collect')) {
                                    return;
                                }

                                // Такие запросы часто имеют нулевой размер ответа
                                if (entry.initiatorType === 'beacon') {
                                    return;
                                }

                                if (this.isExcludedDomain(entry.name)) {
                                    return; // Пропускаем ресурсы из исключаемых доменов
                                }

                                this.handleError({
                                    type: 'resource_failed',
                                    message: 'Resource load may have failed',
                                    source: entry.name,
                                    initiatorType: entry.initiatorType,
                                    duration: entry.duration,
                                    transferSize: entry.transferSize,
                                    nextHopProtocol: entry.nextHopProtocol,
                                    timestamp: new Date().toISOString()
                                });
                            }
                        }
                    });
                });
                
                // Наблюдаем за загрузкой ресурсов
                resourceObserver.observe({ entryTypes: ['resource'] });
                this.resourceObserver = resourceObserver;
            } catch (e) {
                console.warn('PerformanceObserver not supported:', e);
            }
        }
    },
    
    setupMutationObserver() {
        // Отслеживаем динамически добавленные элементы
        const mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Проверяем элементы, которые могут загружать ресурсы
                            const tagsToWatch = ['SCRIPT', 'LINK', 'IMG', 'VIDEO', 'AUDIO'];
                            if (tagsToWatch.includes(node.tagName)) {
                                this.attachResourceErrorHandler(node);
                            }
                            
                            // Рекурсивно проверяем дочерние элементы
                            if (node.querySelectorAll) {
                                tagsToWatch.forEach(tag => {
                                    const elements = node.querySelectorAll(tag);
                                    elements.forEach(el => this.attachResourceErrorHandler(el));
                                });
                            }
                        }
                    });
                }
            });
        });
        
        mutationObserver.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
        
        this.mutationObserver = mutationObserver;
    },
    
    attachResourceErrorHandler(element) {
        // Проверяем, не является ли элемент уже из исключаемого домена
        const resourceUrl = element.src || element.href;
        if (resourceUrl && this.isExcludedDomain(resourceUrl)) {
            return; // Не добавляем обработчик для исключаемых доменов
        }
        
        // Добавляем обработчики ошибок для элементов
        element.addEventListener('error', (event) => {
            this.handleResourceLoadError(element);
        }, { once: true }); // Используем once чтобы избежать дублирования
    },
    
    handleError(details) {
        // Проверяем, не является ли источник ошибки из исключаемого домена
        if (details.source && this.isExcludedDomain(details.source)) {
            console.debug(`Skipping error for excluded domain: ${details.source}`);
            return;
        }
        
        // Добавляем дополнительную информацию
        const errorInfo = {
            ...details,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            // Определяем тип скрипта
            scriptType: details.source === window.location.href ? 'inline' : 'external'
        };

        if (typeof YANDEX_METRIKA_ID != 'undefined')
            ym(YANDEX_METRIKA_ID, 'reachGoal', 'js_error');

        // Отправляем на сервер
        this.sendToServer(errorInfo);
    },
    
    getSessionId() {
        // Генерируем или получаем идентификатор сессии
        if (!this.sessionId) {
            this.sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('errorTrackerSessionId', this.sessionId);
        }
        return this.sessionId;
    },
    
    // Метод для очистки наблюдателей при необходимости
    destroy() {
        if (this.resourceObserver) {
            this.resourceObserver.disconnect();
        }
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
    }
};

if (typeof DEV != 'undefined') {
    var tracer = {
        log(...arguments) {
            console.log(...arguments);
        },
        error(...arguments) {
            console.error(...arguments);
        }
    }
} else {
    var tracer = {log(...arguments) {},error(...arguments) {
        ErrorTracker.handleError({
            message: JSON.stringify(arguments),
            source: 'inline-script'
        });
    }}
}