const ErrorTracker = {
    init(config) {
        const originalOnerror = window.onerror;
        this.config = config;
        this.excludeDomains = config.excludeDomains || [];
        
        window.addEventListener('error', (event) => {
            if (event.defaultPrevented) return;
            
            const target = event.target;
            if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK' || 
                target.tagName === 'IMG' || target.tagName === 'VIDEO' || target.tagName === 'AUDIO')) {
                
                this.handleResourceLoadError(target);
                return;
            }
            
            this.handleError({
                type: 'js_error',
                message: event.message,
                source: event.filename,
                line: event.lineno,
                column: event.colno,
                error: event.error
            });
        }, true);

        window.addEventListener('load', () => {
            const resources = performance.getEntriesByType('resource');
            
            resources.forEach(res => {
                if (this.isExcludedDomain(res.name)) {
                    return;
                }
                
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
            
            this.setupResourceLoadObserver();
        });

        this.setupMutationObserver();
    },
    
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
            console.debug('Error parsing URL for domain check:', url, e);
            return false;
        }
    },
    
    handleResourceLoadError(element) {
        const resourceType = element.tagName.toLowerCase();
        const resourceUrl = element.src || element.href;
        
        if (this.isExcludedDomain(resourceUrl)) {
            console.debug(`Skipping error for excluded domain: ${resourceUrl}`);
            return;
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
                        if (entry.entryType === 'resource') {
                            if (entry.transferSize === 0 && entry.duration > 0 && 
                                !entry.name.includes(window.location.origin)) {

                                if (this.isExcludedDomain(entry.name)) {
                                    return;
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
                
                resourceObserver.observe({ entryTypes: ['resource'] });
                this.resourceObserver = resourceObserver;
            } catch (e) {
                console.warn('PerformanceObserver not supported:', e);
            }
        }
    },
    
    setupMutationObserver() {
        const mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const tagsToWatch = ['SCRIPT', 'LINK', 'IMG', 'VIDEO', 'AUDIO'];
                            if (tagsToWatch.includes(node.tagName)) {
                                this.attachResourceErrorHandler(node);
                            }
                            
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
        const resourceUrl = element.src || element.href;
        if (resourceUrl && this.isExcludedDomain(resourceUrl)) {
            return;
        }
        
        element.addEventListener('error', (event) => {
            this.handleResourceLoadError(element);
        }, { once: true });
    },
    
    handleError(details) {
        if (details.source && this.isExcludedDomain(details.source)) {
            console.debug(`Skipping error for excluded domain: ${details.source}`);
            return;
        }
        
        const errorInfo = {
            ...details,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            scriptType: details.source === window.location.href ? 'inline' : 'external'
        };

        this.sendToServer(errorInfo);
    },

    sendToServer(data) {
        data.version = this.config.version;
        if (!data.sessionId) {
            data.sessionId = this.getSessionId();
        }
        
        data.excludeDomainsInfo = {
            configured: this.excludeDomains.length > 0,
            excluded: this.isExcludedDomain(data.source)
        };
        
        Ajax({
            action: 'addError',
            data: data
        });
    },
    
    getSessionId() {
        if (!this.sessionId) {
            this.sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('errorTrackerSessionId', this.sessionId);
        }
        return this.sessionId;
    },
    
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
    var tracer = {log(...arguments) {},error(...arguments) {}}
}