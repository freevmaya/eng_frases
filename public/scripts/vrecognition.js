class VRecognition {
	constructor(recognition) {
		this.isRecognize 	= false;
		this.recognition 	= recognition;
		this.output			= '';
		this.success		= false;
		this.text  			= '';
        this.playerElem     = $('#payerMessage');
        this.currentError   = null;
		this.setListeners();
	}

	onError(callback) {
		this.recognition.onerror = callback;
	}

    setListeners() {

        // События распознавания
        this.recognition.onstart 	= this.onStart.bind(this);
        this.recognition.onresult 	= this.onResult.bind(this);
        this.recognition.onend 		= this.onEnd.bind(this);
        this.recognition.onerror 	= this.onError.bind(this);

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
        this.recognition.onstart 	= null;
        this.recognition.onresult 	= null;
        this.recognition.onend 		= null;
        this.recognition.onerror 	= null;
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
        tracer.log(`Запись начата "${this.text}"`);
        this.playerMessage('Слушаю...');
    }

    Stop() {
        if (this.isRecognize)
            this.recognition.stop();
        setTimeout(()=>{
            this.playerElem.toggleClass('blurred', true);
        }, 1000);
    }

	SummingUp(result = null) {
		if (this.isRecognize)
			this.recognition.stop();

        if (isEmpty(this.output)) {
            if (!this.currentError)
                this.playerMessage('Речь не обнаружена!');
        } else {
            if (!result)
                result = assessPhrase(this.text, this.output);

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
        tracer.log('Запись остановлена');
        this.isRecognize = false;
    }

    onError() {
        let errorMessage = 'Неопределенна';

        let list = [
            {
                msg: 'service-not-allowed',
                text: 'Распознавание речи не разрешено. Проверьте разрешения в настройках браузера.',
                level: 0
            },{
                msg: 'not-allowed',
                text: 'Доступ к микрофону и/или распознаванию речи не разрешен. Проверьте разрешения в настройках браузера.',
                level: 0
            },{
                msg: 'audio-capture',
                text: 'Не удалось получить доступ к микрофону. Проверьте разрешения в настройках браузера.',
                level: 0
            },{
                msg: 'network',
                text: 'Проблемы с сетью.',
                level: 0
            },{
                msg: 'no-speech',
                text: 'Речь не обнаружена!',
                level: 1
            },{
                msg: 'aborted',
                text: 'Пропущено...',
                level: 1
            }

        ];

        let eventError = event.error;

        for (var i = list.length - 1; i >= 0; i--) {
            if (eventError.includes(list[i].msg)) {

                this.currentError = list[i];

                if (list[i].level > 0) {
                    this.isRecognize = false;
                    this.playerMessage(list[i].text);
                    return;
                }
                else errorMessage = list[i].text;
                break;
            }
        }

        this.playerMessage(null);
        
        showAlert('Ошибка распознавания: ' + errorMessage);
        this.Stop();
    }

	startRecognition(phraseObj, phraseType) {

        this.text 						= phraseObj[phraseType];
        this.output 					= '';
        this.success					= false;
        this.currentError               = null;
        this.recognition.continuous 	= true; 	// Продолжать слушать после паузы
        this.recognition.interimResults = true; 	// Показывать промежуточные результаты
        this.recognition.lang 			= LanguageMap[phraseObj.Language(phraseType)];
        this.playerElem.toggleClass('blurred', isEmpty(this.text));

        try {
        	this.recognition.start();
        } catch (e) {
        	tracer.error(e);
        }
    }
}

function compareStringsIgnoreCaseAndPunctuation(str1, str2) {
    // Очищаем строки от знаков препинания и лишних пробелов
    const cleanStr1 = normalizeString(str1);
    const cleanStr2 = normalizeString(str2);
    
    // Сравниваем без учета регистра
    return cleanStr1 === cleanStr2;
}

function normalizeString(str) {
    if (typeof str !== 'string') return '';
    
    return str
        .toLowerCase()                    // К нижнему регистру
        .normalize('NFD')                 // Разделяем символы и диакритические знаки
        .replace(/[\u0300-\u036f]/g, '')  // Удаляем диакритические знаки (акценты)
        .replace(/[^\w\s]/g, '')          // Удаляем все знаки препинания
        .replace(/\s+/g, ' ')             // Заменяем множественные пробелы одним
        .trim();                          // Убираем пробелы по краям
}