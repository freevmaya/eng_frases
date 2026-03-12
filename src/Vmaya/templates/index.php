<?
    $page_title = Lang('app_name');
    $is_request_theme = isset(Page::$request['theme']);
?>
<!DOCTYPE html>
<html lang="<?=Lang('html_lang')?>" data-bs-theme="<?=isset(Page::$request['theme']) ? Page::$request['theme'] : 'dark' ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <?include('title-meta.php')?>

    <!-- PWA Support -->
    <link rel="manifest" href="manifest.json">
    
    <!-- Bootstrap 5 -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
    <!-- Custom CSS -->
    <link rel="stylesheet" href="<?=BASEURL?>css/themes.css<?=$v?>" media="all">
    <?
    if (isset(Page::$request['style'])) {?>
        <link rel="stylesheet" href="<?=BASEURL?>css/<?=Page::$request['style']?>.css<?=$v?>" media="all">
    <?}?>
    <link rel="stylesheet" href="<?=BASEURL?>css/style.css<?=$v?>" media="all">
    <link rel="stylesheet" href="<?=BASEURL?>css/style-waves.css<?=$v?>" media="all">
    <?if ($is_developer) {?><script>var DEV = true</script><?}?>
    <?include('tracker.php')?>
    <?include('lang_script.php')?>

    <!-- Yandex.RTB -->
    <script>window.yaContextCb=window.yaContextCb||[]</script>
    <script src="https://yandex.ru/ads/system/context.js" async></script>

    <!-- Bootstrap & jQuery -->
    <script src="<?=BASEURL?>scripts/jquery-3.7.0.min.js"></script>
    <script src="<?=BASEURL?>scripts/bootstrap.bundle.min.js"></script>
    <script src="<?=BASEURL?>scripts/crypto-js.min.js"></script>

    <script src="<?=BASEURL?>scripts/component.js<?=$v?>"></script>
    <script src="<?=BASEURL?>scripts/main.js<?=$v?>"></script>
    <?
    $user_data = json_encode($this->user['data'], JSON_FLAGS);
    if ($this->user_id && $user_data) {?>
    <script src="<?=BASEURL?>scripts/user-app.js<?=$v?>" defer></script>
    <script type="text/javascript">
        $(window).ready(()=>{

            var user_data = <?=$user_data?>;

            <?if ($this->new_user) {?>

                let storage_user_id = localStorage.getItem('site_user_id');
                if (storage_user_id) {
                    userApp.init(storage_user_id, '<?=Main::$source?>', null);
                } else {
                    if (user_data.id) {
                        userApp.init(user_data.id, '<?=Main::$source?>', user_data, <?=json_encode($phrases)?>);
                        localStorage.setItem('site_user_id', user_data.id);
                    } else localStorage.setItem('site_user_id', null);
                }

            <?} else {?>
                if (user_data.id) {
                    userApp.init(user_data.id, '<?=Main::$source?>', user_data, <?=json_encode($phrases)?>);
                    localStorage.setItem('site_user_id', user_data.id);
                } else localStorage.setItem('site_user_id', null);
            <?}?>

        });
    </script>
    <?}?>
    <script src="<?=BASEURL?>scripts/advice-modal.js<?=$v?>"></script>
    <?include('ya-mertika.php');?>
    <?include('gtag.php');?>
    <?if (!$is_request_theme) include('check-theme.php');?>
</head>
<body class="theme site">
    <div class="loader">
        <div class="spinner-border" role="status">
        </div>
    </div>
    <div class="page">
        <!-- Yandex.RTB R-A-18903581-1 -->
        <script>
        window.yaContextCb.push(() => {
            Ya.Context.AdvManager.render({
                "blockId": "R-A-18903581-1",
                "type": "topAd"
            })
        })
        </script>
        <div class="wrap-content">
            <!-- Header -->
            <header class="text-center mb-1 site-header">
                <h1 class="display-4 text-gradient app-name">
                    <i class="bi bi-translate text-primary"></i>
                    <?=Lang('app_name');?>
                </h1>
                <div class="user-block">
                    <div class="dropdown">
                        <button class="btn dropdown-toggle" type="button" data-bs-toggle="dropdown">
                            <span class="fi fi-gb me-1"></span><?=Lang(Page::language())?>
                        </button>

                        <ul class="dropdown-menu">
                            <?foreach (LANGUAGES as $litem=>$value) {?>
                            <li>
                                <a class="dropdown-item" href="?lang=<?=$litem?>"><span class="fi fi-ru me-2"></span>
                                    <?=$value?>
                                </a>
                            </li>
                            <?}?>
                        </ul>
                    </div>
                    <!--
                    <button type="button" class="btn">
                        <i class="bi bi-person"></i>
                    </button>
                    -->
                </div>
            </header>
            <?=$content?>

            <!-- Footer -->
            <footer class="mt-2 pt-2 border-top border-secondary text-center text-muted">
                <p class="small">
                    <?=SITE_NAME?> v<?php echo APP_VERSION; ?> | <a class="link" onclick="showAdvices()"><?=Lang('help')?></a> | <a class="link" href="<?=$this->Route(['page'=>'phrases', 'lang'=>Page::language(), 'type_name'=>'Present_simple']);?>"><?=Lang('phrases-page')?></a>
                </p>
            </footer>
        </div>
        <?include('message.php')?>
        <?include('confirm.php')?>
        <script type="text/javascript">
            window.stateManager = new StateManager({
                use_server: <?=$this->user_id ? 'true' : 'false'?>
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