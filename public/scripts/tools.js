class Tools {
	constructor(parent) {

		this.currentId = null;
		this.layer = $(`<div class="tools bg-theme-gradient control"></div>`);

		this.report_phrase_btn = $(`<a class="item" title="${Lang('report a phrase')}">
            <i class="bi bi-emoji-frown" title=""></i>
        </a>`);
        onTap(this.report_phrase_btn, this.reportPhrase.bind(this));

		this.add_favorites_btn = $(`<a class="item" title="${Lang('add to favorites')}">
            <i class="bi bi-bookmark item"></i>
        </a>`);
        onTap(this.add_favorites_btn, this.toggleFovorite.bind(this));

		if (typeof DEV != 'undefined') {

			this.progress_btn = $(`<a class="item" title="${Lang('your_progress')}">
	            <i class="bi bi-graph-up-arrow"></i>
	        </a>`);
	        onTap(this.progress_btn, this.reportProgress.bind(this));
			this.layer.append(this.progress_btn);
		}

		this.layer.append(this.report_phrase_btn);
		this.layer.append(this.add_favorites_btn);

		parent.append(this.layer);

		addSwipeClasses(this.layer);

		$(window).on('set_current_phrase', (e, phrase)=>{
			this.currentId = phrase.id;
			if (typeof phrase_favorites != 'undefined')
				this.updateFavorite(phrase_favorites.includes(phrase.id));
		});

		$('body').click((e) => {
            let t = $(e.target);
            if (t.closest(this.layer).length == 0)
                this.layer.removeClass('swipe-right');
        });
	}

	reportProgress() {
		Ajax({
			action: 'getStatistic'
		}, (data)=>{
			console.log(data);
		});
	}

	reportPhrase() {
		Confirm(Lang('report_phrase_desc'))
				.then((result)=>{
					if (result)
						Ajax({
							action: 'reportPhrase',
							data: {
								phrase_id: stateManager.get('currentPhraseId')
							}
						});
			});
	}

	updateFavorite(value) {
		this.add_favorites_btn.find('i')
			.toggleClass('bi-bookmark-fill', value)
			.toggleClass('bi-bookmark', !value);
	}

	toggleFovorite() {
		let id = this.currentId ?? parseInt(stateManager.get('currentPhraseId'));
		Ajax({
			action: 'toggleFovorite',
			data: {
				phrase_id: id
			}
		})
		.then((result)=>{
			if (isNumeric(result)) {
				let setFavorite = result > 0;

				if (typeof phrase_favorites != 'undefined') {
					let idx = phrase_favorites.indexOf(id);

					if (setFavorite) {
						if (idx < 0)
							phrase_favorites.push(id);
					} else if (idx > -1)
						phrase_favorites.splice(idx, 1);
				}
				this.updateFavorite(setFavorite);
			}
		});
	}
}

$(window).ready(()=>{
	new Tools($('.app-display .card'));
});