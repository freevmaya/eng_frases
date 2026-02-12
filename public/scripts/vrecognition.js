class VRecognition {
    constructor(recognition) {
        this.isRecognize    = false;
        this.recognition    = recognition;
        this.language       = 'en';
        this.output         = '';
        this.success        = false;
        this.text           = '';
        this.playerElem     = $('#payerMessage');
        this.currentError   = null;
        this.setListeners();
    }

    onError(callback) {
        this.recognition.onerror = callback;
    }

    setListeners() {

        this.recognition.onstart    = this.onStart.bind(this);
        this.recognition.onresult   = this.onResult.bind(this);
        this.recognition.onend      = this.onEnd.bind(this);
        this.recognition.onerror    = this.onError.bind(this);

        if (typeof DEV != 'undefined') {
            this.playerElem.click(()=>{
                if (this.isRecognize) {
                    this.output = this.text;
                    this.showResult();
                }
            });
        }
    }

    clearListeners() {
        this.recognition.onstart    = null;
        this.recognition.onresult   = null;
        this.recognition.onend      = null;
        this.recognition.onerror    = null;
    }

    playerMessage(text) {
        this.playerElem.html(text);

        if (!isEmpty(text) && 
            playerControls && 
            playerControls.state.visible)
            playerControls.hide();
    }

    onStart() {
        this.isRecognize = true;
        tracer.log(Lang("recording_started_for").replace('%1', this.text));
        this.playerMessage(Lang("speak_in_language").replace('%1', LanguageNames[this.language]));
    }

    Stop() {
        if (this.isRecognize)
            this.recognition.stop();
        setTimeout(()=>{
            this.playerElem.toggleClass('blurred', true);
        }, 1000);
    }

    SummingUp() {

        if (this.isRecognize)
            this.recognition.stop();

        if (isEmpty(this.output)) {
            if (!this.currentError)
                this.playerMessage(Lang("no_speech_detected"));
        } else {
            let result = assessPhrase(this.text, this.output);
            $(window).trigger(result.class);
            this.playerMessage(`<span class="${result.class}">${result.text}</span>`);
        }
    }

    showResult() {
        if (!this.success && this.output) {
            let result = assessPhrase(this.text, this.output);
            this.playerMessage(`<span class="${result.class}">${this.output}</span>`);
        }
    }

    onResult(event) {
        
        this.output = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            this.output += transcript + ' ';
        }
        this.showResult();
    }

    onEnd() {
        tracer.log(Lang("recording_stopped"));
        this.isRecognize = false;
    }

    onError() {
        let errorMessage = Lang("undefined_error");

        let list = [
            {
                msg: 'service-not-allowed',
                text: Lang("speech_recognition_not_allowed_check_permissions"),
                level: 0
            },{
                msg: 'not-allowed',
                text: Lang("microphone_or_recognition_not_allowed"),
                level: 0
            },{
                msg: 'audio-capture',
                text: Lang("failed_to_access_microphone_check_permissions"),
                level: 0
            },{
                msg: 'network',
                text: Lang("network_issues"),
                level: 0
            },{
                msg: 'no-speech',
                text: Lang("no_speech_detected"),
                level: 1
            },{
                msg: 'aborted',
                text: Lang("skipped"),
                level: 1
            }

        ];

        let eventError = event.error;
        this.isRecognize = false;

        for (var i = list.length - 1; i >= 0; i--) {
            if (eventError.includes(list[i].msg)) {

                this.currentError = list[i];

                if (list[i].level > 0) {
                    this.playerMessage(list[i].text);
                    return;
                }
                else errorMessage = list[i].text;
                break;
            }
        }

        this.playerMessage(null);
        
        showAlert(Lang("recognition_error").replace('%1', errorMessage));
        this.Stop();
    }

    startRecognition(phraseObj, phraseType) {
        let langIndex                   = phraseType == 'target' ? 0 : 1;
        let langs                       = phraseObj.direction.split('-');
        this.text                       = phraseObj[phraseType];
        this.language                   = langs[langIndex];
        this.output                     = '';
        this.success                    = false;
        this.currentError               = null;
        this.recognition.continuous     = true;
        this.recognition.interimResults = true;
        this.recognition.lang           = LanguageMap[phraseObj.Language(phraseType)];
        this.playerElem.toggleClass('blurred', isEmpty(this.text));

        try {
            if (!this.isRecognize) 
                this.recognition.start();
        } catch (e) {
            tracer.error(e);
        }
    }
}

function compareStringsIgnoreCaseAndPunctuation(str1, str2) {
    const cleanStr1 = normalizeString(str1);
    const cleanStr2 = normalizeString(str2);
    
    return cleanStr1 === cleanStr2;
}

function normalizeString(str) {
    if (typeof str !== 'string') return '';
    
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}