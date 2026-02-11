<?php
	$v 			= '?v='.SCRIPTS_VERSION;
	$userModel 	= new UserModel();
	$user_id 	= Page::getSession('user_id', 0);
	$vkok		= isset(Page::$request['vk_app_id']);

	if ($vkok) {

		if (!vkVerifyParams(VK_APP_CLIENT_SECRET))
			Page::Wrong();

    	if (isset(Page::$request['vk_client']) && (Page::$request['vk_client'] == 'ok')) {
    		$source = 'ok';
    		$source_user_id = Page::$request['vk_ok_user_id'];
    	} else {
    		$source = 'vk';
    		$source_user_id = Page::$request['vk_user_id'];
    	}

    	$items = $userModel->getItems("source_id = {$source_user_id} AND source = '{$source}'");
    	$new_user = false;

    	if (count($items) == 0) {
    		$user_id = $userModel->Update([
    			'source_id'=>$source_user_id,
    			'source'=>$source,
    			'language_code'=>'ru'
    		]);
    		$new_user = $user_id;
    	} else $user_id = $items[0]['id'];

    	Page::setSession('source_user', [
    		'id' => $source_user_id,
    		'source' => $source
    	]);

    	Page::setSession('user_id', $user_id);
    }

	$is_developer = Page::isDev();
	$phrases = (new UserPhrasesModel())->getPhrasesAsJsonWithDifficulty($user_id);
?>
<!DOCTYPE html>
<html lang="ru" data-bs-theme="<?=isset(Page::$request['theme']) ? Page::$request['theme'] : 'dark' ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <?include('noindex.php')?>
    <title><?php echo APP_NAME; ?></title>

    <!-- PWA Support -->
    <link rel="manifest" href="manifest.json">
    
    <!-- Bootstrap 5 -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
    <!-- Custom CSS -->
    <link rel="stylesheet" href="css/themes.css<?=$v?>" media="all">
    <link rel="stylesheet" href="css/style.css<?=$v?>" media="all">
    <link rel="stylesheet" href="css/style-waves.css<?=$v?>" media="all">
    <?if ($is_developer) {?><script>var DEV = true</script><?}?>
	<script src="https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js"></script>
	<script src="scripts/error-tracker.js<?=$v?>"></script>
	<script>
		vkBridge.send("VKWebAppInit", {})
			.then((response)=>{
				tracer.log(response);
			});


		vkBridge.send('VKWebAppGetConfig', {})
			.then(((data) => { 
				if (data && data.appearance) {
		            tracer.log('Тема VK:', data.appearance);
		            document.documentElement.setAttribute('data-bs-theme', data.appearance);
		        }
			}).bind(this));
	</script>

	<!-- Bootstrap & jQuery -->
	<script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>
	<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script>

	<script src="scripts/component.js<?=$v?>"></script>
	<script src="scripts/main.js<?=$v?>"></script>
	<script src="scripts/user-app.js<?=$v?>" defer></script>
	<script src="scripts/advice-modal.js<?=$v?>"></script>
	<script type="text/javascript">
		ErrorTracker.init({
			version: <?=SCRIPTS_VERSION;?>,
			user_id: <?=$user_id;?>,
			excludeDomains: [
				'yandex',
		        'google.com',
		        'example.org',
		        'googleapis.com',
		        'api/generate-audio',
		        'api/check-audio'
		    ]
		});

		var X_CSRF_Token = '<?=Page::LastToken();?>';
	</script>

    <?if ($vkok) {?>
		<script src="scripts/vkapp.js<?=$v?>" defer></script>

		<script type="text/javascript">
			$(window).ready(()=>{
				new VKApp(<?=VK_APP_ID?>, <?=$source_user_id?>, '<?=$source?>', <?=json_encode($phrases)?>);
				<?if ($new_user) {?>
				showAdvices();
				<?}?>
			});
		</script>
    <?}?>
    <script type="text/javascript">
	<?if (DEV) {

		//Инициализация пользователя VK. Только при разработке!
		$source = 'vk';
		$user_data = json_decode(file_get_contents(BASEPATH.'/dev/vk-parameters.json'), true);
		Page::setSession('source_user', [
    		'id' => $user_data['id'],
    		'source' => $source
    	]);

    	$items = $userModel->getItems("source_id = {$user_data['id']} AND source = '{$source}'");

    	if (count($items) > 0)
    		Page::setSession('user_id', $user_id = $items[0]['id']);

	?>
		$(window).ready(()=>{
			var user_data = <?=json_encode($user_data, JSON_FLAGS)?>;
			userApp.init(user_data.id, '<?=$source?>', user_data, <?=json_encode($phrases)?>);
		});
	<?}?>
	</script>
	<?include('ya-mertika.php');?>
</head>
<body class="theme vkok">
	<div class="page">
		<div class="wrap-content">
			<?=$content?>
		</div>
	    <?include('message.php')?>
	    <?include('confirm.php')?>
		<script type="text/javascript">
		    window.stateManager = new StateManager({
		        use_server: <?=Page::getSession('user_id', false) ? 'true' : 'false'?>
		    });
		</script>

		<?if ($is_developer) {?>
		<!-- Eruda is console for mobile browsers-->
		<script src="https://cdn.jsdelivr.net/npm/eruda"></script>
		<script>eruda.init();</script>
		<?}?>
	</div>
</body>
</html>