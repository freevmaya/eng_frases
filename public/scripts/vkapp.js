
class VKApp {
	constructor(app_id) {
		vkBridge.send("VKWebAppInit", {})
			.then((response)=>{
            	console.log(response);
			});
	}
}