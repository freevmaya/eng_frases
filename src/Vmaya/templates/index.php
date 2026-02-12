<?php
    $v = '?v='.SCRIPTS_VERSION;

    $user_id = 0;
    Page::setSession('user_id', 0);

    $is_developer = Page::isDev();
?>
<!DOCTYPE html>
<html lang="<?=Lang('html_lang')?>" data-bs-theme="<?=isset(Page::$request['theme']) ? Page::$request['theme'] : 'dark' ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?=Lang('app_name');?></title>

    <!-- PWA Support -->
    <link rel="manifest" href="manifest.json">
    
    <!-- Bootstrap 5 -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
    <!-- Custom CSS -->
    <link rel="stylesheet" href="css/themes.css<?=$v?>" media="all">
    <?
    $file_style = 'style';
    if (isset(Page::$request['style']))
        $file_style = Page::$request['style'];
    ?>
    <link rel="stylesheet" href="css/<?=$file_style?>.css<?=$v?>" media="all">
    <link rel="stylesheet" href="css/style-waves.css<?=$v?>" media="all">
    <?if ($is_developer) {?><script>var DEV = true</script><?}?>
    <script src="scripts/error-tracker.js<?=$v?>"></script>
    <?include('lang_script.php')?>

    <!-- Bootstrap & jQuery -->
    <script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script>

    <script src="scripts/component.js<?=$v?>"></script>
    <script src="scripts/main.js<?=$v?>"></script>
    <?if ($user_id) {?>
    <script src="scripts/user-app.js<?=$v?>" defer></script>
    <?}?>
    <script src="scripts/advice-modal.js<?=$v?>"></script>
    <script type="text/javascript">
        ErrorTracker.init({
            version: <?=SCRIPTS_VERSION;?>,
            user_id: <?=Page::getSession('user_id', 0);?>,
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
    <?include('ya-mertika.php');?>
</head>
<body class="theme site">
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