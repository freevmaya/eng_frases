class AdviceModal {
	
    constructor(modal, list = [], title = null) {
    	this.modal = modal;
    	this.list = list;
    	this.current = 0;
    	this.refreshAdvice();
    	this.setupEventListeners();
    	this.modal.modal('show');
        this.modal.find('.page-buttons').css('display', list.length <= 1 ? 'none' : 'inline-block');
        if (title) this.modal.find('.modal-title').text(title);
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