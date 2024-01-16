import * as s from "solid-js"
import * as x from "xstate"
import {createImmutable} from "@solid-primitives/immutable"

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

const persistedFetchState = actorRef.getPersistedSnapshot()

const Fetcher = () => {
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

	const actor = x.createActor(machine).start()

	const [snapshot, setSnapshot] = s.createSignal(actor.getSnapshot())
	actor.subscribe(setSnapshot)

	const current = createImmutable(snapshot) as any as ReturnType<typeof snapshot> // fun

	return (
		<s.Switch fallback={null}>
			<s.Match when={current.matches("idle")}>
				<button onclick={_ => actor.send({type: "FETCH"})}>Fetch</button>;
			</s.Match>
			<s.Match when={current.matches("loading")}>
				<div>Loading...</div>
			</s.Match>
			<s.Match when={current.matches("success")}>
				Success! Data: <div data-testid="data">{current.context.data}</div>
			</s.Match>
		</s.Switch>
	)
}

export default Fetcher
