class UserApp {
	constructor() {
		this.userPhrasesLoaded = 0;
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
		if ((this.userPhrasesLoaded == 0) && this.user_id) {
			this.userPhrasesLoaded = 1;
			Ajax({
				action: 'getUserLists',
				data: {
					user_id: this.user_id
				}
			}).then((data)=>{
				if (data) {
					afterCondition(()=>{
						return phrasesList != null;
					}, ()=>{
						phrasesList.setUserLists(data);
						this.userPhrasesLoaded = 2;
					})
				}
			});
		}
	}
}

var userApp = new UserApp();
$(window).on('phrases_loaded', userApp.loadUserPhrases.bind(userApp));