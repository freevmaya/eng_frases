class UserApp {
	init(source_id, source, data) {

		Ajax({
			action: 'initUser',
			data: {
				source_id: source_id,
				source: source,
				user_data:  data
			}
		});
	}
}

var userApp = new UserApp();