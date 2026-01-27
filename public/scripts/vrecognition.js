class VRecognition {
	constructor(recognition) {
		this.isRecognize 	= false;
		this.recognition 	= recognition;
		this.waitTime 		= 0;
		this.timerId		= null;
		this.output			= '';
		this.success		= false;
		this.text  			= '';
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


    onStart() {
        this.isRecognize = true;
        console.log('Запись начата');
        playerMessage('Слушаю...', this.waitTime);
    }

	stop() {
		if (this.isRecognize)
			this.recognition.stop();

        if (this.timerId) {
        	clearTimeout(this.timerId);
        	this.timerId = null;
        }

        if (isEmpty(this.output))
			playerMessage('');
		this.text = '';
		this.output = '';
	}

    showResult() {

    	if (!this.success) {
	        if (this.output) {
	            if (compareStringsIgnoreCaseAndPunctuation(this.output, this.text)) {
	                $(window).trigger('success');
	                playerMessage('<span class="success">Отлично!</span>', 5);
	        		this.success = true;
	        		this.stop();
	            }
	            else {
	                $(window).trigger('fail');
	                playerMessage(`<span class="wrong">${this.output}</span>`, 5);
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

        //console.log(this.output);
        this.showResult();
    }

    onEnd() {
        console.log('Запись остановлена');
        this.isRecognize = false;
        this.stop();
    }

    onError() {
        let errorMessage = 'Ошибка распознавания: ';
        
        switch(event.error) {
            case 'not-allowed':
                errorMessage += 'Доступ к микрофону запрещен. Разрешите доступ в настройках браузера.';
                break;
            case 'no-speech':
                errorMessage += 'Речь не обнаружена. Проверьте микрофон.';
                break;
            case 'audio-capture':
                errorMessage += 'Не удалось получить доступ к микрофону.';
                break;
            case 'network':
                errorMessage += 'Проблемы с сетью.';
                break;
            default:
                errorMessage += event.error;
        }
        playerMessage('');
        
        showAlert(errorMessage);
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
        this.recognition.continuous 	= true; 	// Продолжать слушать после паузы
        this.recognition.interimResults = true; 	// Показывать промежуточные результаты
        this.recognition.lang 			= LanguageMap[phraseObj.Language(phraseType)];

        try {
        	this.isRecognize = true;
        	this.recognition.start();
        } catch (e) {
        	console.error(e);
        }

        this.timerId = setTimeout(this.stop.bind(this), this.waitTime);
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