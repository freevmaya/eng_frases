<?php
	$v = SCRIPTS_VERSION;

	$userModel = new UserModel();
?>
<!DOCTYPE html>
<html lang="ru" data-bs-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo APP_NAME; ?></title>

    <!-- PWA Support -->
    <link rel="manifest" href="manifest.json">
    
    <!-- Bootstrap 5 -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
    <!-- Custom CSS -->
    <link rel="stylesheet" href="css/style.css?v=<?=$v?>">
    <link rel="stylesheet" href="css/style-waves.css?v=<?=$v?>">

	<!-- Bootstrap & jQuery -->
	<script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>
	<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script>

	<script src="scripts/component.js?v=<?=$v?>"></script>
	<script src="scripts/main.js?v=<?=$v?>"></script>
	<script src="scripts/user-app.js?v=<?=$v?>"></script>
	<script src="scripts/advice-modal.js?v=<?=$v?>"></script>

    <?if (isset(Page::$request['vk_app_id'])) {

	    	if (isset(Page::$request['vk_client']) && (Page::$request['vk_client'] == 'ok')) {
	    		$source = 'ok';
	    		$source_user_id = Page::$request['vk_ok_user_id'];
	    	} else {
	    		$source = 'vk';
	    		$source_user_id = Page::$request['vk_user_id'];
	    	}

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
	    ?>
	    <script src="https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js"></script>
		<script src="scripts/vkapp.js?v=<?=$v?>"></script>

		<script type="text/javascript">
			$(window).ready(()=>{
				new VKApp(<?=VK_APP_ID?>, <?=$source_user_id?>, '<?=$source?>');
			});
		</script>
    <?}?>

	<script type="text/javascript">
	<?
	if (DEV) {

		//Инициализация пользователя VK. Только при разработке!
		$source = 'vk';
		$user_data = json_decode(file_get_contents(BASEPATH.'/dev/vk-parameters.json'), true);
		Page::setSession('source_user', [
    		'id' => $user_data['id'],
    		'source' => $source
    	]);

    	$items = $userModel->getItems("source_id = {$user_data['id']} AND source = '{$source}'");

    	if (count($items) > 0)
    		Page::setSession('user_id', $items[0]['id']);

	?>
		var user_data = <?=json_encode($user_data, JSON_FLAGS)?>;
		setTimeout(()=>{
			userApp.init(user_data.id, '<?=$source?>', user_data);
		}, 1000);

		var tracer = {
			log(...arguments) {
				console.log(...arguments);
			}
		}
	<?} else {?>
		var tracer = {log(...arguments) {}};
	<?}?>
	</script>


	<!-- Yandex.Metrika counter -->
	<script type="text/javascript">
	    (function(m,e,t,r,i,k,a){
	        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
	        m[i].l=1*new Date();
	        for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
	        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
	    })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=106450888', 'ym');

	    ym(106450888, 'init', {ssr:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
	</script>
	<noscript><div><img src="https://mc.yandex.ru/watch/106450888" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
	<!-- /Yandex.Metrika counter -->
</head>
<body class="dark-theme">
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

	<?if (DEV) {?>
	<!-- Eruda is console for mobile browsers-->
	<script src="https://cdn.jsdelivr.net/npm/eruda"></script>
	<script>eruda.init();</script>
	<?}?>
</body>
</html>