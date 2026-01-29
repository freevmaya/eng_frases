class UserApp {
	init(source_id, source, data) {
		Ajax({
			action: 'initUser',
			data: {
				source_id: source_id,
				source: source,
				user_data:  data
			}
		}).then((data)=>{
			if (data.user_id && (typeof phrasesList !== 'undefined'))
				phrasesList.setUserLists(data.user_lists);
		});
	}
}

var userApp = new UserApp();