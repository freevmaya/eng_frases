
class VKApp {
	requireShareCount = 3;
	_haveAd = false;
	constructor(app_id, source_user_id, source, user_phrases = null) {

		this.app_id = app_id;
		this.source = source;
		this.source_user_id = source_user_id;
		this.count_phrases = 0;
		this.sharedSession = false;

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

	  	setTimeout(this.requestNotification.bind(this), 10000);
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
		$(window).on('award', this.onAward.bind(this));
		$(window).on('share', this.onShare.bind(this));
		$(window).on('next_phrase', this.onNextPhrase.bind(this));
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

	onShare(e, data) {
		tracer.log(data);
		vkBridge.send('VKWebAppShare', {
		});
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

	shareApp(message) {
		return new Promise((resolve, reject)=>{
			vkBridge.send('VKWebAppShare', {
				text: message
			})
			.then((data)=>{
				let items = data.result || data.items;
				if (items && items.length)
					resolve(items);
				else {
					tracer.error(data);
					reject(data);
				}
			})
			.catch((e)=>{
				tracer.error(e);
				reject(e);
			});
		});
	}

	onNextPhrase(e, data) {

		if (typeof new_user != 'undefined')
			return;

		this.count_phrases++;
		let requireCount = this.requireShareCount - stateManager.state.shared.length;

		if ((this.count_phrases >= 5) && !this.sharedSession && (requireCount > 0)) {
			Confirm(Lang('share-confirm', [strEnum(requireCount, Lang('frend-time'))]))
                .then(()=>{
					this.shareApp(Lang('share-in-next-phrase'))
						.then((result)=>{
							let item = result[0];
							if ((item.type == 'message') && (item.users.length > 0)) {

								for (let i=0; i<item.users.length; i++) {
									if (!stateManager.state.shared.includes(item.users[i].id)) {
										stateManager.state.shared.push(item.users[i].id);
										this.sharedSession = true;
									}
								}

								if (this.sharedSession)
									stateManager.saveState();

								return;
							}
							this.sharedSession = true;
							tracer.log(result);
						});
					});

			$(window).trigger('stop-play');
		}
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