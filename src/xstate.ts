import * as s from "solid-js"
import * as sweb from "solid-js/web"
import * as sstore from "solid-js/store"
import * as x from "xstate"

export function isWrappable(obj: any): obj is object {
	let proto
	return (
		obj != null &&
		typeof obj === "object" &&
		(!(proto = Object.getPrototypeOf(obj)) || proto === Object.prototype || Array.isArray(obj))
	)
}

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

/**
 * Based on Ryan Carniato's createImmutable prototype
 * Clones the initial value and diffs updates
 */
export function createImmutable<T extends object>(init: T): [T, (next: T) => void] {
	const [store, setStore] = sstore.createStore(deepClone(init))
	let ref = init

	const setImmutable = (next: T) => {
		s.batch(() => {
			updateStore(next, ref, setStore, store)
		})
		ref = next
	}

	return [store, setImmutable]
}

export function createActor<TMachine extends x.AnyStateMachine>(
	machine: TMachine,
	options?: x.ActorOptions<TMachine>,
): x.Actor<TMachine> {
	const actor = x.createActor(machine, options)

	if (!sweb.isServer) {
		actor.start()
		s.onCleanup(() => actor.stop())
	}

	return actor
}

type UseMachineReturn<TMachine extends x.AnyStateMachine, TInterpreter = x.Actor<TMachine>> = [
	state: x.SnapshotFrom<TMachine>,
	send: x.Prop<TInterpreter, "send">,
	service: TInterpreter,
]

/*

Snapshot structure:

dynamic:
	context       user data (primitives, arrays, objects)
	historyValue  {[string]: Object[]}
	children      {[string]: Object}
	status        'active' | 'done' | 'error' | 'stopped'
	output        ???
	error         unknown (single value)
	value         StateValue (string | {[string]: StateValue})
static:
	machine
	tags          Set (won't be tracked)
methods:
	can
	getMeta
	hasTag
	matches
internal:
	_nodes

*/

export function createMachine<TMachine extends x.AnyStateMachine>(
	machine: TMachine,
	options?: x.ActorOptions<TMachine>,
): UseMachineReturn<TMachine> {
	const actor = createActor(machine, options)

	// const [state, setState] = createImmutable(actor.getSnapshot())

	const [state, setState] = [actor.getSnapshot(), actor.send]

	console.log(actor, state)

	if (!sweb.isServer) {
		const sub = actor.subscribe(nextState => {
			setState(nextState)
		})

		s.onCleanup(sub.unsubscribe)
	}

	return [state, actor.send, actor]
}
