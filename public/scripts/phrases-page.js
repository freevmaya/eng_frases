$(window).ready(()=>{
	var audio = new Audio();
	var currentItem = null;

	const onLoaded = ()=>{
		if (currentItem)
			currentItem.toggleClass('playing', true);
    }
    
    const onEnded = () => {
    	afterStop();
    };

    const onPause = ()=>{
    	afterStop();
    }
    
    const onError = (error) => {
    	afterStop();
    };

    function afterStop() {
    	if (currentItem) {
			audio.pause();
			currentItem.toggleClass('playing', false);
			currentItem = null;
		}
    }
                
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('loadeddata', onLoaded);

	$('.play').click(e => {

		afterStop();

		currentItem = $(e.currentTarget).parent();
		let url = currentItem.data('url');
		audio.src = url;
        audio.preload = 'auto';
            
        audio.volume = 1.0;
        audio.playbackRate = 1.0;

        audio.play();
	});
});