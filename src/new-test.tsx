import * as s from "solid-js"
import * as x from "xstate"
import {createImmutable} from "@solid-primitives/immutable"

const machine = x.createMachine({
	initial: "NotHeld",
	states: {
		NotHeld: {
			initial: "Idle",
			states: {
				Idle: {on: {increment: {target: "RecentlyClicked"}}},
				RecentlyClicked: {
					on: {increment: {target: "TripleClicked"}},
					after: {1000: "Idle"},
				},
				TripleClicked: {
					on: {increment: {target: "TripleClicked", reenter: true}},
					after: {1000: "Idle"},
				},
			},
			on: {holdIncrement: "Held.HeldIncrement"},
		},
		Held: {
			initial: "HeldIncrement",
			states: {
				HeldIncrement: {
					after: {1000: "HeldIncrement"},
				},
			},
			on: {releasePointer: "NotHeld.Idle"},
		},
	},
})

const Test = () => {
	const actor = x.createActor(machine).start()

	const [snapshot, setSnapshot] = s.createSignal(actor.getSnapshot())
	actor.subscribe(setSnapshot)

	const current = createImmutable(snapshot) as any as ReturnType<typeof snapshot> // fun

	return (
		<>
			<button onclick={() => actor.send({type: "increment"})}>inc_button</button>
			<button onclick={() => actor.send({type: "holdIncrement", y: 0})}>
				hold_inc_button
			</button>
			<button onclick={() => actor.send({type: "releasePointer"})}>release_button</button>
			{JSON.stringify(current.value)}
		</>
	)
}

//   const incrementButton = screen.getByTestId('inc_button');
//   const holdIncrementButton = screen.getByTestId('hold_inc_button');
//   const releasePointerButton = screen.getByTestId('release_button');

//   await sleep(100);
//   fireEvent.click(incrementButton);
//   await sleep(10);
//   fireEvent.click(incrementButton);
//   await sleep(10);
//   fireEvent.click(holdIncrementButton);
//   await sleep(10);
//   fireEvent.click(releasePointerButton);
//   await sleep(10);
//   fireEvent.click(incrementButton);
//   await sleep(10);
//   fireEvent.click(incrementButton);

export default Test
