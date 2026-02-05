class Enumerator {

	constructor(index, max) {
		this.currentPhraseIndex = index;
		this.max = max;
	}
	
	setIndex(attemptIndex, progress) {
		this.currentPhraseIndex = Math.min(Math.max(attemptIndex, 0), this.max);
	}
	
	Increase(currentIndex, progress) {
		this.currentPhraseIndex++;
	}
}