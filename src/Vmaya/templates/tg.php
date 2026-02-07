<?php
	$v = '?v='.SCRIPTS_VERSION.'_'.filemtime(BASEPATH.'/public/scripts/tg.js');

	$source 		= 'site';
	$source_user_id = 1;
	$userModel 		= new UserModel();

	if (!Page::getSession('source_user')) {

    	$items = $userModel->getItems("source_id = {$source_user_id} AND source = '{$source}'");

    	if (count($items) == 0) {
    		$user_id = $userModel->Update([
    			'source_id'=>$source_user_id,
    			'source'=>$source,
    			'language_code'=>'ru'
    		]);
    	} else $user_id = $items[0]['id'];

		Page::setSession('source_user', [
    		'id' => $source_user_id,
    		'source' => $source
    	]);

    	Page::setSession('user_id', $user_id);
    } else $user_id = Page::getSession('user_id');

	$is_developer = DEV || in_array($user_id, DEVUSERS);
?>
<!DOCTYPE html>
<html lang="ru" data-bs-theme="dark" data-source="tg">
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
	<script src="scripts/error-tracker.js<?=$v?>"></script>

	<!-- Bootstrap & jQuery -->
	<script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>
	<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script>

	<script src="scripts/component.js<?=$v?>"></script>
	<script src="scripts/main.js<?=$v?>"></script>
	<script src="scripts/user-app.js<?=$v?>" defer></script>
	<script src="scripts/advice-modal.js<?=$v?>"></script>
	<script type="text/javascript">
		<?if (isset(Page::$request['params'])) {?>
			let app_init_params = <?=urldecode(Page::$request['params'])?>;
		<?}?>
		ErrorTracker.init({
			version: <?=SCRIPTS_VERSION;?>,
			user_id: <?=$user_id;?>,
			excludeDomains: [
				'yandex.ru',
		        'google.com',
		        'example.org',
		        'googleapis.com',
		        'api/generate-audio',
		        'api/check-audio'
		    ]
		});

		var X_CSRF_Token = '<?=Page::LastToken();?>';
	</script>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
	<script src="scripts/tg.js<?=$v?>"></script>
	<script type="text/javascript">
		$(window).ready(()=>{
			new TGApp(<?=VK_APP_ID?>);
		});
	</script>
	<?include('ya-mertika.php');?>
</head>
<body class="theme tg">
	<div class="page">
		<div class="wrap-content">
			<?=$content?>
		</div>

	    <div class="modal fade" tabindex="-1" aria-labelledby="centeredModalLabel" aria-hidden="true" id="message">
	        <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
	            <div class="modal-content">
	                <div class="modal-header">
	                    <h5 class="modal-title" id="centeredModalLabel">Внимание!</h5>
	                </div>
	                <div class="modal-body">
	                    <div class="content" style="height: 320px">
	                    </div>
	                </div>
	                <div class="modal-footer">
	                	<div class="page-buttons">
		                    <button type="button" class="btn btn-secondary prev"><i class="bi bi-arrow-left"></i></button>
		                    <span class="page-number"></span>
		                    <button type="button" class="btn btn-secondary next"><i class="bi bi-arrow-right"></i></button>
	                	</div>
	                    <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Понятно</button>
	                </div>
	            </div>
	        </div>
	    </div>
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