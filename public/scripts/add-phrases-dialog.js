class AddPhrasesDialog {
    
    constructor() {
        this.modal = $(this.html());
        $('.page').append(this.modal);

        this.modal.find('.clearBtn').click(this.clear.bind(this));

        $(window).on('add_user_list', ()=>{
            if (isEmpty(AI_URL))
                Alert(Lang('temp_unavailable'));
            else this.show();
        });

        this.af_name = this.modal.find('#af_name');
        this.af_text = this.modal.find('#af_text');
        this.af_accept = this.modal.find('#af_accept');
        this.af_send = this.modal.find('#af_send');
        this.af_list = this.modal.find('#af_list');

        this.initListeners();
    }

    show() {

        this.used = stateManager.getPaidUse('phrases_service', this.defaultUseRec());
        this.af_name.val(stateManager.get('currentListName', ''));
        this.af_text.val(stateManager.get('currentPrompt', ''));
        this.refreshUsed();
        this.refreshDialog();
        this.modal.modal('show');
    }

    refreshUsed() {

        if (this.used.date < days()) {
            this.used.date = days();
            this.used.count = 0;
            stateManager.setPaidUse('phrases_service', this.used);
            this.refreshDialog();
        }

        this.modal.find('.paid_use').text(Lang("paid_use", [this.used.limit, strEnum(this.used.count, Lang("time_format"), 'ru')]));
    }

    increaseUsed() {
        this.used.count++;
        stateManager.setPaidUse('phrases_service', this.used);
        this.refreshUsed();
    }

    clear() {
        this.af_list.empty();
    }

    isFull() {
        return !isEmpty(this.af_name.val()) && 
                !isEmpty(this.af_text.val()) && 
                (this.getList().length > 0);
    }

    initListeners() {
        this.af_name.on('input', this.onInput.bind(this));
        this.af_text.on('input', this.onInput.bind(this));

        this.af_name.on('change', this.onChange.bind(this));
        this.af_text.on('change', this.onChange.bind(this));

        this.af_send.click(this.sendTextRequest.bind(this));
        this.af_accept.click(this.sendPhrases.bind(this));
    }

    refreshDialog(waitLoad = false) {
        let overLimit = this.used.count > this.used.limit

        this.af_send.bootstrapDisable(overLimit || isEmpty(this.af_text.val()));
        this.af_accept.bootstrapDisable(overLimit || !this.isFull());
        
        this.modal.find('textarea').bootstrapDisable(overLimit);
        this.modal.find('input').bootstrapDisable(overLimit);
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
                this.increaseUsed();
                this.fillList(list);
            });
    }

    onClickRemove(e) {
        $(e.currentTarget)
            .closest('.item')
            .remove();
        this.refreshDialog();
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
        this.refreshDialog();
    }

    getList() {
        let list = [];
        this.af_list.find('.item').each((i, elem)=>{
            elem = $(elem);
            list.push({
                direction: stateManager.state.phraseDirection,
                target: elem.find('.target').text().trim(),
                native: elem.find('.native').text().trim()
            });
        });
        return list;
    }

    sendPhrases() {
        
        let name = this.af_name.val();
        let list = this.getList();
        if (typeof phrasesList != 'undefined')
            list = phrasesList.filterPhrases(name, list);
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
                    list: list
                });
        })
    }

    async sendToServer(theme) {
        return new Promise((resolve, reject) => {

            this.af_send.bootstrapDisable(true, {
                loadingText: Lang("please_wait")
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
                    throw new Error(Lang("http_error_status").replace('%1', response.status));
                }
                
                const result = await response.json();

                this.af_send.bootstrapDisable(false);

                if (result.phrases)
                    resolve(result.phrases);
                else reject({
                    status: 'error',
                    message: Lang("do_not_have_phrases")
                });
            })
            .catch(error => {

                showAlert(Lang("error_with_message").replace('%1', error.message));
                this.af_send.bootstrapDisable(false);
                tracer.error('Error server:', error);
                reject({
                    status: 'error',
                    message: error.message
                });
            });
        });
    }

    defaultUseRec() {
        return {
            count: 0,
            limit: 5,
            date: days()
        }
    }

    html() {

        return `<div class="modal fade fullscreen-modal" id="addPhrasesModal" tabindex="-1" aria-labelledby="settingsModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-fullscreen">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="centeredModalLabel">` + Lang("add_phrase_list") + `</h5>
                    </div>
                    <div class="modal-body">
                        <div class="content">
                            <div>
                                <div class="input-group input-group-sm mb-3">
                                    <div class="input-group-prepend">
                                        <span class="input-group-text">` + Lang("list_name") + `</span>
                                    </div>
                                    <input type="text" id="af_name" placeholder="` + Lang("example_cats") + `" class="form-control" aria-label="Small">
                                </div>
                                <p class="text-justify">` + Lang("ai_generates_phrases_desc") + `<br>
                                    ` + Lang("write_topic_for_phrases") + `
                                </p>
                                <div class="mb-3">
                                    <textarea placeholder="` + Lang("example_short_phrases_about_cats") + `"  class="form-control" id="af_text" rows="3"></textarea>
                                </div>
                                <div class="mb-3 d-flex justify-content-between">
                                    <p class="paid_use"></p>
                                    <button type="button" class="btn btn-primary" id="af_send">` + Lang("send") + `</button>
                                </div>
                            </div>
                            <div>
                                <div class="input-group-prepend justify-content-between input-group-text">
                                    <span>` + Lang("phrase_list") + `</span>
                                    <button class="btn btn-sm clearBtn">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                                <div id="af_list">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">` + Lang("close") + `</button>
                        <button type="button" class="btn btn-primary" data-bs-dismiss="modal" id="af_accept">` + Lang("add") + `</button>
                    </div>
                </div>
            </div>
        </div>`
    }
}

$(window).ready(()=>{
    new AddPhrasesDialog();
});