class AppSound {
    constructor(config = {}) {
    	this.config = {
    		...config
    	}

    	for (let key in config.events) {
    		let data = config.events[key];

    		let onEvent = ()=>{
    			this.play(data);
    		};

    		$(window).on(key, onEvent);
    	};
    }

    play(data) {
    	let audio = new Audio(data.file);
            
        audio.volume = data.volume || 1;

    	audio.play();
    }
}

new AppSound({
	events: {
		question_phrase: {
			file: 'data/sounds/question.mp3',
			volume: 0.5
		}
	}
});