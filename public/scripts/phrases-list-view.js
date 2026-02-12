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
	}

	onUserListLoaded(e, data) {
		this.setUserLists(data);
	}

	onSelected(e, type) {
		this.current_list_index = type;
		this.refreshForCurrentList();
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

    blockItem(key, text, withTrash = false) {
        let item = $(`<div class="item"><a data-key="${key}">${text}</a></div>`);
        if (withTrash) item.append(this.trashButton());
        item.click(this.typeClick.bind(this));
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

    refreshAccordion() {
    	let items = this.accordion.children();
	    let count = items.length;

    	if (count > 1) {

    		let gap = this.accordion.getGap();
    		let h = this.accordion.parent().innerHeight();
    		let item_h = $(items[0]).find('.accordion-header').height();
	    	let hfree = h - count * item_h + count * gap + gap * 2;

	    	items.each((i, item)=>{
	    		item = $(item);
	    		let show = item.find('.show').length > 0;
	    		item.css('height', show ? hfree : item_h);
	    	});
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
					item = this.blockItem(key, list[key], isUserFolder);
				else {
		            let count = list[key].length;
		            item = this.blockItem(key, key + ` (${count})`, isUserFolder);
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
			this.refreshAccordion();
		})
		this.accordion.on('shown.bs.collapse', event => {
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