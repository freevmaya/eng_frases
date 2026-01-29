class PhrasesListView {
	constructor(elem) {
		this.elem = elem;
		this.groups = {};
		this.current_list_index = null;
		$(window).on('selected_list_type', this.onSelected.bind(this));
	}

	onSelected(e, type) {
		this.current_list_index = type;
		this.refreshForCurrentList();
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

    blockItem(key, text) {
        let item = $(`<div class="item"><a data-key="${key}">${text}</a></div>`);
        item.click(this.typeClick.bind(this));
        return item;
    }

    refreshItems() {
    	this.elem.empty();
    	Object.keys(this.groups).forEach((group) => {

    		let list = this.groups[group];
    		let layer = $(`<div><div class="header"><h6>${group}</h6></div></div>`);
			Object.keys(list).forEach(key => {

				if (typeof list[key] == 'string')
					layer.append(this.blockItem(key, list[key]));
				else {
		            let count = list[key].length;
		            layer.append(this.blockItem(key, key + ` (${count})`));
		        }
	        });

	        this.elem.append(layer);
    	});
		this.refreshForCurrentList();
    }

    setUserLists(list) {
    	let keys = Object.keys(list);

    	if (keys.length > 0) {
		    this.groups["Пользовательские"] = list;
		    keys.forEach(key => {
		    	phrasesData[key] = list[key];
		    });
			this.refreshItems();
		}
    }

	setDefaultList(list, currentListType, group='') {

		this.groups[group] = {...list};
		this.current_list_index = currentListType;
		this.refreshItems();
	}
}