import * as s from "solid-js"
import * as x from "xstate"
import {useMachine} from "./xstate"

const context = {
	data: undefined as string | undefined,
}
const fetchMachine = x.createMachine({
	id: "fetch",
	types: {} as {
		context: typeof context
		events: {type: "FETCH"}
		actors: {
			src: "fetchData"
			logic: x.ActorLogicFrom<Promise<string>>
		}
	},
	initial: "idle",
	context,
	states: {
		idle: {
			on: {FETCH: "loading"},
		},
		loading: {
			invoke: {
				id: "fetchData",
				src: "fetchData",
				onDone: {
					target: "success",
					actions: x.assign({
						data: ({event}) => event.output,
					}),
					guard: ({event}) => !!event.output.length,
				},
			},
		},
		success: {
			type: "final",
		},
	},
})

const actorRef = x
	.createActor(
		fetchMachine.provide({
			actors: {
				fetchData: x.createMachine({
					initial: "done",
					states: {
						done: {
							type: "final",
						},
					},
					output: "persisted data",
				}) as any,
			},
		}),
	)
	.start()
actorRef.send({type: "FETCH"})

const machine = fetchMachine.provide({
	actors: {
		fetchData: x.fromPromise(
			() =>
				new Promise(res => {
					setTimeout(() => res("real data"), 1000)
				}),
		),
	},
})

const Fetcher = () => {
	const [current, send] = useMachine(machine)

	return (
		<s.Switch fallback={null}>
			<s.Match when={current.matches("idle")}>
				<button onclick={_ => send({type: "FETCH"})}>Fetch</button>;
			</s.Match>
			<s.Match when={current.matches("loading")}>
				<div>Loading...</div>
			</s.Match>
			<s.Match when={current.matches("success")}>
				Success! Data: <div>{current.context.data}</div>
			</s.Match>
		</s.Switch>
	)
}

export default Fetcher
