$(document).on('keydown', (event)=>{
	let key = event.key.toLowerCase();
	if (key == 'i') {
		if (vkApp) vkApp.showShareDialog();
	}
});