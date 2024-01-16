import * as s from "solid-js"
import * as x from "xstate"

import {useActor, useMachine} from "./xstate"

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

const App: s.Component = () => {
	const [state, send] = useMachine(text_machine)

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
		send({type: "text.edit"})

		console.log('--- send: {type: "text.change", value: "Hello"}')
		send({type: "text.change", value: "Hello"})

		console.log('--- send: {type: "text.commit"}')
		send({type: "text.commit"})

		console.log('--- send: {type: "text.edit"}')
		send({type: "text.edit"})

		console.log('--- send: {type: "text.change", value: "Hello world"}')
		send({type: "text.change", value: "Hello world"})

		console.log('--- send: {type: "text.cancel"}')
		send({type: "text.cancel"})
	})

	return "hello"
}

function ActorTest() {
	const childMachine = x.createMachine({
		id: "childMachine",
		initial: "active",
		states: {
			active: {
				on: {
					FINISH: {actions: x.sendParent({type: "FINISH"})},
				},
			},
		},
	})
	const machine = x.createMachine({
		initial: "active",
		invoke: {
			id: "child",
			src: childMachine,
		},
		states: {
			active: {
				on: {FINISH: "success"},
			},
			success: {},
		},
	})

	const [machine_state] = useMachine(machine)

	const [actor_state, send] = useActor(() => machine_state.children.child)

	s.createEffect(() => {
		console.log("machine_state.matches('success')", machine_state.matches("success"))
	})

	s.createEffect(() => {
		console.log("actor_state.value", actor_state.value)
	})

	setTimeout(() => {
		send({type: "FINISH"})
	})

	return "look at the console"
}

export default ActorTest
