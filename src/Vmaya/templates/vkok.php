<?php
	GLOBAL $dbp;

	$v 			= '?v='.SCRIPTS_VERSION;
	$userModel 	= new UserModel();
	$user_id 	= 0;
	$vkok		= isset(Page::$request['vk_app_id']);
    $new_user 	= false;

	if ($vkok) {

		if (!vkVerifyParams(VK_APP_CLIENT_SECRET))
			Page::Wrong();

    	if (isset(Page::$request['vk_client']) && (Page::$request['vk_client'] == 'ok')) {
    		$source = 'ok';
    		$source_user_id = intval(Page::$request['vk_ok_user_id']);
    	} else {
    		$source = 'vk';
    		$source_user_id = intval(Page::$request['vk_user_id']);
    	}
    	
    	$items = null;

    	try {

			$items = $userModel->getItems(['source_id' => $source_user_id, 'source'=>$source]);

	    	if (count($items) == 0) {
	    		$user_id = $userModel->Update([
	    			'source_id'=>$source_user_id,
	    			'source'=>$source,
	    			'language_code'=>DEFAULT_LANGUAGE,
	    			'last_time'=>date('Y-m-d H:i:s')
	    		]);
	    		$new_user = $user_id;
	    	} else $user_id = $items[0]['id'];

    	} catch (Exception $e) {

    		$items = $userModel->getItems(['source_id' => $source_user_id, 'source'=>$source]);

    		if (count($items) > 0) {

    			$user_id = $items[0]['id'];

    			trace("Warning initalize user {$user_id}".
	    				"\nError: ".$e->getMessage());
    		} else {

	    		trace_error("Error initalize user".
	    				"\nError: ".$e->getMessage());

	    		$source = 'e-'.$source;
	    		$user_id = 1;

	    		$userModel->Update([
	    			'id'=>$user_id,
	    			'source_id'=>$source_user_id,
	    			'source'=>$source,
	    			'language_code'=>DEFAULT_LANGUAGE
	    		]);
	    	}

    	}

    	Page::setSession('source_user', [
    		'id' => $source_user_id,
    		'source' => $source
    	]);

    	Page::setSession('user_id', $user_id);

		$requestNotification = false;

    	if (!$new_user && ($user = $userModel->getItem($user_id))) {
	    	try {
	    		$last_time = $user['last_time'] ? $user['last_time'] : 'now';
	    		$user_period = HoursDiffDate($user['create_date'], $last_time);

		    	if ($user['data'] && ($data = json_decode($user['data'], true)) && ($user_period >= 1)) {
			    	$requestNotification = !(isset($data['allowedMessage']) && ($data['allowedMessage'] == 1));
			    }
			} catch (Exception $e) {
				trace_error($e->getMessage());
			}
	    }
    } else if (DEV) {

		//Инициализация пользователя VK. Только при разработке!
		$source 	= 'vk';
		$user_data 	= json_decode(file_get_contents(BASEPATH.'/dev/vk-parameters.json'), true);

		Page::setSession('source_user', [
    		'id' => $source_user_id = $user_data['id'],
    		'source' => $source
    	]);

		$items = $userModel->getItems(['source_id' => $source_user_id, 'source'=>$source]);

    	if (count($items) > 0)
    		$user_id = $items[0]['id'];
    	else {
    		$user_id = $userModel->Update([
    			'source_id'=>$source_user_id,
    			'source'=>$source,
    			'language_code'=>DEFAULT_LANGUAGE,
	    		'last_time'=>date('Y-m-d H:i:s')
    		]);
    		$new_user = $user_id;
    	}
    	
    	Page::setSession('user_id', $user_id);
    }

    if ($user_id) {

		$is_developer = Page::isDev();
		$phrases = (new UserPhrasesModel())->getPhrasesAsJsonWithDifficulty($user_id);
?>
<!DOCTYPE html>
<html lang="ru" data-bs-theme="<?=isset(Page::$request['theme']) ? Page::$request['theme'] : 'dark' ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <?include('noindex.php')?>
    <title><?=Lang('app_name');?></title>

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
	<?include('tracker.php')?>
	<script src="https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js"></script>
	<?include('lang_script.php')?>
	<script>
		let VK_GROUP_ID = <?=VK_GROUP_ID?>;
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
    <script src="scripts/jquery-3.7.0.min.js"></script>
    <script src="scripts/bootstrap.bundle.min.js"></script>
	<script src="scripts/crypto-js.min.js"></script>

	<script src="scripts/component.js<?=$v?>"></script>
	<script src="scripts/main.js<?=$v?>"></script>
	<script src="scripts/user-app.js<?=$v?>" defer></script>
	<script src="scripts/advice-modal.js<?=$v?>"></script>

    <?if ($vkok) {?>
		<script src="scripts/vkapp.js<?=$v?>" defer></script>

		<script type="text/javascript">
			var vkApp;
			$(window).ready(()=>{
				vkApp = new VKApp(<?=VK_APP_ID?>, <?=$source_user_id?>, '<?=$source?>', <?=json_encode($phrases)?>);
				<?if ($new_user) {?>
				showAdvices();
				<?}?>
				<?if ($requestNotification) {?>
					vkApp.requestNotification();
				<?}?>
			});
		</script>
    <?}?>
    <script type="text/javascript">
	<?if (DEV && isset($user_data)) {?>
		$(window).ready(()=>{
			var user_data = <?=json_encode($user_data, JSON_FLAGS)?>;
			userApp.init(user_data.id, '<?=$source?>', user_data, <?=json_encode($phrases)?>);
		});
	<?}?>
	</script>
	<?include('ya-mertika.php');?>
    <?include('gtag.php');?>
</head>
<body class="theme vkok">
	<div class="page">
		<div class="wrap-content">
			<!-- Header -->
			<header class="text-center mb-1">
			    <h1 class="display-4 text-gradient app-name">
			        <i class="bi bi-translate text-primary"></i>
			        <?=Lang('app_name');?>
			    </h1>
			</header>
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
<?} else Page::Wrong();?>