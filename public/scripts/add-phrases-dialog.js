class AddPhrasesDialog {
	
    constructor() {
    	this.modal = $(this.html());
        $('.page').append(this.modal);
        $(window).on('add_user_list', ()=>{
            this.show();
        });

        this.af_name = this.modal.find('#af_name');
        this.af_text = this.modal.find('#af_text');
        this.af_accept = this.modal.find('#af_accept');
        this.af_send = this.modal.find('#af_send');
        this.af_list = this.modal.find('#af_list');

        this.initListeners();
    }

    show() {
        this.af_name.val(stateManager.get('currentListName', ''));
        this.af_text.val(stateManager.get('currentPrompt', ''));

        this.modal.modal('show');
        this.refreshDialog();
    }

    isFull() {
        return !isEmpty(this.af_name.val()) && 
                !isEmpty(this.af_text.val()) && 
                !isEmpty(this.getList());
    }

    initListeners() {
        this.af_name.on('input', this.onInput.bind(this));
        this.af_text.on('input', this.onInput.bind(this));

        this.af_name.on('change', this.onChange.bind(this));
        this.af_text.on('change', this.onChange.bind(this));

        this.af_send.click(this.sendTextRequest.bind(this));
        this.af_accept.click(this.sendPhrases.bind(this));
    }

    refreshDialog() {
        this.af_send.bootstrapDisable(isEmpty(this.af_text.val()));
        this.af_accept.bootstrapDisable(!this.isFull());
    }

    onInput() {
        this.refreshDialog();
    }

    onChange() {
        stateManager.updateSettings({
            currentListName: this.af_name.val(),
            currentPrompt: this.af_text.val()
        });

        stateManager.saveState();
    }

    sendTextRequest() {
        this.sendToServer(this.af_text.val()).
            then((list)=>{
                this.fillList(list);
            });
    }

    onClickRemove(e) {
        $(e.currentTarget)
            .closest('.item')
            .remove();
    }

    createPhraseItem(parent, rec) {
        let item = $(`
            <div class="item">
                <div>
                    <div class="native">
                        ${rec.native}
                    </div>
                    <div class="target">
                        ${rec.en}
                    </div>
                </div>
                <button class="btn btn-sm">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `);
        item.find('.btn').click(this.onClickRemove.bind(this));
        parent.append(item);
    }

    fillList(list) {
        this.af_list.empty();
        for (let i=0; i<list.length; i++)
            this.createPhraseItem(this.af_list, list[i]);
    }

    getList() {
        let list = [];
        this.af_list.find('.item').each((i, elem)=>{
            elem = $(elem);
            list.push({
                target_text: elem.find('.target').text().trim(),
                native_text: elem.find('.native').text().trim()
            });
        });
        return list;
    }

    sendPhrases() {
        let list = this.getList();
        let name = this.af_name.val();
        Ajax({
            action: 'addUserPhrases',
            data: {
                name: name,
                description: this.af_text.val(),
                items: list
            }
        })
        .then((result)=>{
            if (result.success)
                $(window).trigger('added_user_list', {
                    name: name,
                    count: list.length
                });
        })
    }

    async sendToServer(theme) {
        return new Promise((resolve, reject) => {

            this.af_send.bootstrapDisable(true, {
                loadingText: "Ожидайте..."
            });

            fetch(AI_URL, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    native_lang: 'ru',
                    target_lang: 'en',
                    theme: theme
                })
            })
            .then(async (response)=>{
            
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();

                this.af_send.bootstrapDisable(false);

                if (result.phrases)
                    resolve(result.phrases);
                else reject({
                    status: 'error',
                    message: 'Do not have phrases'
                });
            })
            .catch(error => {

                showAlert("Ошибка: " + error.message);
                this.af_send.bootstrapDisable(false);
                tracer.error('Error server:', error);
                reject({
                    status: 'error',
                    message: error.message
                });
            });
        });
    }

    html() {
        return `<div class="modal fade fullscreen-modal" id="addPhrasesModal" tabindex="-1" aria-labelledby="settingsModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-fullscreen">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="centeredModalLabel">Добавление фраз</h5>
                    </div>
                    <div class="modal-body">
                        <div class="content">
                            <div class="input-group input-group-sm mb-3">
                                <div class="input-group-prepend">
                                    <span class="input-group-text" id="inputGroup-sizing-sm">Название списка</span>
                                </div>
                                <input type="text" id="af_name" class="form-control" aria-label="Small" aria-describedby="inputGroup-sizing-sm">
                            </div>
                            <p class="text-justify">По вашему запросу AI генерирует список фраз.<br>
                                Напишите любой текст, на какую тему вы бы хотели сгенерировать фразы.
                                Можете описать сложность, длину или слова которые вы хотели бы видеть.
                            </p>
                            <div class="mb-3">
                                <label for="exampleFormControlTextarea1" class="form-label">Ваш запрос</label>
                                <textarea class="form-control" id="af_text" rows="3"></textarea>
                            </div>
                            <div class="mb-3 text-end">
                                <button type="button" class="btn btn-primary" id="af_send">Отправить</button>
                            </div>
                            <div id="af_list">
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Закрыть</button>
                        <button type="button" class="btn btn-primary" data-bs-dismiss="modal" id="af_accept">Добавить</button>
                    </div>
                </div>
            </div>
        </div>`
    }
}

$(window).ready(()=>{
    new AddPhrasesDialog();
});
