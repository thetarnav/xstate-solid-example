import * as sstore from "solid-js/store"

const $ROOT = Symbol("store-root")

export function isWrappable(obj: any): obj is object {
	let proto
	return (
		obj != null &&
		typeof obj === "object" &&
		(!(proto = Object.getPrototypeOf(obj)) || proto === Object.prototype || Array.isArray(obj))
	)
}

export type ReconcileOptions = {
	key?: string | null
	merge?: boolean
}

const [, setStore] = /*#__PURE__*/ sstore.createStore({})

function applyState(
	target: any,
	parent: any,
	property: PropertyKey,
	merge: boolean | undefined,
	key: string | null,
) {
	const previous = parent[property]
	if (target === previous) return

	const target_is_array = Array.isArray(target)
	if (
		property !== $ROOT &&
		(!isWrappable(target) ||
			!isWrappable(previous) ||
			target_is_array !== Array.isArray(previous) ||
			(key && target[key as never] !== previous[key as never]))
	) {
		setStore(parent, property, target)
		setProperty(parent, property, target)
		return
	}

	if (target_is_array) {
		if (
			target.length &&
			previous.length &&
			(!merge || (key && target[0] && target[0][key] != null))
		) {
			let i, j, start, end, new_end, item, new_indices_next, key_val
			// common prefix
			for (
				start = 0, end = Math.min(previous.length, target.length);
				start < end &&
				(previous[start] === target[start] ||
					(key &&
						previous[start] &&
						target[start] &&
						previous[start][key] === target[start][key]));
				start++
			) {
				applyState(target[start], previous, start, merge, key)
			}

			const temp = new Array(target.length),
				new_indices = new Map()
			// common suffix
			for (
				end = previous.length - 1, new_end = target.length - 1;
				end >= start &&
				new_end >= start &&
				(previous[end] === target[new_end] ||
					(key &&
						previous[start] &&
						target[start] &&
						previous[end][key] === target[new_end][key]));
				end--, new_end--
			) {
				temp[new_end] = previous[end]
			}

			// insert any remaining updates and remove any remaining nodes and we're done
			if (start > new_end || start > end) {
				for (j = start; j <= new_end; j++) setProperty(previous, j, target[j])
				for (; j < target.length; j++) {
					setProperty(previous, j, temp[j])
					applyState(target[j], previous, j, merge, key)
				}
				if (previous.length > target.length) setProperty(previous, "length", target.length)
				return
			}

			// prepare a map of all indices in target
			new_indices_next = new Array(new_end + 1)
			for (j = new_end; j >= start; j--) {
				item = target[j]
				key_val = key && item ? item[key] : item
				i = new_indices.get(key_val)
				new_indices_next[j] = i === undefined ? -1 : i
				new_indices.set(key_val, j)
			}
			// step through all old items to check reuse
			for (i = start; i <= end; i++) {
				item = previous[i]
				key_val = key && item ? item[key] : item
				j = new_indices.get(key_val)
				if (j !== undefined && j !== -1) {
					temp[j] = previous[i]
					j = new_indices_next[j]
					new_indices.set(key_val, j)
				}
			}
			// set all the new values
			for (j = start; j < target.length; j++) {
				if (j in temp) {
					setProperty(previous, j, temp[j])
					applyState(target[j], previous, j, merge, key)
				} else setProperty(previous, j, target[j])
			}
		} else {
			for (let i = 0, len = target.length; i < len; i++) {
				applyState(target[i], previous, i, merge, key)
			}
		}
		if (previous.length > target.length) setProperty(previous, "length", target.length)
	}
	// target is object
	else {
		const target_keys = Object.keys(target)
		for (let i = 0, len = target_keys.length; i < len; i++) {
			applyState(target[target_keys[i]], previous, target_keys[i], merge, key)
		}
		const previous_keys = Object.keys(previous)
		for (let i = 0, len = previous_keys.length; i < len; i++) {
			if (target[previous_keys[i]] === undefined)
				setProperty(previous, previous_keys[i], undefined)
		}
	}
}

// Diff method for setStore
export function reconcile<T extends U, U>(
	value: T,
	options: ReconcileOptions = {},
): (state: U) => T {
	const {merge, key = "id"} = options,
		v = sstore.unwrap(value)
	return state => {
		if (!isWrappable(state) || !isWrappable(v)) return v
		const res = applyState(v, {[$ROOT]: state}, $ROOT, merge, key)
		return res === undefined ? (state as T) : res
	}
}

/*


XSTATE IMMUTABLE


*/

/**
 * Accepts any value and creates a deep clone if it is an object
 * This function only deeply clones objects, any classes with be copied
 * @param value The variable to deeply clone
 * @param valueRefs A WeakMap that stores a reference from the original
 * object/array to the cloned object/array
 */
const clone = <T extends unknown>(value: T, valueRefs: WeakMap<any, any>): T => {
	if (!isWrappable(value)) {
		return value
	}

	const isObject = !Array.isArray(value)

	// Get either a new object/array and a typed iterator
	const [clonedValue, keyedValues] = isObject
		? [{} as T, Object.keys(value) as Array<keyof T>]
		: [[] as unknown as T, value as Array<keyof T>]

	// Save a reference of the object/array
	valueRefs.set(value, clonedValue)

	// Loop over all object/array indexes and clone
	for (let i = 0; i < keyedValues.length; ++i) {
		const keyedIndex = (isObject ? keyedValues[i] : i) as keyof T
		const currentVal = value[keyedIndex]
		// Check if reference already exists, helps prevent max call stack
		if (valueRefs.has(currentVal)) {
			clonedValue[keyedIndex] = valueRefs.get(currentVal)
		} else {
			clonedValue[keyedIndex] = clone(currentVal, valueRefs)
		}
	}

	return clonedValue
}

export const deepClone = <T extends unknown>(value: T): T => clone(value, new WeakMap())

const resolvePath = (path: any[], obj = {}): unknown => {
	let current: any = obj
	// tslint:disable-next-line:prefer-for-of
	for (let i = 0; i < path.length; i++) {
		current = current?.[path[i]]
	}
	return current
}

const updateStore = <Path extends unknown[]>(
	nextStore: sstore.Store<any>,
	prevStore: sstore.Store<any>,
	set: (...args: [...Path, unknown, unknown?]) => void,
	store: sstore.Store<any>,
) => {
	const valueRefs = new WeakMap<any, unknown>()
	const diff = <CompareValue extends unknown>(
		next: CompareValue,
		prev: CompareValue,
		path: Path,
	) => {
		if (prev === next) {
			return
		}

		// Use reference if it has already been used circular reference loops
		if (valueRefs.has(next)) {
			set(...path, valueRefs.get(next))
			return
		}

		if (!isWrappable(next) || !isWrappable(prev)) {
			// toString cannot be set in solid stores
			if (path[path.length - 1] !== "toString") {
				set(...path, () => next)
			}
			return
		}

		// next is either an object or array, save reference to prevent diffing
		// the same object twice
		valueRefs.set(next, resolvePath(path, store))

		// Diff and update array or object
		if (Array.isArray(next) && Array.isArray(prev)) {
			const newIndices = next.length - prev.length
			const smallestSize = Math.min(prev.length, next.length)
			const largestSize = Math.max(next.length, prev.length)

			// Diff array
			for (let start = 0, end = largestSize - 1; start <= end; start++, end--) {
				diff(next[start], prev[start], [...path, start] as Path)
				if (start === end) break
				diff(next[end], prev[end], [...path, end] as Path)
			}

			// Update new or now undefined indexes
			if (newIndices !== 0) {
				for (let newEnd = smallestSize; newEnd <= largestSize - 1; newEnd++) {
					set(...path, newEnd, next[newEnd])
				}
				if (prev.length > next.length) {
					set(...path, "length", next.length)
				}
			}
		} else {
			// Update new values
			const targetKeys = Object.keys(next) as Array<keyof CompareValue>
			for (let i = 0, len = targetKeys.length; i < len; i++) {
				diff(next[targetKeys[i]!], prev[targetKeys[i]!], [...path, targetKeys[i]] as Path)
			}

			// Remove previous keys that are now undefined
			const previousKeys = Object.keys(prev) as Array<keyof CompareValue>
			for (let i = 0, len = previousKeys.length; i < len; i++) {
				if (next[previousKeys[i]!] === undefined) {
					set(...path, previousKeys[i]!, undefined)
				}
			}
		}
	}
	diff(nextStore, prevStore, [] as any)
}
