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
			<?if ($new_user) {?>
			var new_user = true;
			<?}?>
			$(window).ready(()=>{
				vkApp = new VKApp(<?=VK_APP_ID?>, <?=$source_user_id?>, '<?=$source?>', <?=json_encode($phrases)?>);
				<?if ($new_user) {?>
				showAdvices();
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
	<div class="loader">
		<div class="spinner-border" role="status">
		</div>
	</div>
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

			<!-- Footer -->
			<footer class="mt-2 pt-2 border-top border-secondary text-center text-muted">
			    <p class="small">
			        <?=SITE_NAME?> v<?php echo APP_VERSION; ?> | <a class="link" onclick="showAdvices()"><?=Lang('help')?></a> | <a class="link" href="https://vk.com/club235452440"><?=Lang('group')?></a>
			    </p>
			</footer>
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