<script type="text/javascript">

    $(window).ready(()=>{

        $('.page').addClass('page-loaded');

    });

    function play() {

        
        let audio = new Audio();
        audio.currentTime = 0;
        audio.src = "https://eng-frases.com/data/voices/male/en/en_061b8fb45f5f82044d27891c97e9dc3e.mp3";
        audio.preload = 'auto';
        audio.volume = 1.0;
        audio.playbackRate = 1.0;

        const playPromise = audio.play();
                
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error(error);
            });
        }
            audio.pause();

        setTimeout(()=>{
            audio.pause();
            audio.currentTime = 0;
        }, 500);


        setTimeout(()=>{
            audio.pause();
            audio.currentTime = 0;
        }, 1000);

    };
</script>
<div id="output" class="card bg-theme-gradient border-primary border-3 animate-card">
<button type="button" onclick="play()"> Play</button>
<div>