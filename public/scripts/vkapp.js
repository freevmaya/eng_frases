
class VKApp {
	constructor(app_id) {
		vkBridge.send("VKWebAppInit", {})
			.then((response)=>{
            	console.log(response);
			});

	    let container = $('body');
	    const resizeObserver = new ResizeObserver(debounce(()=>{
	        if (vkBridge)
	            vkBridge.send('VKWebAppResizeWindow', {
	                height: container.outerHeight()
	            })
	    }, 50));
	    resizeObserver.observe(container[0]);
	}
}