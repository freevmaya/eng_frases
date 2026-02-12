const MicrophoneUtils = {
    async checkAndRequestMicrophone(options = {}) {
        const manager = new MicrophoneManager();
        
        const currentStatus = await manager.checkPermissions();
        
        if (currentStatus === 'granted') {
            const result = await manager.requestMicrophoneAccess(options);
            return {
                ...result,
                alreadyGranted: true
            };
        }
        
        if (currentStatus === 'denied') {
            return {
                success: false,
                permission: 'denied',
                message: Lang("microphone_access_denied_allow_in_settings"),
                canAskAgain: false
            };
        }
        
        return await manager.requestMicrophoneAccess(options);
    },

    async showMicrophoneRequestDialog(options = {}) {
        return new Promise(async (resolve) => {
            const dialogOptions = {
                title: options.title || Lang("microphone_access"),
                message: options.message || Lang("voice_functions_need_microphone"),
                allowText: options.allowText || Lang("allow"),
                denyText: options.denyText || Lang("deny"),
                showRemember: options.showRemember !== false
            };

            if (options.useNativeUI !== false) {
                const userResponse = confirm(dialogOptions.message + '\n\n' + Lang("press_ok_to_allow"));
                
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
                resolve({
                    showCustomDialog: true,
                    dialogOptions: dialogOptions,
                    requestFunction: () => this.checkAndRequestMicrophone(options)
                });
            }
        });
    },

    isMicrophoneSupported() {
        return !!(
            navigator.mediaDevices &&
            navigator.mediaDevices.getUserMedia &&
            (window.AudioContext || window.webkitAudioContext)
        );
    },

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
                    label: device.label || Lang("microphone_with_id").replace('%1', device.deviceId.slice(0, 5)),
                    groupId: device.groupId
                }));
        } catch (error) {
            tracer.error(Lang("error_getting_microphone_list"), error);
            return [];
        }
    },

    async getMicrophonePermissionState() {
        if (navigator.permissions && navigator.permissions.query) {
            try {
                const status = await navigator.permissions.query({ name: 'microphone' });
                return status.state;
            } catch (error) {
                return 'prompt';
            }
        }
        
        const manager = new MicrophoneManager();
        return await manager.checkPermissions();
    },

    getUnlockInstructions() {
        const instructions = {
            chrome: Lang("chrome_microphone_instructions"),
            firefox: Lang("firefox_microphone_instructions"),
            safari: Lang("safari_microphone_instructions"),
            edge: Lang("edge_microphone_instructions")
        };
        
        return instructions;
    }
};

async function initializeMicrophone() {
    if (!MicrophoneUtils.isMicrophoneSupported()) {
        tracer.error(Lang("microphone_not_supported_in_browser"));
        return;
    }

    const result = await MicrophoneUtils.checkAndRequestMicrophone({
        echoCancellation: true,
        noiseSuppression: true
    });

    if (result.success) {
        tracer.log(Lang("microphone_available"), result.stream);
    } else {
        tracer.error(Lang("failed_to_get_microphone_access"), result);
        
        if (result.permission === 'denied') {
            const instructions = MicrophoneUtils.getUnlockInstructions();
            alert(Lang("microphone_access_denied") + ' ' + instructions.chrome);
        }
    }
}