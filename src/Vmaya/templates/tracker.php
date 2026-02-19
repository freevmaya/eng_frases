<script src="scripts/error-tracker.js<?=$v?>"></script>
<script type="text/javascript">
	ErrorTracker.init({
		version: <?=SCRIPTS_VERSION;?>,
		user_id: <?=isset($this->user_id) ? $this->user_id : $user_id;?>,
		excludeDomains: [
			'generate-phrases',
			'yandex',
	        'google',
	        'example.org',
	        'generate-audio',
	        'check-audio'
	    ]
	});

	var X_CSRF_Token = '<?=Page::LastToken();?>';
</script>