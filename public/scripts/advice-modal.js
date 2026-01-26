class AdviceModal {
	
    constructor(modal, list = []) {
    	this.modal = modal;
    	this.list = list;
    	this.current = 0;
    	this.refreshAdvice();
    	this.setupEventListeners();
    	this.modal.modal('show');
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
    }
}