
class VKApp {

	_haveAd = false;
	constructor(app_id, source_user_id, source) {

		this.app_id = app_id;
		this.source = source;
		this.source_user_id = source_user_id;
		
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

		vkBridge.send('VKWebAppCheckNativeAds', {
			ad_format: 'reward' /* Тип рекламы */ 
		})
		.then((data) => { 
			if (data.result) { 
				this._haveAd = true;
			}   
	  	})
	  	.catch((error) => { tracer.log(error); });

	  	this.initListeners();
	}

	initListeners() {
		$(window).on('apply_settings', this.onApplySettings.bind(this));
		$(window).on('playback', this.onPlayback.bind(this));
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

	onPlayback(e, data) {
		if (data == 'start')
			this.turnOffVKPlayer();
	}

	onApplySettings(e) {
		if (this._haveAd)
			this.showAd();
	}

	turnOffVKPlayer() {
		if (window.vkBridge) {
		    // Приостановить музыку ВК
		    vkBridge.send('VKWebAppAudioPause');
		    /*
		    // Или выключить звук
		    vkBridge.send('VKWebAppAudioSetVolume', {
		        volume: 0 // 0-100
		    });*/
		}
	}
}