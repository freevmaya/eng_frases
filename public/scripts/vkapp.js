
class VKApp {

	_haveAd = false;
	constructor(app_id) {
		vkBridge.send("VKWebAppInit", {})
			.then((response)=>{
			});

		/*
	    let container = $('body');
	    const resizeObserver = new ResizeObserver(debounce(()=>{
	        if (vkBridge)
	            vkBridge.send('VKWebAppResizeWindow', {
	                height: container.outerHeight()
	            })
	    }, 50));
	    resizeObserver.observe(container[0]);
	    */

		$('body').addClass('vk_layout');

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