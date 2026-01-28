class UserApp {
	init(id, source, data) {

		Ajax({
			action: 'initUser',
			data: {
				id: id,
				source: source,
				source_user: data
			}
		});
	}
}

var userApp = new UserApp();