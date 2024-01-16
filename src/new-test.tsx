import * as x from "xstate"
import {useMachine} from "./xstate"

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
	const [current, send] = useMachine(machine)

	return (
		<>
			<button onclick={() => send({type: "increment"})}>inc_button</button>
			<button onclick={() => send({type: "holdIncrement", y: 0})}>hold_inc_button</button>
			<button onclick={() => send({type: "releasePointer"})}>release_button</button>
			{JSON.stringify(current.value)}
		</>
	)
}

export default Test
