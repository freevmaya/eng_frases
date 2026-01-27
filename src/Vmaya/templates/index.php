<?php
	$v = 84;
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

    <?if (isset(Page::$request['vk_app_id'])) {
    	$userModel = new UserModel();
    	$source = isset(Page::$request['vk_client']) && (Page::$request['vk_client'] == 'ok') ? 'ok' : 'vk';

    	$items = $userModel->getItems("source_id = ".Page::$request['vk_user_id']." AND source = '{$source}'");

    	if (count($items) == 0) {
    		$user_id = $userModel->Update([
    			'source_id'=>Page::$request['vk_user_id'],
    			'source'=>$source,
    			'language_code'=>'ru'
    		]);
    	} else $user_id = $items[0]['id'];
    ?>
    <script src="https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js"></script>
	<script src="scripts/vkapp.js?v=<?=$v?>"></script>

	<script type="text/javascript">
		$(window).ready(()=>{
			new VKApp(<?=VK_APP_ID?>, <?=$user_id?>);
		});
	</script>
    <?}?>


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
	<?=$content?>

	<?if (DEV) {?>
	<!-- Eruda is console for mobile browsers-->
	<script src="https://cdn.jsdelivr.net/npm/eruda"></script>
	<script>eruda.init();</script>
	<?}?>
</body>
</html>