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
    <?include('tracker.php')?>
    <?include('lang_script.php')?>

    <!-- Bootstrap & jQuery -->
    <script src="scripts/jquery-3.7.0.min.js"></script>
    <script src="scripts/bootstrap.bundle.min.js"></script>
    <script src="scripts/crypto-js.min.js"></script>

    <script src="scripts/component.js<?=$v?>"></script>
    <script src="scripts/main.js<?=$v?>"></script>
    <?
    $user_data = json_encode($this->user['data'], JSON_FLAGS);
    if ($this->user_id && $user_data) {?>
    <script src="scripts/user-app.js<?=$v?>" defer></script>
    <script type="text/javascript">
        $(window).ready(()=>{

            var user_data = <?=$user_data?>;

            <?if ($this->new_user) {?>

                let storage_user_id = localStorage.getItem('site_user_id');
                if (storage_user_id) {
                    userApp.init(storage_user_id, '<?=Main::$source?>', null);
                } else {
                    userApp.init(user_data.id, '<?=Main::$source?>', user_data, <?=json_encode($phrases)?>);
                    localStorage.setItem('site_user_id', user_data.id);
                }

            <?} else {?>
                userApp.init(user_data.id, '<?=Main::$source?>', user_data, <?=json_encode($phrases)?>);
                localStorage.setItem('site_user_id', user_data.id);
            <?}?>

        });
    </script>
    <?}?>
    <script src="scripts/advice-modal.js<?=$v?>"></script>
    <?include('ya-mertika.php');?>
    <?include('gtag.php');?>
</head>
<body class="theme site">
    <div class="loader">
        <div class="spinner-border" role="status">
        </div>
    </div>
    <div class="page">
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
                            <?foreach (LANGUAGES as $litem) {?>
                            <li>
                                <a class="dropdown-item" href="?lang=<?=$litem?>"><span class="fi fi-ru me-2"></span>
                                    <?=Lang($litem)?>
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