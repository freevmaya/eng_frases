
class VKApp {

	_haveAd = false;
	constructor(app_id, source_user_id, source, user_phrases = null) {

		this.app_id = app_id;
		this.source = source;
		this.source_user_id = source_user_id;

		$('body').addClass('vk_layout');

		vkBridge.send('VKWebAppGetUserInfo', {})
			.then(((user) => { 
				if (user.id == this.source_user_id)
					userApp.init(user.id, this.source, user, user_phrases);
				
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

  		setTimeout((token)=>{

	  		Ajax({
	  			action: 'vk_apiCall',
	  			data: {
	  				method: 'secure.addAppEvent',
	  				user_id: this.source_user_id,
	  				activity_id: 1,
	  				value: 1
	  			}
	  		})

  		}, 1000);
	}

	requestNotification() {

		vkBridge.send("VKWebAppAllowMessagesFromGroup", { "group_id": VK_GROUP_ID })
			.then((data) => {
				if (data.result)
					Ajax({
						action: 'allowedMessage'
					});
			});
	}

	getToken(scope, callback) {
		vkBridge.send('VKWebAppGetAuthToken', { 
			app_id: this.app_id, 
			scope: scope
		})
		.then( (data) => { 
			if (data.access_token)
				callback(data.access_token);
		})
		.catch( (error) => {
			tracer.log(error);
		});
	}

	callApi(method, params, callback) {
		vkBridge.send('VKWebAppCallAPIMethod', {
			method: method,
			params: params
		})
		.then((data) => { 
			if (data.response)
				callback(data);
		})
		.catch((error) => {
			tracer.log(error);
		});
	}

	initListeners() {
		$(window).on('apply_settings', this.onApplySettings.bind(this));
		$(window).on('playback', this.onPlayback.bind(this));
		$(window).on('award', this.onAward.bind(this))
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

	onAward(e, data) {

	}

	turnOffVKPlayer() {
		if (window.vkBridge) {
		    /*
		    // Приостановить музыку ВК
		    vkBridge.send('VKWebAppAudioPause');
		    // Или выключить звук
		    vkBridge.send('VKWebAppAudioSetVolume', {
		        volume: 0 // 0-100
		    });*/
		}
	}
}