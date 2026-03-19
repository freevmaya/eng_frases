class UserApp {
	constructor() {
		this.userPhrasesLoaded = 0;
	}

	init(source_id, source, a_user_data, phrases_list = null) {

		if (source_id == 'new') {
			let site_source_id = localStorage.getItem(source + '_source_id');
			if (isNumeric(site_source_id)) {
				source_id = parseInt(site_source_id);
			}
		}

		Ajax({
			action: 'initUser',
			data: {
				source_id: source_id,
				source: source,
				user_data:  a_user_data
			}
		}).then((data)=>{
			if (data && isNumeric(data.user_id)) {

				this.user_id = parseInt(data.user_id);
				$(window).trigger('on_user_id', this.user_id);

				if (isNumeric(data.source_id))
					localStorage.setItem(source + '_source_id', parseInt(data.source_id));

				if (data.redirect)
					document.location.href = data.redirect;
				else this.loadUserPhrases();

			}
		});

		if (phrases_list != null) {
			this.userPhrasesLoaded = 2;
			afterCondition(()=>{
				return (typeof phrasesList != 'undefined') && (phrasesList != null);
			}, ()=>{
				$(window).trigger('user_list_loaded', phrases_list);
				this.userPhrasesLoaded = 2;
			});
		}
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
				afterCondition(()=>{
					return phrasesList != null;
				}, ()=>{
					$(window).trigger('user_list_loaded', data);
					this.userPhrasesLoaded = 2;
				});
			});
		}
	}
}

var userApp = new UserApp();
$(window).on('phrases_loaded', userApp.loadUserPhrases.bind(userApp));