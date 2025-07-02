// from: https://news.ycombinator.com/item?id=17876741
// reference: http://extremelearning.com.au/unreasonable-effectiveness-of-quasirandom-sequences/
const g = 1.32471795724474602596090885447809 // Plastic number
const a1 = 1.0 / g
const a2 = 1.0 / (g * g)
const base = 1.1127756842787055 // harmoniousNumber(7), yields better coverage compared to using 0.5

export const generateR2 = count => {
	const points = []

	for (let n = 0; n < count; n++) {
		points.push([(base + a1 * n) % 1, (base + a2 * n) % 1])
	}

	return points
}

export const r2Sequence = generateR2(256).map(([a, b]) => [a - 0.5, b - 0.5])

export function jitter(width, height, camera, frame, jitterScale = 1) {
	const [x, y] = r2Sequence[frame % r2Sequence.length]

	if (camera.setViewOffset) {
		camera.setViewOffset(width, height, x * jitterScale, y * jitterScale, width, height)
	}
}

export const didCameraMove = (camera, lastCameraPosition, lastCameraQuaternion) => {
	if (camera.position.distanceToSquared(lastCameraPosition) > 0.000001) {
		return true
	}

	if (camera.quaternion.angleTo(lastCameraQuaternion) > 0.001) {
		return true
	}

	return false
}