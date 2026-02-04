class TGApp {
	constructor(app_id) {
		this.tg = window.Telegram?.WebApp;
        
        // Initialize
        if (this.tg) {
            this.tg.ready();
            this.tg.expand();

            let user = this.tg.initDataUnsafe?.user;

            if (!user) {
            	user = {
            		allows_write_to_pm: true,
					first_name: "Vadim",
					id: 1573356581,
					language_code: "ru",
					last_name: "Frolov",
					photo_url: "https://t.me/i/userpic/320/xcWrMk8bCnKW2_6dAWSItdUlJfdLpbJDD1qOvkxVDqE.svg",
					username: "FreeVmaya"
            	}
            }

            userApp.init(user.id, 'tg', user);
        }
	}
}