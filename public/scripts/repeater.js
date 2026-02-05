class Repeater {
	
	calcAny(attemptIndex, progress) {
		return [
			missOne: false,
			index: attemptIndex,
			progress: progress
		]
	}
	
	calcIncrease(currentIndex, progress) {
		return [
			missOne: false,
			index: currentIndex + 1,
			progress: progress
		]
	}
}