class Enumerator {

	constructor(index, max) {
		this.currentPhraseIndex = index;
		this.setMax(max);
	}

	store() {
		return {
			currentPhraseIndex: this.currentPhraseIndex
		}
	}

	restore(data) {
		this.currentPhraseIndex = data.currentPhraseIndex;
	}

	setMax(value) {
		this.max = value;
	}

	startStage() {
	}
	
	setIndex(attemptIndex, progress) {
		this.currentPhraseIndex = Math.min(Math.max(attemptIndex, 0), this.max);
	}
	
	Increase(progress) {
		let newIndex = (this.currentPhraseIndex + 1) % this.max;
		this.currentPhraseIndex = newIndex;
	}
}

class Repeator extends Enumerator {

	constructor(index, max) {
		super(index, max);
		this.repeatCount 	= 0;
		this.repeatLength 	= 5;
		this.missOne		= false;
	}

	store() {
		return $.extend(super.store(), {
			repeatCount: this.repeatCount,
			repeatLength: this.repeatLength,
			missOne: this.missOne
		});
	}

	restore(data) {
		super.restore(data);
		this.repeatCount = data.repeatCount;
		this.repeatLength = data.repeatLength;
		this.missOne = data.missOne;
	}

	startStage() {
		this.missOne = this.repeatLength > 1;
	}
	
	setIndex(attemptIndex, progress) {
		this.currentPhraseIndex = Math.min(Math.max(attemptIndex, 0), this.max);
	}
	
	Increase(progress) {
		let newIndex = (this.currentPhraseIndex + 1) % this.max;

		let newRepeat = 0;
		if (typeof progress == 'object')
            newRepeat = progress.currentRepeat;

        if ((this.repeatCount > 0) && (newIndex % this.repeatLength == 0)) {
            if (!this.missOne) {

                newRepeat += 1;
                if (newRepeat > this.repeatCount)
                    newRepeat = 0;
                else newIndex = Math.max(0, newIndex - this.repeatLength);

                tracer.log(`newRepeat: ${newIndex}, newIndex: ${newIndex}`);
            }
        }

        this.missOne = false;
	}
}