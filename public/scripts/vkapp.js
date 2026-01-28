
class VKApp {

	_haveAd = false;
	constructor(app_id) {

		showAdvices();
		vkBridge.send("VKWebAppInit", {})
			.then((response)=>{
				console.log(response);
			});

		$('body').addClass('vk_layout');

		vkBridge.send('VKWebAppGetUserInfo', {})
			.then((user) => { 
				if (user.id) {
					userApp.init(user.id, 'vk', user);
				}
			});

		$(window).on('apply_settings', this.onApplySettings.bind(this));

		vkBridge.send('VKWebAppCheckNativeAds', {
			ad_format: 'reward' /* Тип рекламы */ 
		})
		.then((data) => { 
			if (data.result) { 
				this._haveAd = true;
			}   
	  	})
	  	.catch((error) => { console.log(error); });
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
		.catch((error) => { console.log(error); });
	}

	onApplySettings(e) {
		if (this._haveAd)
			this.showAd();
	}
}