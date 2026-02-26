class AdviceModal {
    
    constructor(modal, list = [], title = null) {
        this.modal = modal;
        this.list = list;
        this.current = 0;
        this.refreshAdvice();
        this.setupEventListeners();
        this.modal.find('.page-buttons').css('display', list.length <= 1 ? 'none' : 'inline-block');
        if (title) this.modal.find('.modal-title').text(title);

        afterCondition(()=>{
            return this.modal.parent().is(':visible');
        }, ()=>{
            this.modal.modal('show');
        });
    }

    setupEventListeners() {
        this.modal.find('.prev').click((()=>{
            let index = this.current > 0 ? this.current - 1 : this.list.length - 1;
            this.setAdviceIndex(index);
        }).bind(this));
        this.modal.find('.next').click((()=>{
            this.setAdviceIndex((this.current + 1) % this.list.length);
        }).bind(this));
    }

    setAdviceIndex(index) {
        if (this.current != index) {
            this.current = index;
            this.refreshAdvice();
        }
    }

    refreshAdvice() {
        this.modal.find('.content').html(this.list[this.current]);
        this.modal.find('.page-number').text((this.current + 1) + '/' + this.list.length);
    }
}

function appAlert(msg, title=null) {
    new AdviceModal($('#message'), isStr(msg) ? [msg] : msg, title);
}

function showAdvices() {
    let list = [
        `<p>` + Lang("advice_quiz_1") + `</p>
        <p>` + Lang("advice_quiz_2") + `
        <ul>
            <li>` + Lang("advice_quiz_3") + `</li>
            <li>` + Lang("advice_quiz_4") + `</li>
            <li>` + Lang("advice_quiz_5") + `</li>
        </ul>
        </p>`,
        `<p>` + Lang("advice_3_1") + `</p><p>` + Lang("advice_3_2") + `
        <ul>
            <li>` + Lang("advice_3_li_1") + `</li>
            <li>` + Lang("advice_3_li_2") + `</li>
        </ul>
        </p>`,
        `<p>` + Lang("advice_4_1") + `</p><p>` + Lang("advice_4_2") + `
        <ul>
            <li>` + Lang("advice_4_li_1") + `</li>
            <li>` + Lang("advice_4_li_2") + `</li>
        </ul>
        </p><p>` + Lang("advice_4_3") + `</p>`,
        `<p>` + Lang("advice_1_1") + `</p><p>` + Lang("advice_1_2") + `</p>`,
        `<p>` + Lang("advice_2_1") + `</p><p>` + Lang("advice_2_2") + `</p>`,
        `<p>` + Lang("advice_5_1") + `</p>
        <p>` + Lang("advice_5_2") + `
        </p>
        <p>` + Lang("advice_5_3") + `</p>
        <hr>
        <p><span class="bi bi-award me-2"><span> ` + Lang("happy_learning") + `</p>`
    ];
    appAlert(list, Lang("help_tips_recommendations"));
}