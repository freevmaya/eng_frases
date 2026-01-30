class VRecognition {
	constructor(recognition) {
		this.isRecognize 	= false;
		this.recognition 	= recognition;
		this.waitTime 		= 0;
		this.timerId		= null;
		this.output			= '';
		this.success		= false;
		this.text  			= '';
        this.msg_timerId    = 0;
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
    }

    clearListeners() {
        this.recognition.onstart 	= null;
        this.recognition.onresult 	= null;
        this.recognition.onend 		= null;
        this.recognition.onerror 	= null;
    }

    setTimeout(callback, time) {
        if (this.msg_timerId) {
            clearTimeout(this.msg_timerId);
            this.msg_timerId = null;
        }

        this.msg_timerId = setTimeout(()=>{
            this.msg_timerId = null;
            callback();
        }, time);
    }

    playerMessage(text, showTimeSec = 0) {

        if (isEmpty(text)) {
            this.playerElem.addClass('blurred');
        } else {
            this.playerElem.removeClass('blurred');
            this.playerElem.html(text);

            if (playerControls && playerControls.state.visible)
                playerControls.hide();

            if (showTimeSec) {
                this.setTimeout(()=>{
                    this.playerMessage(null);
                }, showTimeSec * 1000);
            }
        }
    }


    onStart() {
        this.isRecognize = true;
        tracer.log('Запись начата');
        this.playerMessage('Слушаю...', this.waitTime);
    }

	stop() {
		if (this.isRecognize)
			this.recognition.stop();

        if (!this.currentError && isEmpty(this.output))
			this.playerMessage(null);
		this.text = '';
		this.output = '';
	}

    showResult() {

    	if (!this.success) {
	        if (this.output) {
	            if (compareStringsIgnoreCaseAndPunctuation(this.output, this.text)) {
	                $(window).trigger('success');
	                this.playerMessage('<span class="success">Отлично!</span>', 5);
	        		this.success = true;
	        		this.stop();
	            }
	            else {
	                $(window).trigger('fail');
	                this.playerMessage(`<span class="wrong">${this.output}</span>`, 5);
	            }
	        }
	    }
    }

    onResult(event) {
        
        this.output = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            this.output += transcript + ' ';
        }

        //tracer.log(this.output);
        this.showResult();
    }

    onEnd() {
        tracer.log('Запись остановлена');
        this.isRecognize = false;
        this.stop();
    }

    onError() {
        let errorMessage = 'Неопределенна';

        let list = [
            {
                msg: 'not-allowed',
                text: 'Доступ к микрофону запрещен. Разрешите доступ в настройках браузера.',
                level: 0
            },{
                msg: 'audio-capture',
                text: 'Не удалось получить доступ к микрофону.',
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
                    this.playerMessage(list[i].text, 3);
                    return;
                }
                else errorMessage = list[i].text;
                break;
            }
        }

        this.playerMessage(null);
        
        showAlert('Ошибка распознавания: ' + errorMessage);
        this.isRecognize = false;
        this.stop();
    }

	startRecognition(waitTime, phraseObj, phraseType) {
        
        if (this.isRecognize) {

        	if (this.text == phraseObj[phraseType])
        		return;

        	this.stop();
        	setTimeout((()=>{
        		this.startRecognition(waitTime, phraseObj, phraseType);
        	}).bind(this), 100);
        	return;
        } 

        this.text 						= phraseObj[phraseType];
        this.output 					= '';
        this.success					= false;
        this.waitTime 					= waitTime * 1.2;
        this.currentError               = null;
        this.recognition.continuous 	= true; 	// Продолжать слушать после паузы
        this.recognition.interimResults = true; 	// Показывать промежуточные результаты
        this.recognition.lang 			= LanguageMap[phraseObj.Language(phraseType)];

        try {
        	this.isRecognize = true;
        	this.recognition.start();
        } catch (e) {
        	console.error(e);
        }

        //this.timerId = setTimeout(this.stop.bind(this), this.waitTime);
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