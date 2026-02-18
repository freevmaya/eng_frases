class PhrasesListView {
	constructor(elem) {
		this.elem = elem;
		this.accordion = null;
		this.groups = {};
		this.current_list_index = null;
		this.userGroupName = Lang("my_phrases");
		$(window).on('selected_list_type', this.onSelected.bind(this));
        $(window).on('resize', this.refreshAccordion.bind(this));
		$(window).on('added_user_list', this.onAddedUserList.bind(this));
		$(window).on('user_list_loaded', this.onUserListLoaded.bind(this));

		this.checkTentionDelay = debounce(this.doCheckTention.bind(this), 400);
		this.hiddedDesk = false;
	}

	onUserListLoaded(e, data) {
		this.setUserLists(data);
	}

	onSelected(e, type) {
		this.current_list_index = type;
		this.refreshForCurrentList();
	}

	doCheckTention() {
		if (this.isTension()) {
			let show = this.accordion.find('.show');
			show.hideCollapse();
			this.refreshAccordion();
		}
	}

	filterPhrases(listName, list) {
		if (typeof this.groups[this.userGroupName][listName] != 'undefined')
			return filterPhrasesAdvanced(list, this.groups[this.userGroupName][listName]);
		return list;
	}

	onAddedUserList(e, item) {
		let abody = this.accordion.find(`[data-name="${this.userGroupName}"]`).find('.accordion-body');

    	let groupName = 0;
    	Object.keys(this.groups).forEach((group, i) => {
    		if (typeof this.groups[group][item.name] != 'undefined')
    			groupName = group;
    	});

		let elem_item = abody.find(`[data-key="${item.name}"]`);
		if (groupName && elem_item) {

			let newList = item.list;
			if (typeof this.groups[groupName][item.name] != 'undefined')
				newList = mergePhrasesSimple([...this.groups[groupName][item.name], ...item.list]);

			elem_item.text(`${item.name} (${newList.length})`);

			this.groups[groupName][item.name] = newList;
		} else {
			abody.prepend(this.blockItem(item.name, `${item.name} (${item.list.length})`, true));
			this.groups[item.name] = item.list;
		}
	}

    typeClick(e) {
        $(window).trigger('select_phrase_list', $(e.target).data('key'));
    }

    refreshForCurrentList() {
        this.elem.find('.item').each((i, item)=>{
            item = $(item);
            item.removeClass('current');
            if (this.current_list_index == item.find('a').data('key'))
                item.addClass('current');
        });
    }

    blockItem(key, text, withShare = true, withTrash = false) {
        let item = $(`<div class="item"><a data-key="${key}">${text}</a></div>`);
        item.find('a').click(this.typeClick.bind(this));
        if (withTrash) item.append(this.trashButton());
        if (withShare) item.append(this.shareButton());
        return item;
    }

    blockItemAdd() {
        return $(`<div class="item add-list"><a>+ ` + Lang("add") + `</a></div>`);
    }

    trashButton() {
    	let button = $(`<button class="btn btn-sm"><i class="bi bi-trash"></i></button>`);
    	button.click(this.clickTrash.bind(this));
    	return button;
    }

    shareButton() {
    	let button = $(`<button class="btn btn-sm"><i class="bi bi-share"></i></button>`);
    	button.click(this.clickShare.bind(this));
    	return button;
    }

    clickShare(e) {
    	$(window).trigger('share', $(e.currentTarget).parent().find('a').data('key'));
    }

    clickTrash(e) {
    	let item = $(e.currentTarget).closest('.item');
    	let itemName = item.find('a').data('key');
    	Confirm(Lang("confirm_delete_list").replace('%1', itemName))
    		.then((result)=>{
    			Ajax({
    				action: 'deleteList',
    				data: {
    					name: itemName
    				}
    			})
    			.then((result)=>{
    				if (result.success) {
    					$(window).trigger('user_list_removed', itemName);
    					item.remove();
    					delete(this.groups[this.userGroupName][itemName]);
    				} else Wrong();
    			})
    		});
    }

    itemHeaderHeight() {
    	let items = this.accordion.children();
    	return items.length > 0 ? $(items[0]).find('.accordion-header').height() : 0;
    }

    isTension() {
    	return Math.round(this.accordion.parent().innerHeight()) < Math.round(this.accordion[0].scrollHeight);
    }

    calcMinHeight() {
    	let items = this.accordion.children();
	    let count = items.length;

    	if (count > 1) {
    		let gap = this.accordion.getGap();
    		let item_h = this.itemHeaderHeight();
	    	return count * item_h + count * gap + gap * 2 + item_h;
	    }

	    return 0;
    }

    refreshAccordion() {
    	let items = this.accordion.children();
	    let count = items.length;

    	if (count > 1) {

    		let gap = this.accordion.getGap();
    		let h = this.accordion.parent().innerHeight();
    		let item_h = this.itemHeaderHeight();
	    	let hfree = h - count * item_h + count * gap + gap * 2;

	    	items.each((i, item)=>{
	    		item = $(item);
	    		let show = item.find('.show').length > 0;
	    		item.css('height', show ? Math.max(hfree, item_h * 2) : item_h);
	    	});

	    	this.checkTentionDelay();
	    }
    }

    refreshItems() {
    	this.elem.empty();
    	this.accordion = $('<div class="accordion" id="accordionItems">');

    	let currentListTypeIdx = 0;
    	Object.keys(this.groups).forEach((group, i) => {
    		if (stateManager.state.currentListType)
    			if (typeof this.groups[group][stateManager.state.currentListType] != 'undefined')
    				currentListTypeIdx = i;
    	});

    	Object.keys(this.groups).forEach((group, i) => {

    		let isUserFolder = group == this.userGroupName;

    		let name = 'collapse-' + i;

    		let isHaveCurrentType = i == currentListTypeIdx;

    		let addButton = '';
			if (isUserFolder)
				addButton = `<button class="btn btn-sm add-list card bg-theme-gradient">+</button>`;

    		let list = this.groups[group];
    		let classes = isHaveCurrentType ? 'collapse show': 'collapse';
    		let expended = isHaveCurrentType ? 'aria-expanded="true"' : '';
    		let layer = $(`
    			<div class="accordion-item" data-name="${group}">
    				<div class="accordion-header">
    					<div class="card bg-theme-gradient head" data-bs-toggle="collapse" data-bs-target="#${name}" aria-controls="${name}">
    						${group}
    					</div>
    					${addButton}
    				</div>
	    			<div id="${name}" class="accordion-collapse ${classes}" data-bs-parent="#accordionItems">
						<div class="accordion-body">
						</div>
				    </div>
    			</div>
    		`);

    		let body = layer.find('.accordion-body');
			Object.keys(list).forEach(key => {

				let item = null;

				if (typeof list[key] == 'string')
					item = this.blockItem(key, list[key], true, isUserFolder);
				else {
		            let count = list[key].length;
		            item = this.blockItem(key, key + ` (${count})`, true, isUserFolder);
		        }
		        
		        body.append(item);
	        });

			if (isUserFolder)
		        body.append(this.blockItemAdd());

		    layer.find('.add-list').click(()=>{
	        	$(window).trigger("add_user_list");
	        });

	        this.accordion.append(layer);
    	});
    	this.elem.append(this.accordion);

    	this.refreshAccordion();

		this.accordion.on('hidden.bs.collapse', event => {
			if (this.hiddedDesk) {
				$('#desk-block').show();
				this.hiddedDesk = false;
			}
			this.refreshAccordion();
		})
		this.accordion.on('shown.bs.collapse', event => {
			if (this.calcMinHeight() > this.accordion.parent().innerHeight()) {
				$('#desk-block').hide();
				this.hiddedDesk = true;
			}
			this.refreshAccordion();
		})
		this.refreshForCurrentList();
    }

    setUserLists(list) {
	    this.groups[this.userGroupName] = list ? list : [];
		this.refreshItems();
    }

	setDefaultList(list, currentListType, group='') {

		this.groups[group] = {...list};
		this.current_list_index = currentListType;
		this.refreshItems();
	}
}

$.fn.hideCollapse = function () {
	const collapse = bootstrap.Collapse.getInstance(this[0]);
    if (collapse) collapse.hide();
    else this.removeClass('show');
}