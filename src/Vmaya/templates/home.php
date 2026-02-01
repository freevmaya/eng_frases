<?php
    $v = SCRIPTS_VERSION;
?>
<!-- Settings Modal -->
<div class="modal fade fullscreen-modal" id="settingsModal" tabindex="-1" aria-labelledby="settingsModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-fullscreen">
        <div class="modal-content bg-dark">
            <div class="modal-header border-secondary">
                <h5 class="modal-title text-primary" id="settingsModalLabel">
                    <i class="bi bi-gear me-2"></i>Настройки
                </h5>
            </div>
            <div class="modal-body">

                <div class="mb-4">
                    <h6 class="text-info mb-3">
                        <i class="bi bi-tv me-2"></i>Дополнения
                    </h6>
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="tvScreenToggle" checked>
                        <label class="form-check-label" for="tvScreenToggle">
                            Показывать TV-экран
                        </label>
                    </div>
                    <div class="form-check form-switch" id="recognizeToggleForm">
                        <input class="form-check-input" type="checkbox" id="recognizeToggle" checked>
                        <label class="form-check-label" for="recognizeToggle">
                            Распознавание речи
                        </label>
                    </div>
                </div>

                <div class="mb-4">
                    <h6 class="text-info mb-3">
                        <i class="bi bi-pause-circle me-2"></i>Пауза между фразами
                    </h6>
                    <input type="range" class="form-range" id="pauseSlider" min="1" max="10" step="0.5" value="3">
                    <div class="text-center mt-2">
                        <span class="badge bg-primary" id="pauseValue">3 сек</span>
                    </div>
                </div>

                <div class="mb-4">
                    <h6 class="text-info mb-3">
                        <i class="bi bi-arrow-left-right me-2"></i>Режим "Перевод"
                    </h6>
                    <div class="btn-group w-100" role="group">
                        <button type="button" class="btn btn-outline-primary" data-direction="native-target">
                            Рус → Англ(звук)
                        </button>
                        <button type="button" class="btn btn-outline-primary" data-direction="target-native">
                            Англ → Рус(звук)
                        </button>
                    </div>
                </div>

                <div class="mb-4">
                    <h6 class="text-info mb-3">
                        <i class="bi bi-arrow-repeat me-2"></i>Режим "Оба направления"
                    </h6>
                    <div class="btn-group w-100" role="group">
                        <button type="button" class="btn btn-outline-success" data-direction="target-native-both">
                            Англ(звук) → Рус(звук)
                        </button>
                        <button type="button" class="btn btn-outline-success" data-direction="native-target-both">
                            Рус(звук) → Англ(звук)
                        </button>
                    </div>
                </div>

                <div class="mb-4">
                    <h6 class="text-info mb-3">
                        <i class="bi bi-shuffle me-2"></i>Порядок фраз
                    </h6>
                    <div class="btn-group w-100" role="group">
                        <button type="button" class="btn btn-outline-warning active" data-order="sequential">
                            По порядку
                        </button>
                        <button type="button" class="btn btn-outline-warning" data-order="random">
                            Случайный
                        </button>
                    </div>
                </div>

                <div class="mb-4">
                    <h6 class="text-info mb-3">
                        <i class="bi bi-repeat me-2"></i>Повтор блока
                    </h6>
                    <div class="btn-group repeat-block" role="group">
                        <select class="form-select bg-dark text-light border-secondary" id="repeatLength">
                            <option value="1">1</option>
                            <option value="5">5</option>
                            <option value="10">10</option>
                            <option value="15">15</option>
                            <option value="20">20</option>
                        </select>
                        <span>фраз по</span>
                        <select class="form-select bg-dark text-light border-secondary numeral-source" id="repeatCount">
                            <option value="0">0</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                        </select>
                        <span data-pattern="раз[у,a,]" class="numeral-target">раз</span>
                    </div>
                </div>

                <div class="mb-4">
                    <h6 class="text-info mb-3">
                        <i class="bi bi-gender-ambiguous me-2"></i>Гендер голоса
                    </h6>
                    <div class="btn-group repeat-block" role="group">
                        <select class="form-select bg-dark text-light border-secondary" id="genderVoice">
                            <option value="male">Мужской</option>
                            <option value="female">Женский</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="modal-footer border-secondary">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Закрыть</button>
                <button type="button" class="btn btn-primary" id="applySettings">
                    <i class="bi bi-check-circle me-1"></i>Применить
                </button>
            </div>
        </div>
    </div>
</div>

<!-- Header -->
<header class="text-center mb-1">
    <h1 class="display-4 text-gradient app-name">
        <i class="bi bi-translate text-primary"></i>
        <?php echo APP_NAME;?>
    </h1>
</header>

<!-- Main Container -->
<div class="container py-6">

    <!-- Main Content -->
    <div class="row app-display">
        <!-- Left Column - Phrase Card -->
        <div class="col-lg-12">
            <div class="card bg-dark-gradient border-primary border-3 animate-card">

                <div class="tv-screen">
                    <div class="water-effect">
                        <div class="water-drops">
                            <div class="drop"></div>
                            <div class="drop"></div>
                            <div class="drop"></div>
                            <div class="drop"></div>
                            <div class="drop"></div>
                            <div class="drop"></div>
                            <div class="drop"></div>
                            <div class="drop"></div>
                        </div>
                        
                        <div class="water-highlights">
                            <div class="highlight highlight-1"></div>
                            <div class="highlight highlight-2"></div>
                        </div>
                    </div>
                    <div class="scan-line"></div>
                </div>

                <div class="card-body text-center p-4">

                    <div>
                        <div class="phrase-container animate-text">
                            <div class="scale-block">
                                <div class="phrase-text mb-2 animate-text phrase" id="phraseText">
                                </div>
                                <div class="phrase-hint text-muted animate-hint phrase" id="phraseHint">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="phrase-type-container">
                        <span id="phraseType">Past Simple (активный)</span>
                    </div>

                    <div class="progress mb-2 control" style="height: 6px;" id="progressControl">
                        <div class="progress-bar bg-primary progress-bar-striped" 
                             id="progressBar" style="width: 0%"></div>
                    </div>

                    <div class="d-flex justify-content-between align-items-center">
                        <div class="text-start">
                            <div class="text-muted small">Прогресс</div>
                            <div id="phraseCounter">0 / 0</div>
                            <div id="currentRepeat" class="text-muted small" style="position:absolute;"></div>
                        </div>
                        <div>
                            <span id="payerMessage"></span>
                        </div>
                        <div class="text-end">
                            <button class="btn btn-outline-secondary control" id="settingsToggle">
                                <i class="bi bi-sliders"></i>
                            </button>
                        </div>
                    </div>

                    <div class="play-container">
                        <div class="play-buttons" id="playButtonsContainer">
                            <button type="button" class="btn" id="prevBtn" title="Предыдущая фраза">
                                <i class="bi bi-skip-backward-fill"></i>
                            </button>
                            <button type="button" class="btn" id="playButton" title="Воспроизвести/Пауза">
                                <i class="bi bi-play-fill"></i>
                            </button>
                            <button type="button" class="btn" id="nextBtn" title="Следующая фраза">
                                <i class="bi bi-skip-forward-fill"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div id="other-content">
        <?if (DEV) {?>
        <a href="?page=userlists" class="btn btn-sm btn-outline-secondary floating-button">
            <i class="bi bi-pencil"></i>
        </a>
        <?}?>
        <div class="list-view">
            
        </div>
    </div>
</div>

<!-- Footer -->
<footer class="mt-2 pt-2 border-top border-secondary text-center text-muted">
    <p class="small">
        English Phrases Trainer v<?php echo APP_VERSION; ?> | <a class="link" onclick="showAdvices()">Помощь</a>
    </p>
</footer>

<script type="text/javascript">
    var SPEECH_CONFIG = <?=SPEECH_CONFIG?>;
    <?if (isset(Page::$request['SPEECH_CONFIG'])) {?>
        Object.assign(SPEECH_CONFIG, <?=Page::$request['SPEECH_CONFIG']?>);
    <?}?>
    var phrasesData = <?=json_encode(PhrasesModel::getPhrasesAsJsonWithDifficulty(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_NUMERIC_CHECK);?>;

    $('.numeral-source').numeral(false);

    function showAdvices() {
        appAlert([
            `<p>Для эффективного запоминания и доведения речевых навыков до автоматизма рекомендуем чередовать последовательность воспроизведения русской и английской версий фраз.</p><p>Так вы будете тренировать не только автоматизм произношения, но и скоростное восприятие речи на слух.</p>`,

            `<p>В настройках вы найдёте все необходимые для этого параметры: паузу между фразами, последовательность перевода, различные варианты озвучки, повторы и др.</p>
            <p>Рекомендуем повторять английские фразы вслед за диктором — это важно! Так вы формируете речевую моторику.</p>`,

            `<p>Выбирайте в настройках режим «Оба направления».</p>
            <p>В этом режиме:
            <ul>
                <li>Сначала прослушайте фразу на русском и попытайтесь вслух произнести её перевод на английский до того, как зазвучит голос диктора.</li>
                <li>Затем прослушайте правильный перевод и снова повторите фразу за диктором.</li>
            </ul>
            </p>`,


            `<p>Если не успеваете, увеличьте паузу между фразами в настройках приложения.</p>
            <p>Можно также сменить направление на «Английский → Русский».</p><p>В этом случае:
            <ul>
                <li>Прослушайте фразу на английском и попытайтесь перевести её на русский вслух до озвучки диктором.</li>
                <li>Затем слушайте правильный перевод.</li>
            </ul>
            </p><p>Так вы будете развивать навык понимания английской речи на слух.</p>`,

            `<p>Включите в настройках режим "Распознавание речи".</p>
            <p>Так вы сможете контролировать свое произношение, а также отслеживать свой прогресс обучения.
            </p>
            <p>Делитесь своим опытом, пишите пожелания и предложения по работе тренажёра в нашей группе.</p>
            <hr>
            <p><span class="bi bi-award me-2"><span> Успешного обучения!</p>`
        ], 'Помощь, советы и рекомендации');
    }
<?if (DEV) {?>
    $(window).ready(showAdvices);
<?}?>
</script>
<script src="scripts/speech-synthesizer.js?v=<?=$v?>"></script>
<script src="scripts/state-manager.js?v=<?=$v?>"></script>
<script src="scripts/player-controls.js?v=<?=$v?>"></script>
<!--<script src="scripts/headphone-controls.js?v=<?=$v?>"></script>-->
<script src="scripts/phrases-list-view.js?v=<?=$v?>"></script>
<script src="scripts/app.js?v=<?=$v?>"></script>
<script src="scripts/sound.js?v=<?=$v?>"></script>
<script src="scripts/vrecognition.js?v=<?=$v?>"></script>