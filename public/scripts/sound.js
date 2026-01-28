class AppSound {
    constructor(config = {}) {
    	this.config = {
    		...config
    	}

    	this.cache = {};

    	for (let key in config.events) {
    		let data = config.events[key];

    		let onEvent = ()=>{
    			this.play(data);
    		};

    		$(window).on(key, onEvent);
    	};
    }

    play(data) {
    	let audio;
    	if (data.file in this.cache)
    		audio = this.cache[data.file];
    	else {
    		audio = new Audio(data.file);
            
        	audio.volume = data.volume || 1;
    		this.cache[data.file] = audio;
    	}

    	audio.play();
    }
}

new AppSound({
	events: {
		question_phrase: {
			file: 'data/sounds/question.mp3',
			volume: 0.25
		},
		success: {
			file: 'data/sounds/win.mp3',
			volume: 0.25
		}
	}
});