<?
    $page_title = Lang('phrases-page').' '.$type_name;
?>
<!DOCTYPE html>
<html lang="<?=Lang('html_lang')?>" data-bs-theme="<?=Page::getRequest('theme', 'dark')?>">
<head>
    <meta charset="UTF-8">
    <?include('title-meta.php')?>

    <!-- PWA Support -->
    <link rel="manifest" href="manifest.json">
    
    <!-- Bootstrap 5 -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
    <?
    if (isset(Page::$request['style'])) {?>
        <link rel="stylesheet" href="<?=BASEURL?>css/<?=Page::$request['style']?>.css<?=$v?>" media="all">
    <?}?>
    <link rel="stylesheet" href="<?=BASEURL?>css/phrases-style.css<?=$v?>" media="all">

    <!-- Bootstrap & jQuery -->
    <script src="<?=BASEURL?>scripts/jquery-3.7.0.min.js"></script>
    <script src="<?=BASEURL?>scripts/bootstrap.bundle.min.js"></script>
    <script src="<?=BASEURL?>scripts/phrases-page.js<?=$v?>"></script>
    <?include('ya-mertika.php');?>
    <?include('gtag.php');?>
</head>
<body class="phrases-page">
    <div class="page-content">
        <header>
            <h1 class="display-4 app-name">
                <i class="bi bi-translate text-primary"></i>
                <?=$page_title;?>
            </h1>
            <div class="navigator">
            <?if ($prev_url) {?>
                <a href="<?=$prev_url?>" class="prev"><i class="bi bi-skip-backward-circle-fill"></i>
                    <span><?=$prev['type_name']?></span></a>
            <?} else {?>
                <div></div>
            <?}?>
            <?if ($next_url) {?>
                <a href="<?=$next_url?>" class="next"><span><?=$next['type_name']?></span>
                    <i class="bi bi-fast-forward-circle-fill"></i></a>
            <?} else {?>
                <div></div>
            <?}?>

                <div class="user-block">
                    <div class="dropdown">
                        <button class="btn dropdown-toggle" type="button" data-bs-toggle="dropdown">
                            <span class="fi fi-gb me-1"></span><?=Lang(Page::language())?>
                        </button>

                        <ul class="dropdown-menu">
                            <?foreach (LANGUAGES as $litem=>$value) {?>
                            <li>
                                <a class="dropdown-item" href="<?=$this->Route(['page'=>'phrases', 'lang'=>$litem, 'type_name'=>'Present_simple']);?>"><span class="fi fi-ru me-2"></span>
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
            </div>
            <?if ($descriptionItem) {?>
            <h2><?=$descriptionItem['name']?></h2>
            <div class="description small">
                <?=$descriptionItem['description']?>
            </div>
            <?}?>
            <div>
                <?=Lang('phrases-page-description')?>
            </div>
        </header>
        <div class="phrases-body">
            <div class="phrases-list">
            <?foreach ($phrases as $phrase) {
                ?>
                <div class="item">
                    <div class="native">
                        <?=$phrase['native_text']?>
                    </div>
                    <div class="target" data-url="<?=$this->getAudioUrl($phrase)?>">
                        <i class="bi bi-play-circle play"></i>
                        <?=$phrase['target_text']?>
                    </div>
                </div>
            <?}?>
            </div>
        </div>
        <footer class="mt-2 pt-2 border-top border-secondary text-center text-muted small">
            <a href="<?=BASEURL?>" target="_self"><?=SITE_NAME?></a> v<?php echo APP_VERSION; ?> | <a class="link" href="https://vk.com/club235452440"><?=Lang('group')?></a>
        </footer>
    </div>
    <?if ($is_developer) {?>
    <!-- Eruda is console for mobile browsers-->
    <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
    <script>eruda.init();</script>
    <?}?>
</body>
</html>