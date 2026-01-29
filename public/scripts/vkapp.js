
class VKApp {

	_haveAd = false;
	constructor(app_id, source_user_id, source) {

		this.app_id = app_id;
		this.source = source;
		this.source_user_id = source_user_id;

		showAdvices();
		vkBridge.send("VKWebAppInit", {})
			.then((response)=>{
				tracer.log(response);
			});

		$('body').addClass('vk_layout');

		vkBridge.send('VKWebAppGetUserInfo', {})
			.then(((user) => { 
				if (user.id == this.source_user_id)
					userApp.init(user.id, this.source, user);
				
			}).bind(this));

		$(window).on('apply_settings', this.onApplySettings.bind(this));

		vkBridge.send('VKWebAppCheckNativeAds', {
			ad_format: 'reward' /* Тип рекламы */ 
		})
		.then((data) => { 
			if (data.result) { 
				this._haveAd = true;
			}   
	  	})
	  	.catch((error) => { tracer.log(error); });
	}

	showAd() {
		vkBridge.send('VKWebAppShowNativeAds', {
			ad_format: 'interstitial' /* Тип рекламы */
		})
		.then( (data) => { 
			if (data.result) {
			// Реклама была показана
			}
		})
		.catch((error) => { tracer.log(error); });
	}

	onApplySettings(e) {
		if (this._haveAd)
			this.showAd();
	}
}