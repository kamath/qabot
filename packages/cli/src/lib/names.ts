const NAMES = [
	"riley",
	"jordan",
	"alex",
	"casey",
	"morgan",
	"taylor",
	"quinn",
	"blake",
	"avery",
	"sage",
	"reese",
	"drew",
	"harper",
	"rowan",
	"emery",
	"skyler",
	"finley",
	"kai",
	"nova",
	"remy",
]

function pick<T>(arr: T[]) {
	return arr[Math.floor(Math.random() * arr.length)]
}

export function generateEmployeeName() {
	return pick(NAMES)
}
