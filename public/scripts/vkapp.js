
class VKApp {
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
	}

	onApplySettings(e) {
		console.log(e);
		vkBridge.send('VKWebAppCheckNativeAds', {
				ad_format: 'reward' /* Тип рекламы */ 
			})
			.then((data) => { 
				if (data.result) { 
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
		  	})
		  	.catch((error) => { console.log(error); });
	}
}