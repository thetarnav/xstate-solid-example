import * as s from "solid-js"
import * as x from "xstate"
import {createImmutable} from "@solid-primitives/immutable"

const text_machine = x.createMachine({
	context: {
		committed_value: "",
		value: "",
	},
	initial: "reading",
	states: {
		reading: {
			on: {
				"text.edit": {target: "editing"},
			},
		},
		editing: {
			on: {
				"text.change": {
					actions: x.assign({
						value: ({event}) => event.value,
					}),
				},
				"text.commit": {
					actions: x.assign({
						committed_value: ({context}) => context.value,
					}),
					target: "reading",
				},
				"text.cancel": {
					actions: x.assign({
						value: ({context}) => context.committed_value,
					}),
					target: "reading",
				},
			},
		},
	},
})

export const App: s.Component = () => {
	const text_actor = x.createActor(text_machine).start()

	const [snapshot, setSnapshot] = s.createSignal(text_actor.getSnapshot())
	text_actor.subscribe(setSnapshot)

	const state = createImmutable(snapshot) as any as ReturnType<typeof snapshot> // fun

	s.createEffect(() => {
		console.log("context.value:", state.context.value)
	})
	s.createEffect(() => {
		console.log("context.committed_value:", state.context.committed_value)
	})
	s.createEffect(() => {
		console.log("status:", state.status)
	})
	s.createEffect(() => {
		console.log("value:", state.value)
	})

	setTimeout(() => {
		console.log('--- send: {type: "text.edit"}')
		text_actor.send({type: "text.edit"})

		console.log('--- send: {type: "text.change", value: "Hello"}')
		text_actor.send({type: "text.change", value: "Hello"})

		console.log('--- send: {type: "text.commit"}')
		text_actor.send({type: "text.commit"})

		console.log('--- send: {type: "text.edit"}')
		text_actor.send({type: "text.edit"})

		console.log('--- send: {type: "text.change", value: "Hello world"}')
		text_actor.send({type: "text.change", value: "Hello world"})

		console.log('--- send: {type: "text.cancel"}')
		text_actor.send({type: "text.cancel"})
	})

	return "hello"
}
