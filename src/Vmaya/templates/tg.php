<!DOCTYPE html>
<html lang="<?=Lang('html_lang')?>" data-bs-theme="dark" data-source="tg">
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
    <?include('lang_script.php')?>

    <!-- Bootstrap & jQuery -->
    <script src="scripts/jquery-3.7.0.min.js"></script>
    <script src="scripts/bootstrap.bundle.min.js"></script>
    <script src="scripts/crypto-js.min.js"></script>

    <script src="scripts/component.js<?=$v?>"></script>
    <script src="scripts/main.js<?=$v?>"></script>
    <script src="scripts/user-app.js<?=$v?>" defer></script>
    <script src="scripts/advice-modal.js<?=$v?>"></script>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <script src="scripts/tg.js<?=$v?>"></script>
    <script type="text/javascript">
        <?if ($app_init_params) {?>
            var app_init_params = <?=$app_init_params?>;
        <?}?>
        $(window).ready(()=>{
            new TGApp();
        });
    </script>
    <?include('ya-mertika.php');?>
    <?include('gtag.php');?>
</head>
<body class="theme tg">
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
        </div>
        <?include('message.php')?>
        <?include('confirm.php')?>
        <script type="text/javascript">
            window.stateManager = new StateManager({
                use_server: <?=Page::getSession('user_id', false) ? 'true' : 'false'?>
            });
        </script>
        <!-- Eruda is console for mobile browsers-->
        <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
        <script>eruda.init();</script>
    </div>
</body>
</html>