// Утилитарная функция для быстрой проверки и запроса
const MicrophoneUtils = {
    // Основная функция проверки и запроса
    async checkAndRequestMicrophone(options = {}) {
        const manager = new MicrophoneManager();
        
        // Проверяем текущий статус
        const currentStatus = await manager.checkPermissions();
        
        // Если доступ уже разрешен
        if (currentStatus === 'granted') {
            const result = await manager.requestMicrophoneAccess(options);
            return {
                ...result,
                alreadyGranted: true
            };
        }
        
        // Если доступ запрещен
        if (currentStatus === 'denied') {
            return {
                success: false,
                permission: 'denied',
                message: 'Доступ к микрофону запрещен. Разрешите доступ в настройках браузера.',
                canAskAgain: false
            };
        }
        
        // Во всех остальных случаях запрашиваем доступ
        return await manager.requestMicrophoneAccess(options);
    },

    // Функция для отображения диалога с пользователем
    async showMicrophoneRequestDialog(options = {}) {
        return new Promise(async (resolve) => {
            const dialogOptions = {
                title: options.title || 'Доступ к микрофону',
                message: options.message || 'Для работы с голосовыми функциями необходим доступ к микрофону.',
                allowText: options.allowText || 'Разрешить',
                denyText: options.denyText || 'Запретить',
                showRemember: options.showRemember !== false
            };

            // Можно интегрировать с кастомным модальным окном
            // В этом примере используем встроенный confirm
            if (options.useNativeUI !== false) {
                const userResponse = confirm(dialogOptions.message + '\n\nНажмите ОК для разрешения доступа.');
                
                if (userResponse) {
                    const result = await this.checkAndRequestMicrophone(options);
                    resolve(result);
                } else {
                    resolve({
                        success: false,
                        permission: 'denied',
                        userDenied: true
                    });
                }
            } else {
                // Для кастомного UI возвращаем информацию для отображения
                resolve({
                    showCustomDialog: true,
                    dialogOptions: dialogOptions,
                    requestFunction: () => this.checkAndRequestMicrophone(options)
                });
            }
        });
    },

    // Проверка поддержки микрофона в браузере
    isMicrophoneSupported() {
        return !!(
            navigator.mediaDevices &&
            navigator.mediaDevices.getUserMedia &&
            (window.AudioContext || window.webkitAudioContext)
        );
    },

    // Получение списка доступных микрофонов
    async getAvailableMicrophones() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            return [];
        }

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices
                .filter(device => device.kind === 'audioinput')
                .map(device => ({
                    deviceId: device.deviceId,
                    label: device.label || `Микрофон ${device.deviceId.slice(0, 5)}`,
                    groupId: device.groupId
                }));
        } catch (error) {
            tracer.error('Ошибка получения списка микрофонов:', error);
            return [];
        }
    },

    // Проверка, был ли уже запрошен доступ ранее
    async getMicrophonePermissionState() {
        if (navigator.permissions && navigator.permissions.query) {
            try {
                const status = await navigator.permissions.query({ name: 'microphone' });
                return status.state;
            } catch (error) {
                // Если Permissions API не поддерживает 'microphone'
                return 'prompt';
            }
        }
        
        // Fallback для браузеров без Permissions API
        const manager = new MicrophoneManager();
        return await manager.checkPermissions();
    },

    // Инструкция по разблокировке микрофона (для пользователя)
    getUnlockInstructions() {
        const instructions = {
            chrome: `
                Чтобы разрешить доступ к микрофону в Chrome:
                1. Нажмите на иконку замка 🔒 слева от адреса сайта
                2. Найдите пункт "Микрофон"
                3. Выберите "Разрешить"
                4. Обновите страницу
            `,
            firefox: `
                В Firefox:
                1. Нажмите на иконку замка 🔒 в адресной строке
                2. Нажмите на стрелку рядом с "Разрешения"
                3. Для микрофона выберите "Разрешить"
                4. Перезагрузите страницу
            `,
            safari: `
                В Safari:
                1. Зайдите в Настройки → Сайты
                2. Выберите "Микрофон"
                3. Найдите этот сайт и установите "Разрешить"
                4. Перезагрузите страницу
            `,
            edge: `
                В Microsoft Edge:
                1. Нажмите на иконку замка 🔒 слева от адреса
                2. Нажмите "Разрешения для этого сайта"
                3. Для микрофона выберите "Разрешить"
                4. Обновите страницу
            `
        };
        
        return instructions;
    }
};

async function initializeMicrophone() {
    if (!MicrophoneUtils.isMicrophoneSupported()) {
        tracer.error('Микрофон не поддерживается в этом браузере');
        return;
    }

    const result = await MicrophoneUtils.checkAndRequestMicrophone({
        echoCancellation: true,
        noiseSuppression: true
    });

    if (result.success) {
        tracer.log('Микрофон доступен!', result.stream);
        // Начинаем работу с микрофоном
    } else {
        tracer.error('Не удалось получить доступ к микрофону:', result);
        
        if (result.permission === 'denied') {
            // Показываем инструкции пользователю
            const instructions = MicrophoneUtils.getUnlockInstructions();
            alert('Доступ к микрофону запрещен. ' + instructions.chrome);
        }
    }
}