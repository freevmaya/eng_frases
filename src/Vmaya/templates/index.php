<?php
$v = 15;
?>
<!DOCTYPE html>
<html lang="ru">
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

    <?if (isset(Page::$request['vk_app_id'])) {?>
    <script src="https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js"></script>
	<script src="scripts/vkapp.js"></script>
	<script type="text/javascript">
		$(window).ready(()=>{
			new VKApp(<?=VK_APP_ID?>);
		});
	</script>
    <?}?>
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