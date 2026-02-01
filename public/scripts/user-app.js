class UserApp {
	constructor() {
		this.userPhrasesLoaded = false;
	}

	init(source_id, source, data) {

		Ajax({
			action: 'initUser',
			data: {
				source_id: source_id,
				source: source,
				user_data:  data
			}
		}).then((data)=>{
			if (data) {
				this.user_id = data.user_id;
				this.loadUserPhrases();
			}
		});
	}

	loadUserPhrases() {
		if (!this.userPhrasesLoaded && this.user_id && (typeof phrasesList == 'object')) {
			Ajax({
				action: 'getUserLists',
				data: {
					user_id: this.user_id
				}
			}).then((data)=>{
				if (data) {
					phrasesList.setUserLists(data);
					this.userPhrasesLoaded = true;
				}
			});
		}
	}

	onPhrasesLoaded() {
		this.phrases_loaded = true;
		this.loadUserPhrases();
	}
}

var userApp = new UserApp();
$(window).on('phrases_loaded', userApp.onPhrasesLoaded.bind(userApp));