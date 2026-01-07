<?php
require_once '../config.php';
$v = 5;
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo APP_NAME; ?></title>
    
    <!-- Bootstrap 5 -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
    <!-- Custom CSS -->
    <link rel="stylesheet" href="css/style.css?v=<?=$v?>">
    <link rel="stylesheet" href="css/style-waves.css?v=<?=$v?>">
</head>
<body class="dark-theme">
    <!-- Settings Modal -->
    <div class="modal fade" id="settingsModal" tabindex="-1" aria-labelledby="settingsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content bg-dark">
                <div class="modal-header border-secondary">
                    <h5 class="modal-title text-primary" id="settingsModalLabel">
                        <i class="bi bi-gear me-2"></i>Настройки
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">

                    <div class="mb-4">
                        <h6 class="text-info mb-3">
                            <i class="bi bi-tv me-2"></i>Эффекты отображения
                        </h6>
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="tvScreenToggle" checked>
                            <label class="form-check-label" for="tvScreenToggle">
                                Показывать TV-экран
                            </label>
                        </div>
                    </div>
                    <div class="mb-4">
                        <h6 class="text-info mb-3">
                            <i class="bi bi-speedometer2 me-2"></i>Скорость воспроизведения
                        </h6>
                        <div class="d-flex align-items-center">
                            <i class="bi bi-turtle text-muted me-2"></i>
                            <input type="range" class="form-range" id="speedSlider" min="0.5" max="2" step="0.1" value="1.0">
                            <i class="bi bi-rabbit text-muted ms-2"></i>
                        </div>
                        <div class="text-center mt-2">
                            <span class="badge bg-primary" id="speedValue">1.0x</span>
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
                            <i class="bi bi-translate me-2"></i>Пауза между языками
                        </h6>
                        <input type="range" class="form-range" id="langPauseSlider" min="0.5" max="5" step="0.5" value="2">
                        <div class="text-center mt-2">
                            <span class="badge bg-primary" id="langPauseValue">2 сек</span>
                        </div>
                    </div>

                    <div class="mb-4">
                        <h6 class="text-info mb-3">
                            <i class="bi bi-card-checklist me-2"></i>Выбор списка фраз
                        </h6>
                        <select class="form-select bg-dark text-light border-secondary" id="phraseListSelect">
                            <option value="all">Все фразы (смешанные)</option>
                            <option value="past_simple_active">Past Simple (активный залог)</option>
                            <option value="past_simple_passive">Past Simple (пассивный залог)</option>
                            <option value="future_simple_passive">Future Simple (пассивный залог)</option>
                        </select>
                    </div>

                    <div class="mb-4">
                        <h6 class="text-info mb-3">
                            <i class="bi bi-arrow-left-right me-2"></i>Направление перевода
                        </h6>
                        <div class="btn-group w-100" role="group">
                            <button type="button" class="btn btn-outline-primary active" data-direction="ru-en">
                                Русский → Английский
                            </button>
                            <button type="button" class="btn btn-outline-primary" data-direction="en-ru">
                                Английский → Русский
                            </button>
                        </div>
                    </div>

                    <div class="mb-4">
                        <h6 class="text-info mb-3">
                            <i class="bi bi-arrow-repeat me-2"></i>Режим "Оба направления"
                        </h6>
                        <div class="btn-group w-100" role="group">
                            <button type="button" class="btn btn-outline-success" data-direction="en-ru-both">
                                Англ → Рус → Пауза
                            </button>
                            <button type="button" class="btn btn-outline-success" data-direction="ru-en-both">
                                Рус → Англ → Пауза
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

    <!-- Main Container -->
    <div class="container py-4">
        <!-- Header -->
        <header class="text-center mb-3">
            <h1 class="display-4 text-gradient mb-3">
                <i class="bi bi-translate text-primary"></i>
                <?php echo APP_NAME; ?>
            </h1>
        </header>

        <!-- Main Content -->
        <div class="row">
            <!-- Left Column - Phrase Card -->
            <div class="col-lg-12 mb-4">
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

                        <div>
                            <div class="phrase-container">
                                <div class="phrase-text mb-2 animate-text" id="phraseText">
                                </div>
                                <div class="phrase-hint text-muted animate-hint" id="phraseHint">
                                </div>
                            </div>
                        </div>

                        <div class="mb-2">
                            <span id="phraseType">Past Simple (активный)</span>
                        </div>

                        <div class="progress mb-2" style="height: 6px;">
                            <div class="progress-bar bg-primary progress-bar-striped progress-bar-animated" 
                                 id="progressBar" style="width: 0%"></div>
                        </div>

                        <div class="d-flex justify-content-between align-items-center">
                            <div class="text-start">
                                <div class="text-muted small">Прогресс</div>
                                <div class="h5" id="phraseCounter">0 / 0</div>
                            </div>
                            <div class="text-end">
                                <button class="btn btn-outline-secondary" id="settingsToggle">
                                    <i class="bi bi-sliders"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <footer class="mt-2 pt-4 border-top border-secondary text-center text-muted">
            <p class="small">
                English Phrases Trainer v<?php echo APP_VERSION; ?> 
                | Использует Web Speech API для синтеза речи
            </p>
        </footer>
    </div>

    <!-- Bootstrap & jQuery -->
    <script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    
    <!-- App Scripts -->
    <script type="text/javascript">
        var phrasesData = <?=file_get_contents('data/phrases.json');?>
    </script>
    <script src="scripts/speech-synthesizer.js?v=<?=$v?>"></script>
    <script src="scripts/state-manager.js?v=<?=$v?>"></script>
    <script src="scripts/player-controls.js?v=<?=$v?>"></script>
    <script src="scripts/app.js?v=<?=$v?>"></script>
    
    <!-- Eruda is console for mobile browsers-->
    <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
    <script>eruda.init();</script>
</body>
</html>