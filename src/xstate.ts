import * as s from "solid-js"
import * as x from "xstate"
import {createImmutable} from "@solid-primitives/immutable"

export type Sender<TEvent> = (event: TEvent) => void

export function useActor<TActor extends x.ActorRef<any, any>>(
	actorRef: s.Accessor<TActor> | TActor,
): [x.SnapshotFrom<TActor>, TActor["send"]]
export function useActor<TSnapshot extends x.Snapshot<unknown>, TEvent extends x.EventObject>(
	actorRef: s.Accessor<x.ActorRef<TSnapshot, TEvent>> | x.ActorRef<TSnapshot, TEvent>,
): [TSnapshot, Sender<TEvent>]
export function useActor(
	actorRef:
		| s.Accessor<x.ActorRef<x.Snapshot<unknown>, x.EventObject>>
		| x.ActorRef<x.Snapshot<unknown>, x.EventObject>,
): [unknown, Sender<x.EventObject>] {
	const actor = typeof actorRef === "function" ? s.createMemo(actorRef) : () => actorRef

	const snapshotSignal = s.createMemo(() => {
		const current_actor = actor()
		const [snapshot, setSnapshot] = s.createSignal(current_actor.getSnapshot())
		current_actor.subscribe(setSnapshot)
		return snapshot
	})

	return [createImmutable(() => snapshotSignal()() as any), event => actor().send(event)]
}

export type UseMachineReturn<
	TMachine extends x.AnyStateMachine,
	TInterpreter = x.Actor<TMachine>,
> = [x.SnapshotFrom<TMachine>, x.Prop<TInterpreter, "send">, TInterpreter]

export function useMachine<TMachine extends x.AnyStateMachine>(
	machine: TMachine,
	options?: x.ActorOptions<TMachine>,
): UseMachineReturn<TMachine> {
	const actor = x.createActor(machine, options)
	const [snapshot, setSnapshot] = s.createSignal(actor.getSnapshot())
	actor.subscribe(setSnapshot)
	s.onCleanup(() => actor.stop())
	return [createImmutable(snapshot), actor.send, actor]
}
