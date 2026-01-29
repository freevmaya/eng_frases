<?
    $lists = (new UserListsModel())->getItems(Page::getSession('user_id'));
    if (count($lists) > 0) {
        $lists[0]['selected'] = true;
        $phrases = (new UserPhrasesModel())->getItems($lists[0]['id'], 'list_id');
    }
    else $phrases = [];
?>
    <style>
        .compact-header .header-text {
            display: none;
        }
        
        @media (min-width: 600px) {
            .compact-header .header-text {
                display: inline;
            }
        }
        
        .header-controls {
            transition: all 0.3s ease;
        }

        .phrase-item td:last-child {
            text-align: right;
        }

        .phrase-item td {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 10em;
        }
        
        .phrase-item:hover {
            background-color: rgba(255, 255, 255, 0.05);
            cursor: pointer;
        }
        
        .active-indicator {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            display: inline-block;
            margin-right: 8px;
        }
        
        .active-indicator.active {
            background-color: #28a745;
        }
        
        .active-indicator.inactive {
            background-color: #dc3545;
        }
        
        .difficulty-badge {
            font-size: 0.75rem;
        }
        
        .modal-lg {
            max-width: 800px;
        }
    </style>
    <!-- Modal для редактирования списка -->
    <div class="modal fade" id="phraseListModal" tabindex="-1" aria-labelledby="phraseListModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content bg-dark">
                <div class="modal-header border-secondary">
                    <h5 class="modal-title text-primary" id="phraseListModalLabel">
                        <i class="bi bi-list-ul me-2"></i>Список фраз
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <form id="phraseListForm">
                        <div class="mb-3">
                            <label for="listName" class="form-label">Название списка</label>
                            <input type="text" class="form-control bg-dark text-light border-secondary" 
                                   id="listName" required>
                        </div>
                        <div class="mb-3">
                            <label for="listDescription" class="form-label">Описание списка</label>
                            <textarea class="form-control bg-dark text-light border-secondary" 
                                      id="listDescription" rows="3"></textarea>
                        </div>
                        <div class="form-check form-switch mb-3">
                            <input class="form-check-input" type="checkbox" id="listIsActive" checked>
                            <label class="form-check-label" for="listIsActive">
                                Активный список
                            </label>
                        </div>
                        <input type="hidden" id="listId">
                    </form>
                </div>
                <div class="modal-footer border-secondary">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                    <button type="button" class="btn btn-primary" id="saveListBtn">
                        <i class="bi bi-save me-1"></i>Сохранить
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal для редактирования фразы -->
    <div class="modal fade" id="phraseModal" tabindex="-1" aria-labelledby="phraseModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-lg">
            <div class="modal-content bg-dark">
                <div class="modal-header border-secondary">
                    <h5 class="modal-title text-primary" id="phraseModalLabel">
                        <i class="bi bi-chat-text me-2"></i>Фраза
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <form id="phraseForm">
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="targetText" class="form-label">Фраза на английском</label>
                                <textarea class="form-control bg-dark text-light border-secondary" 
                                          id="targetText" rows="3" required></textarea>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="nativeText" class="form-label">Фраза на русском</label>
                                <textarea class="form-control bg-dark text-light border-secondary" 
                                          id="nativeText" rows="3" required></textarea>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label for="context" class="form-label">Контекст применения</label>
                            <textarea class="form-control bg-dark text-light border-secondary" 
                                      id="context" rows="2"></textarea>
                        </div>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="difficultyLevel" class="form-label">Уровень сложности</label>
                                <select class="form-select bg-dark text-light border-secondary" id="difficultyLevel">
                                    <option value="1">Начальный</option>
                                    <option value="2" selected>Средний</option>
                                    <option value="3">Продвинутый</option>
                                </select>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label d-block">Статус</label>
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input" type="radio" name="phraseIsActive" id="phraseActive" value="true" checked>
                                    <label class="form-check-label" for="phraseActive">
                                        Активна
                                    </label>
                                </div>
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input" type="radio" name="phraseIsActive" id="phraseInactive" value="false">
                                    <label class="form-check-label" for="phraseInactive">
                                        Неактивна
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label for="phraseListSelect" class="form-label">Список фраз</label>
                            <select class="form-select bg-dark text-light border-secondary" id="phraseListSelect" required>
                                <option value="">Выберите список...</option>
                            </select>
                        </div>
                        <input type="hidden" id="phraseId">
                    </form>
                </div>
                <div class="modal-footer border-secondary">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                    <button type="button" class="btn btn-primary" id="savePhraseBtn">
                        <i class="bi bi-save me-1"></i>Сохранить
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Header -->
    <header class="text-center mb-1 compact-header" id="mainHeader">
        <div class="container">
            <div class="d-flex justify-content-between align-items-center header-controls">
                <div>
                    <button class="btn btn-outline-secondary" id="backBtn" title="Назад">
                        <i class="bi bi-arrow-left"></i>
                        <span class="header-text ms-1">Назад</span>
                    </button>
                </div>
                <div>
                    <h1 class="display-6 text-gradient app-name">
                        <i class="bi bi-pencil-square text-primary"></i>
                        <span class="header-text">Редактор фраз</span>
                    </h1>
                </div>
                <div>
                    <button class="btn btn-outline-info" id="helpBtn" title="Помощь">
                        <i class="bi bi-question-circle"></i>
                        <span class="header-text ms-1">Помощь</span>
                    </button>
                </div>
            </div>
        </div>
    </header>

    <!-- Main Container -->
    <div class="container py-4">
        <div class="row">
            <!-- Left Column - User Lists -->
            <div class="col-lg-6 mb-4">
                <div class="card bg-dark-gradient border-primary border-3 h-100">
                    <div class="card-header bg-dark border-secondary">
                        <div class="d-flex justify-content-between align-items-center">
                            <h5 class="card-title mb-0 text-info">
                                <i class="bi bi-folder me-2"></i>Пользовательские списки
                            </h5>
                            <button class="btn btn-sm btn-outline-secondary" id="addListBtn">
                                <i class="bi bi-plus-circle me-1"></i>Добавить
                            </button>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-dark table-hover mb-0">
                                <thead>
                                    <tr>
                                        <th>Статус</th>
                                        <th>Название</th>
                                        <th>Описание</th>
                                        <th>Действия</th>
                                    </tr>
                                </thead>
                                <tbody id="phraseListsTable">
                                    <!-- Данные будут загружены через JavaScript -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Column - Phrases -->
            <div class="col-lg-6 mb-4">
                <div class="card bg-dark-gradient border-primary border-3 h-100">
                    <div class="card-header bg-dark border-secondary">
                        <div class="d-flex justify-content-between align-items-center">
                            <h5 class="card-title mb-0 text-info">
                                <i class="bi bi-chat-text me-2"></i>Фразы
                            </h5>
                            <button class="btn btn-sm btn-outline-secondary" id="addPhraseBtn">
                                <i class="bi bi-plus-circle me-1"></i>Добавить
                            </button>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-dark table-hover mb-0">
                                <thead>
                                    <tr>
                                        <th>Статус</th>
                                        <th>Английский</th>
                                        <th>Русский</th>
                                        <th>Сложность</th>
                                        <th>Дата</th>
                                        <th>Действия</th>
                                    </tr>
                                </thead>
                                <tbody id="phrasesTable">
                                    <!-- Данные будут загружены через JavaScript -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <footer class="mt-4 pt-3 border-top border-secondary text-center text-muted">
            <p class="small">
                English Phrases Trainer v1.0.2 - Редактор фраз
            </p>
        </footer>
    </div>

    <script>
        $(document).ready(function() {
            // Данные для демонстрации
            let phraseLists = <?=json_encode($lists, JSON_FLAGS)?>;
            let phrases = <?=json_encode($phrases, JSON_FLAGS)?>;

            let currentFilter = phraseLists.length > 0 ? phraseLists[0].id : 0;

            // Загрузка списков фраз в таблицу
            function loadPhraseLists() {
                const tbody = $('#phraseListsTable');
                tbody.empty();
                
                phraseLists.forEach(list => {
                    let selected = list['selected'] ? ' table-active' : '';
                    const row = `
                        <tr class="phrase-item${selected}" data-id="${list.id}">
                            <td>
                                <span class="active-indicator ${list.is_active ? 'active' : 'inactive'}"></span>
                            </td>
                            <td>${list.name}</td>
                            <td>${list.description || ''}</td>
                            <td>
                                <button class="btn btn-sm btn-outline-secondary edit-list-btn" data-id="${list.id}">
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger delete-list-btn" data-id="${list.id}">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                    tbody.append(row);
                });
                
                // Обновление select в фильтре и модальном окне
                updateListSelects();
            }

            // Загрузка фраз в таблицу
            function loadPhrases(filterListId = '') {
                const tbody = $('#phrasesTable');
                tbody.empty();
                
                const filteredPhrases = filterListId ? 
                    phrases.filter(p => p.list_id == filterListId) : 
                    phrases;
                
                filteredPhrases.forEach(phrase => {
                    const difficultyText = {
                        1: '<span class="badge bg-success difficulty-badge">Начальный</span>',
                        2: '<span class="badge bg-warning difficulty-badge">Средний</span>',
                        3: '<span class="badge bg-danger difficulty-badge">Продвинутый</span>'
                    }[phrase.difficulty_level];
                    
                    const listName = phraseLists.find(l => l.id == phrase.list_id)?.name || 'Неизвестно';
                    
                    const row = `
                        <tr class="phrase-item" data-id="${phrase.id}">
                            <td>
                                <span class="active-indicator ${phrase.is_active ? 'active' : 'inactive'}"></span>
                            </td>
                            <td>${phrase.target_text}</td>
                            <td>${phrase.native_text}</td>
                            <td>${difficultyText}</td>
                            <td>${phrase.updated_at}</td>
                            <td>
                                <button class="btn btn-sm btn-outline-secondary edit-phrase-btn" data-id="${phrase.id}">
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger delete-phrase-btn" data-id="${phrase.id}">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                    tbody.append(row);
                });
            }

            // Обновление select-списков
            function updateListSelects() {
                const modalSelect = $('#phraseListSelect');

                modalSelect.empty();
                modalSelect.append('<option value="">Выберите список...</option>');
                
                phraseLists.forEach(list => {
                    if (list.is_active) {
                        const option = `<option value="${list.id}">${list.name}</option>`;
                        modalSelect.append(option);
                    }
                });
            }

            // Открытие модального окна для добавления/редактирования списка
            function openPhraseListModal(listId = null) {
                const modal = $('#phraseListModal');
                const form = $('#phraseListForm')[0];
                
                if (listId) {
                    // Редактирование
                    const list = phraseLists.find(l => l.id == listId);
                    if (list) {
                        $('#phraseListModalLabel').html('<i class="bi bi-pencil-square me-2"></i>Редактировать список');
                        $('#listName').val(list.name);
                        $('#listDescription').val(list.description || '');
                        $('#listIsActive').prop('checked', list.is_active);
                        $('#listId').val(list.id);
                    }
                } else {
                    // Добавление
                    $('#phraseListModalLabel').html('<i class="bi bi-plus-circle me-2"></i>Добавить список');
                    form.reset();
                    $('#listId').val('');
                }
                
                modal.modal('show');
            }

            // Открытие модального окна для добавления/редактирования фразы
            function openPhraseModal(phraseId = null) {
                const modal = $('#phraseModal');
                const form = $('#phraseForm')[0];
                
                if (phraseId) {
                    // Редактирование
                    const phrase = phrases.find(p => p.id == phraseId);
                    if (phrase) {
                        $('#phraseModalLabel').html('<i class="bi bi-pencil-square me-2"></i>Редактировать фразу');
                        $('#targetText').val(phrase.target_text);
                        $('#nativeText').val(phrase.native_text);
                        $('#context').val(phrase.context || '');
                        $('#difficultyLevel').val(phrase.difficulty_level);
                        $(`input[name="phraseIsActive"][value="${phrase.is_active}"]`).prop('checked', true);
                        $('#phraseListSelect').val(phrase.list_id);
                        $('#phraseId').val(phrase.id);
                    }
                } else {
                    // Добавление
                    $('#phraseModalLabel').html('<i class="bi bi-plus-circle me-2"></i>Добавить фразу');
                    form.reset();
                    $('#difficultyLevel').val('2');
                    $('#phraseActive').prop('checked', true);
                    $('#phraseId').val('');
                }
                
                modal.modal('show');
            }

            // Сохранение списка
            $('#saveListBtn').click(function() {
                const form = $('#phraseListForm')[0];
                if (!form.checkValidity()) {
                    form.reportValidity();
                    return;
                }
                
                const listData = {
                    id: $('#listId').val(),
                    name: $('#listName').val(),
                    description: $('#listDescription').val(),
                    is_active: $('#listIsActive').is(':checked')
                };



                Ajax({
                    action: 'updatePhraseList',
                    data: listData
                }).then((result)=>{
                    
                    result = parseInt(result);
                    if (result) {
                        if (listData.id) {
                            // Обновление существующего списка
                            const index = phraseLists.findIndex(l => l.id == listData.id);
                            if (index !== -1) {
                                phraseLists[index] = { ...phraseLists[index], ...listData };
                            }
                        } else {
                            // Добавление нового списка
                            listData.id = result;
                            phraseLists.push(listData);
                        }
                        
                        loadPhraseLists();
                        $('#phraseListModal').modal('hide');
                    }
                });
            });

            // Сохранение фразы
            $('#savePhraseBtn').click(function() {
                const form = $('#phraseForm')[0];
                if (!form.checkValidity()) {
                    form.reportValidity();
                    return;
                }
                
                const phraseData = {
                    id: $('#phraseId').val(),
                    list_id: parseInt($('#phraseListSelect').val()),
                    target_text: $('#targetText').val(),
                    native_text: $('#nativeText').val(),
                    context: $('#context').val(),
                    difficulty_level: parseInt($('#difficultyLevel').val()),
                    is_active: $('input[name="phraseIsActive"]:checked').val() === 'true',
                    updated_at: new Date().toISOString().split('T')[0]
                };

                Ajax({
                    action: 'updatePhrase',
                    data: phraseData
                }).then((result)=>{
                    
                    result = parseInt(result);
                    if (result) {
                        if (phraseData.id) {
                            // Обновление существующей фразы
                            const index = phrases.findIndex(p => p.id == phraseData.id);
                            if (index !== -1) {
                                phrases[index] = { ...phrases[index], ...phraseData };
                            }
                        } else {
                            // Добавление новой фразы
                            phraseData.id = result;
                            phrases.push(phraseData);
                        }
                        loadPhrases(currentFilter);
                        $('#phraseModal').modal('hide');
                    }
                })
            });

            // Обработчики событий
            $('#addListBtn').click(() => openPhraseListModal());
            $('#addPhraseBtn').click(() => openPhraseModal());
            
            $('#backBtn').click(() => {
                window.history.back();
            });
            
            $('#helpBtn').click(() => {
                appAlert(`Редактор фраз позволяет создавать и редактировать списки фраз для тренажера английского языка.
                        <ul>
                            <li>Для добавления нового списка нажмите "Добавить" в блоке "Пользовательские списки</li>
                            <li>Для добавления фразы нажмите "Добавить" в блоке "Фразы</li>
                            <li>Для редактирования или удаления используйте соответствующие кнопки в таблицах</li>
                        </ul>
                    `);
            });
            
            // Делегирование событий для кнопок в таблицах
            $(document).on('click', '.edit-list-btn', function(e) {
                e.stopPropagation();
                const listId = $(this).data('id');
                openPhraseListModal(listId);
            });
            
            $(document).on('click', '.delete-list-btn', function(e) {
                e.stopPropagation();
                const listId = $(this).data('id');
                if (confirm('Вы уверены, что хотите удалить этот список?')) {

                    Ajax({
                        action: 'deleteList',
                        data: {
                            id: listId
                        }
                    }).then((result)=>{
                        if (parseInt(result)) {
                            phraseLists = phraseLists.filter(l => l.id != listId);
                            phrases = phrases.filter(p => p.list_id != listId);
                            loadPhraseLists();
                            loadPhrases(currentFilter);
                        }

                    })
                }
            });
            
            $(document).on('click', '.edit-phrase-btn', function(e) {
                e.stopPropagation();
                const phraseId = $(this).data('id');
                openPhraseModal(phraseId);
            });
            
            $(document).on('click', '.delete-phrase-btn', function(e) {
                e.stopPropagation();
                const phraseId = $(this).data('id');
                if (confirm('Вы уверены, что хотите удалить эту фразу?')) {

                    Ajax({
                        action: 'deletePhrase',
                        data: {
                            id: phraseId
                        }
                    }).then((result)=>{
                        if (parseInt(result)) {
                            phrases = phrases.filter(p => p.id != phraseId);
                            loadPhrases(currentFilter);
                        }
                    });
                }
            });
            
            // Выбор строки в таблице
            $(document).on('click', '.phrase-item', function() {

                let _this =  $(this);
                let tbody = _this.closest('tbody');

                if (!_this.hasClass('table-active')) {

                    tbody.find('.phrase-item').each((i, item)=>{
                        $(item).removeClass('table-active');
                    });
                    _this.addClass('table-active');

                    if (tbody.attr('id') == 'phraseListsTable') {

                        loadPhrases(currentFilter = _this.data('id'));
                        //tracer.log(_this.data('id'));
                    }
                }
            });
            
            // Адаптивность заголовка
            function updateHeaderCompactness() {
                const header = $('#mainHeader');
                if ($(window).width() < 600) {
                    header.addClass('compact-header');
                } else {
                    header.removeClass('compact-header');
                }
            }
            
            $(window).resize(updateHeaderCompactness);
            
            // Инициализация
            loadPhraseLists();
            loadPhrases(currentFilter);
            updateHeaderCompactness();
        });
    </script>