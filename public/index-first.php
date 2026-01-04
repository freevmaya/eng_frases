<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Изучение английских фраз с озвучкой</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        body {
            background: linear-gradient(135deg, #1a2a6c, #b21f1f, #fdbb2d);
            color: #333;
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background-color: rgba(255, 255, 255, 0.95);
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            overflow: hidden;
        }
        
        header {
            background: linear-gradient(90deg, #2c3e50, #4a6491);
            color: white;
            padding: 25px;
            text-align: center;
        }
        
        h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
        }
        
        .subtitle {
            font-size: 1.2rem;
            opacity: 0.9;
        }
        
        .main-content {
            display: flex;
            flex-wrap: wrap;
            padding: 20px;
        }
        
        .card-section {
            flex: 1;
            min-width: 300px;
            padding: 20px;
        }
        
        .control-section {
            flex: 1;
            min-width: 300px;
            padding: 20px;
            background-color: #f8f9fa;
            border-radius: 10px;
            margin-left: 20px;
        }
        
        @media (max-width: 768px) {
            .main-content {
                flex-direction: column;
            }
            
            .control-section {
                margin-left: 0;
                margin-top: 20px;
            }
        }
        
        .phrase-card {
            background-color: white;
            border-radius: 10px;
            padding: 40px 30px;
            text-align: center;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
            min-height: 300px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            transition: all 0.3s ease;
            border: 3px solid #4a6491;
        }
        
        .phrase-card.showing-russian {
            background-color: #f0f7ff;
        }
        
        .phrase-card.showing-english {
            background-color: #fff8f0;
        }
        
        .phrase-text {
            font-size: 2rem;
            margin-bottom: 20px;
            line-height: 1.4;
            min-height: 120px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .phrase-hint {
            font-size: 1.2rem;
            color: #666;
            margin-top: 10px;
            font-style: italic;
        }
        
        .card-footer {
            margin-top: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .card-counter {
            font-size: 1.2rem;
            color: #4a6491;
            font-weight: bold;
        }
        
        .card-type {
            background-color: #4a6491;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.9rem;
        }
        
        .controls {
            margin-bottom: 30px;
        }
        
        .control-group {
            margin-bottom: 25px;
        }
        
        .control-title {
            font-size: 1.3rem;
            margin-bottom: 15px;
            color: #2c3e50;
            border-bottom: 2px solid #4a6491;
            padding-bottom: 5px;
        }
        
        .slider-container {
            margin-bottom: 20px;
        }
        
        .slider-label {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }
        
        .slider-value {
            font-weight: bold;
            color: #4a6491;
        }
        
        input[type="range"] {
            width: 100%;
            height: 10px;
            border-radius: 5px;
            background: #ddd;
            outline: none;
            -webkit-appearance: none;
        }
        
        input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background: #4a6491;
            cursor: pointer;
        }
        
        .button-group {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 10px;
        }
        
        .btn {
            padding: 12px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1rem;
            font-weight: 600;
            transition: all 0.2s;
        }
        
        .btn-primary {
            background-color: #4a6491;
            color: white;
        }
        
        .btn-primary:hover {
            background-color: #3a5479;
            transform: translateY(-2px);
        }
        
        .btn-secondary {
            background-color: #6c757d;
            color: white;
        }
        
        .btn-secondary:hover {
            background-color: #5a6268;
            transform: translateY(-2px);
        }
        
        .btn-success {
            background-color: #28a745;
            color: white;
        }
        
        .btn-success:hover {
            background-color: #218838;
            transform: translateY(-2px);
        }
        
        .btn-danger {
            background-color: #dc3545;
            color: white;
        }
        
        .btn-danger:hover {
            background-color: #c82333;
            transform: translateY(-2px);
        }
        
        .select-group {
            margin-bottom: 20px;
        }
        
        select {
            width: 100%;
            padding: 12px;
            border-radius: 8px;
            border: 2px solid #ccc;
            font-size: 1rem;
            background-color: white;
        }
        
        .playback-status {
            background-color: #e9ecef;
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
            text-align: center;
            font-weight: bold;
            color: #4a6491;
            border-left: 5px solid #4a6491;
        }
        
        .status-active {
            background-color: #d4edda;
            border-left-color: #28a745;
            color: #155724;
        }
        
        .status-paused {
            background-color: #fff3cd;
            border-left-color: #ffc107;
            color: #856404;
        }
        
        footer {
            text-align: center;
            padding: 20px;
            color: #666;
            border-top: 1px solid #eee;
            font-size: 0.9rem;
        }
        
        .speaker-icon {
            font-size: 1.5rem;
            vertical-align: middle;
            margin-right: 5px;
        }
        
        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Изучение английских фраз</h1>
            <div class="subtitle">Активный и пассивный залог с озвучкой и настройками</div>
        </header>
        
        <div class="main-content">
            <div class="card-section">
                <div class="phrase-card" id="phraseCard">
                    <div class="phrase-text" id="phraseText">Нажмите "Начать" для изучения фраз</div>
                    <div class="phrase-hint" id="phraseHint">Здесь будет отображаться перевод</div>
                    
                    <div class="card-footer">
                        <div class="card-counter" id="phraseCounter">0 / 0</div>
                        <div class="card-type" id="phraseType">Не выбран</div>
                    </div>
                </div>
                
                <div class="button-group" style="margin-top: 30px; justify-content: center;">
                    <button class="btn btn-primary" id="startBtn">
                        <span class="speaker-icon">🔊</span> Начать
                    </button>
                    <button class="btn btn-secondary" id="pauseBtn">Пауза</button>
                    <button class="btn btn-success" id="nextBtn">Следующая</button>
                    <button class="btn btn-danger" id="stopBtn">Стоп</button>
                </div>
            </div>
            
            <div class="control-section">
                <div class="controls">
                    <div class="control-group">
                        <div class="control-title">Настройки воспроизведения</div>
                        
                        <div class="slider-container">
                            <div class="slider-label">
                                <span>Скорость речи:</span>
                                <span class="slider-value" id="speedValue">1.0</span>
                            </div>
                            <input type="range" id="speedSlider" min="0.5" max="2" step="0.1" value="1">
                        </div>
                        
                        <div class="slider-container">
                            <div class="slider-label">
                                <span>Пауза между фразами (сек):</span>
                                <span class="slider-value" id="pauseValue">3</span>
                            </div>
                            <input type="range" id="pauseSlider" min="1" max="10" step="0.5" value="3">
                        </div>
                        
                        <div class="slider-container">
                            <div class="slider-label">
                                <span>Пауза между языками (сек):</span>
                                <span class="slider-value" id="langPauseValue">2</span>
                            </div>
                            <input type="range" id="langPauseSlider" min="0.5" max="5" step="0.5" value="2">
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <div class="control-title">Выбор списка фраз</div>
                        <div class="select-group">
                            <select id="phraseListSelect">
                                <option value="all">Все фразы (смешанные)</option>
                                <option value="past_simple_active">Past Simple (активный залог)</option>
                                <option value="past_simple_passive">Past Simple (пассивный залог)</option>
                                <option value="future_simple_passive">Future Simple (пассивный залог)</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <div class="control-title">Направление перевода</div>
                        <div class="button-group">
                            <button class="btn btn-primary active-direction" id="ruToEnBtn">Русский → Английский</button>
                            <button class="btn btn-secondary" id="enToRuBtn">Английский → Русский</button>
                            <button class="btn btn-secondary" id="bothBtn">Оба направления</button>
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <div class="control-title">Порядок фраз</div>
                        <div class="button-group">
                            <button class="btn btn-primary" id="sequentialBtn">По порядку</button>
                            <button class="btn btn-secondary" id="randomBtn">Случайный порядок</button>
                        </div>
                    </div>
                    
                    <div class="playback-status" id="playbackStatus">
                        Воспроизведение не запущено
                    </div>
                </div>
            </div>
        </div>
        
        <footer>
            <p>Приложение для изучения английских фраз с озвучкой | Использует Web Speech API для синтеза речи</p>
        </footer>
    </div>

    <script>
        // Данные с фразами из предыдущего ответа
        const phrasesData = {
            past_simple_active: [
                {"english": "I worked yesterday.", "russian": "Я работал вчера."},
                {"english": "She studied all night.", "russian": "Она училась всю ночь."},
                {"english": "We watched a movie.", "russian": "Мы смотрели фильм."},
                {"english": "He called you an hour ago.", "russian": "Он звонил тебе час назад."},
                {"english": "They traveled to Spain last year.", "russian": "Они путешествовали в Испанию в прошлом году."},
                {"english": "It happened suddenly.", "russian": "Это случилось внезапно."},
                {"english": "I didn't like that food.", "russian": "Мне не понравилась эта еда."},
                {"english": "Did you see him?", "russian": "Ты видел его?"},
                {"english": "I was at home.", "russian": "Я был дома."},
                {"english": "She was very happy.", "russian": "Она была очень счастлива."}
            ],
            past_simple_passive: [
                {"english": "The letter was sent yesterday.", "russian": "Письмо было отправлено вчера."},
                {"english": "The house was built in 1990.", "russian": "Дом был построен в 1990 году."},
                {"english": "The window was broken.", "russian": "Окно было разбито."},
                {"english": "I was invited to the party.", "russian": "Я был приглашён на вечеринку."},
                {"english": "We were asked to help.", "russian": "Нас попросили помочь."},
                {"english": "The car was stolen last night.", "russian": "Машину угнали прошлой ночью."},
                {"english": "The book was written by a famous author.", "russian": "Книга была написана известным автором."},
                {"english": "English was spoken everywhere.", "russian": "На английском говорили повсюду."},
                {"english": "The decision was made quickly.", "russian": "Решение было принято быстро."},
                {"english": "The keys were found in the kitchen.", "russian": "Ключи были найдены на кухне."}
            ],
            future_simple_passive: [
                {"english": "The documents will be signed tomorrow.", "russian": "Документы будут подписаны завтра."},
                {"english": "You will be contacted soon.", "russian": "С вами свяжутся в ближайшее время."},
                {"english": "The results will be announced next week.", "russian": "Результаты будут объявлены на следующей неделе."},
                {"english": "A new park will be built here.", "russian": "Здесь будет построен новый парк."},
                {"english": "Dinner will be served at 7 PM.", "russian": "Ужин будет подан в 7 вечера."},
                {"english": "I will be met at the airport.", "russian": "Меня встретят в аэропорту."},
                {"english": "The problem will be solved.", "russian": "Проблема будет решена."},
                {"english": "All employees will be informed.", "russian": "Все сотрудники будут проинформированы."},
                {"english": "The car will be repaired by Friday.", "russian": "Машина будет отремонтирована к пятнице."},
                {"english": "This song will be heard everywhere.", "russian": "Эту песню будут слышать повсюду."}
            ]
        };

        // Состояние приложения
        const state = {
            currentPhraseIndex: 0,
            currentPhraseList: [],
            isPlaying: false,
            isPaused: false,
            direction: 'ru-en', // ru-en, en-ru, both
            order: 'sequential', // sequential, random
            currentListType: 'all',
            speed: 1.0,
            pauseBetweenPhrases: 3,
            pauseBetweenLanguages: 2,
            timeoutId: null,
            showingFirstLang: true,
            currentPhrase: null
        };

        // DOM элементы
        const phraseText = document.getElementById('phraseText');
        const phraseHint = document.getElementById('phraseHint');
        const phraseCounter = document.getElementById('phraseCounter');
        const phraseType = document.getElementById('phraseType');
        const phraseCard = document.getElementById('phraseCard');
        const playbackStatus = document.getElementById('playbackStatus');
        
        // Кнопки управления
        const startBtn = document.getElementById('startBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const nextBtn = document.getElementById('nextBtn');
        const stopBtn = document.getElementById('stopBtn');
        
        // Слайдеры настроек
        const speedSlider = document.getElementById('speedSlider');
        const pauseSlider = document.getElementById('pauseSlider');
        const langPauseSlider = document.getElementById('langPauseSlider');
        const speedValue = document.getElementById('speedValue');
        const pauseValue = document.getElementById('pauseValue');
        const langPauseValue = document.getElementById('langPauseValue');
        
        // Выбор списка фраз
        const phraseListSelect = document.getElementById('phraseListSelect');
        
        // Кнопки направления
        const ruToEnBtn = document.getElementById('ruToEnBtn');
        const enToRuBtn = document.getElementById('enToRuBtn');
        const bothBtn = document.getElementById('bothBtn');
        
        // Кнопки порядка
        const sequentialBtn = document.getElementById('sequentialBtn');
        const randomBtn = document.getElementById('randomBtn');

        // Инициализация приложения
        function init() {
            // Загружаем начальный список фраз
            loadPhraseList();
            
            // Устанавливаем обработчики событий для слайдеров
            speedSlider.addEventListener('input', function() {
                state.speed = parseFloat(this.value);
                speedValue.textContent = state.speed.toFixed(1);
            });
            
            pauseSlider.addEventListener('input', function() {
                state.pauseBetweenPhrases = parseFloat(this.value);
                pauseValue.textContent = state.pauseBetweenPhrases;
            });
            
            langPauseSlider.addEventListener('input', function() {
                state.pauseBetweenLanguages = parseFloat(this.value);
                langPauseValue.textContent = state.pauseBetweenLanguages;
            });
            
            // Обработчики для кнопок управления
            startBtn.addEventListener('click', startPlayback);
            pauseBtn.addEventListener('click', togglePause);
            nextBtn.addEventListener('click', nextPhrase);
            stopBtn.addEventListener('click', stopPlayback);
            
            // Обработчики для выбора списка фраз
            phraseListSelect.addEventListener('change', function() {
                state.currentListType = this.value;
                loadPhraseList();
                if (state.isPlaying) {
                    stopPlayback();
                }
                updateDisplay();
            });
            
            // Обработчики для кнопок направления
            ruToEnBtn.addEventListener('click', function() {
                setDirection('ru-en');
            });
            
            enToRuBtn.addEventListener('click', function() {
                setDirection('en-ru');
            });
            
            bothBtn.addEventListener('click', function() {
                setDirection('both');
            });
            
            // Обработчики для кнопок порядка
            sequentialBtn.addEventListener('click', function() {
                setOrder('sequential');
            });
            
            randomBtn.addEventListener('click', function() {
                setOrder('random');
            });
            
            // Инициализируем отображение
            updateDisplay();
        }

        // Загрузка списка фраз в зависимости от выбора
        function loadPhraseList() {
            if (state.currentListType === 'all') {
                // Смешиваем все фразы
                state.currentPhraseList = [
                    ...phrasesData.past_simple_active,
                    ...phrasesData.past_simple_passive,
                    ...phrasesData.future_simple_passive
                ];
                
                // Добавляем тип каждой фразе
                state.currentPhraseList.forEach((phrase, index) => {
                    if (index < phrasesData.past_simple_active.length) {
                        phrase.type = 'Past Simple (активный)';
                    } else if (index < phrasesData.past_simple_active.length + phrasesData.past_simple_passive.length) {
                        phrase.type = 'Past Simple (пассивный)';
                    } else {
                        phrase.type = 'Future Simple (пассивный)';
                    }
                });
            } else {
                state.currentPhraseList = phrasesData[state.currentListType].map(phrase => {
                    let type = '';
                    switch(state.currentListType) {
                        case 'past_simple_active': type = 'Past Simple (активный)'; break;
                        case 'past_simple_passive': type = 'Past Simple (пассивный)'; break;
                        case 'future_simple_passive': type = 'Future Simple (пассивный)'; break;
                    }
                    return {...phrase, type};
                });
            }
            
            // Применяем порядок
            if (state.order === 'random') {
                shuffleArray(state.currentPhraseList);
            }
            
            state.currentPhraseIndex = 0;
        }

        // Установка направления изучения
        function setDirection(direction) {
            state.direction = direction;
            
            // Обновляем активные кнопки
            ruToEnBtn.className = ruToEnBtn.className.replace('active-direction', '');
            enToRuBtn.className = enToRuBtn.className.replace('active-direction', '');
            bothBtn.className = bothBtn.className.replace('active-direction', '');
            
            switch(direction) {
                case 'ru-en':
                    ruToEnBtn.className += ' active-direction';
                    ruToEnBtn.classList.remove('btn-secondary');
                    ruToEnBtn.classList.add('btn-primary');
                    enToRuBtn.classList.remove('btn-primary');
                    enToRuBtn.classList.add('btn-secondary');
                    bothBtn.classList.remove('btn-primary');
                    bothBtn.classList.add('btn-secondary');
                    break;
                case 'en-ru':
                    enToRuBtn.className += ' active-direction';
                    enToRuBtn.classList.remove('btn-secondary');
                    enToRuBtn.classList.add('btn-primary');
                    ruToEnBtn.classList.remove('btn-primary');
                    ruToEnBtn.classList.add('btn-secondary');
                    bothBtn.classList.remove('btn-primary');
                    bothBtn.classList.add('btn-secondary');
                    break;
                case 'both':
                    bothBtn.className += ' active-direction';
                    bothBtn.classList.remove('btn-secondary');
                    bothBtn.classList.add('btn-primary');
                    ruToEnBtn.classList.remove('btn-primary');
                    ruToEnBtn.classList.add('btn-secondary');
                    enToRuBtn.classList.remove('btn-primary');
                    enToRuBtn.classList.add('btn-secondary');
                    break;
            }
        }

        // Установка порядка фраз
        function setOrder(order) {
            state.order = order;
            
            // Обновляем активные кнопки
            sequentialBtn.classList.remove('btn-primary');
            sequentialBtn.classList.add('btn-secondary');
            randomBtn.classList.remove('btn-primary');
            randomBtn.classList.add('btn-secondary');
            
            if (order === 'sequential') {
                sequentialBtn.classList.remove('btn-secondary');
                sequentialBtn.classList.add('btn-primary');
            } else {
                randomBtn.classList.remove('btn-secondary');
                randomBtn.classList.add('btn-primary');
            }
            
            // Перезагружаем список фраз с новым порядком
            loadPhraseList();
            updateDisplay();
        }

        // Начать воспроизведение
        function startPlayback() {
            if (state.currentPhraseList.length === 0) {
                alert('Список фраз пуст!');
                return;
            }
            
            state.isPlaying = true;
            state.isPaused = false;
            state.showingFirstLang = true;
            
            updatePlaybackStatus();
            playCurrentPhrase();
        }

        // Переключить паузу
        function togglePause() {
            if (!state.isPlaying) return;
            
            state.isPaused = !state.isPaused;
            
            if (state.isPaused) {
                clearTimeout(state.timeoutId);
            } else {
                playCurrentPhrase();
            }
            
            updatePlaybackStatus();
        }

        // Следующая фраза
        function nextPhrase() {
            if (!state.isPlaying) {
                // Если воспроизведение не запущено, просто показываем следующую фразу
                state.currentPhraseIndex = (state.currentPhraseIndex + 1) % state.currentPhraseList.length;
                updateDisplay();
                return;
            }
            
            // Если воспроизведение запущено, переходим к следующей фразе
            clearTimeout(state.timeoutId);
            
            if (state.direction === 'both' && !state.showingFirstLang) {
                // Если показывали вторую часть фразы, переходим к следующей фразе
                state.currentPhraseIndex = (state.currentPhraseIndex + 1) % state.currentPhraseList.length;
                state.showingFirstLang = true;
            } else if (state.direction !== 'both') {
                // Если показывали только один язык, переходим к следующей фразе
                state.currentPhraseIndex = (state.currentPhraseIndex + 1) % state.currentPhraseList.length;
            }
            
            playCurrentPhrase();
        }

        // Остановить воспроизведение
        function stopPlayback() {
            state.isPlaying = false;
            state.isPaused = false;
            clearTimeout(state.timeoutId);
            updatePlaybackStatus();
            updateDisplay();
        }

        // Воспроизвести текущую фразу
        function playCurrentPhrase() {
            if (!state.isPlaying || state.isPaused) return;
            
            if (state.currentPhraseIndex >= state.currentPhraseList.length) {
                state.currentPhraseIndex = 0;
            }
            
            state.currentPhrase = state.currentPhraseList[state.currentPhraseIndex];
            updateDisplay();
            
            // Определяем, что показывать и озвучивать в зависимости от направления
            let textToShow = '';
            let textToSpeak = '';
            let isEnglish = false;
            
            if (state.direction === 'both') {
                if (state.showingFirstLang) {
                    textToShow = state.currentPhrase.russian;
                    textToSpeak = state.currentPhrase.russian;
                    phraseCard.className = 'phrase-card showing-russian';
                    phraseHint.textContent = 'Слушайте русский вариант';
                    isEnglish = false;
                } else {
                    textToShow = state.currentPhrase.english;
                    textToSpeak = state.currentPhrase.english;
                    phraseCard.className = 'phrase-card showing-english';
                    phraseHint.textContent = 'Слушайте английский вариант';
                    isEnglish = true;
                }
            } else if (state.direction === 'ru-en') {
                textToShow = state.currentPhrase.russian;
                textToSpeak = state.currentPhrase.english;
                phraseCard.className = 'phrase-card showing-russian';
                phraseHint.textContent = 'Слушайте английский перевод';
                isEnglish = true;
            } else { // en-ru
                textToShow = state.currentPhrase.english;
                textToSpeak = state.currentPhrase.russian;
                phraseCard.className = 'phrase-card showing-english';
                phraseHint.textContent = 'Слушайте русский перевод';
                isEnglish = false;
            }
            
            phraseText.textContent = textToShow;
            
            // Озвучиваем фразу
            speakText(textToSpeak, isEnglish);
            
            // Устанавливаем таймер для следующего действия
            let delay = 0;
            
            if (state.direction === 'both') {
                if (state.showingFirstLang) {
                    // Пауза перед показом второго языка
                    delay = state.pauseBetweenLanguages * 1000;
                    state.timeoutId = setTimeout(() => {
                        state.showingFirstLang = false;
                        playCurrentPhrase();
                    }, delay);
                } else {
                    // Пауза перед следующей фразой
                    delay = state.pauseBetweenPhrases * 1000;
                    state.timeoutId = setTimeout(() => {
                        state.currentPhraseIndex = (state.currentPhraseIndex + 1) % state.currentPhraseList.length;
                        state.showingFirstLang = true;
                        playCurrentPhrase();
                    }, delay);
                }
            } else {
                // Пауза перед следующей фразой
                delay = state.pauseBetweenPhrases * 1000;
                state.timeoutId = setTimeout(() => {
                    state.currentPhraseIndex = (state.currentPhraseIndex + 1) % state.currentPhraseList.length;
                    playCurrentPhrase();
                }, delay);
            }
        }

        // Озвучивание текста с помощью Web Speech API
        function speakText(text, isEnglish = true) {
            if (!('speechSynthesis' in window)) {
                console.warn('Web Speech API не поддерживается в этом браузере');
                phraseHint.textContent = 'Озвучка не поддерживается вашим браузером';
                return;
            }
            
            // Отменяем текущее озвучивание
            speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            
            // Устанавливаем язык и голос
            if (isEnglish) {
                utterance.lang = 'en-US';
                utterance.rate = state.speed;
                
                // Пытаемся найти английский голос
                const voices = speechSynthesis.getVoices();
                const englishVoice = voices.find(voice => voice.lang.startsWith('en'));
                if (englishVoice) {
                    utterance.voice = englishVoice;
                }
            } else {
                utterance.lang = 'ru-RU';
                utterance.rate = state.speed * 0.9; // Немного медленнее для русского
                
                // Пытаемся найти русский голос
                const voices = speechSynthesis.getVoices();
                const russianVoice = voices.find(voice => voice.lang.startsWith('ru'));
                if (russianVoice) {
                    utterance.voice = russianVoice;
                }
            }
            
            // Начинаем озвучивание
            speechSynthesis.speak(utterance);
        }

        // Обновить отображение
        function updateDisplay() {
            if (state.currentPhraseList.length === 0) {
                phraseText.textContent = 'Список фраз пуст';
                phraseHint.textContent = 'Выберите список фраз для изучения';
                phraseCounter.textContent = '0 / 0';
                phraseType.textContent = 'Не выбран';
                return;
            }
            
            if (!state.currentPhrase && state.currentPhraseList.length > 0) {
                state.currentPhrase = state.currentPhraseList[0];
            }
            
            if (state.currentPhrase) {
                if (!state.isPlaying) {
                    // Если не воспроизводим, показываем русскую фразу
                    phraseText.textContent = state.currentPhrase.russian;
                    phraseHint.textContent = state.currentPhrase.english;
                    phraseCard.className = 'phrase-card';
                }
                
                phraseCounter.textContent = `${state.currentPhraseIndex + 1} / ${state.currentPhraseList.length}`;
                phraseType.textContent = state.currentPhrase.type || 'Не указан';
            }
        }

        // Обновить статус воспроизведения
        function updatePlaybackStatus() {
            playbackStatus.className = 'playback-status';
            
            if (state.isPlaying) {
                if (state.isPaused) {
                    playbackStatus.textContent = 'Воспроизведение приостановлено';
                    playbackStatus.className += ' status-paused';
                } else {
                    playbackStatus.textContent = `Воспроизведение: ${state.currentPhraseIndex + 1} из ${state.currentPhraseList.length}`;
                    playbackStatus.className += ' status-active';
                }
            } else {
                playbackStatus.textContent = 'Воспроизведение не запущено';
            }
        }

        // Вспомогательная функция: перемешать массив
        function shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        }

        // Инициализация при загрузке страницы
        document.addEventListener('DOMContentLoaded', init);
        
        // Инициализация голосов для Web Speech API
        if ('speechSynthesis' in window) {
            speechSynthesis.onvoiceschanged = function() {
                // Голоса загружены
            };
        }
    </script>
</body>
</html>