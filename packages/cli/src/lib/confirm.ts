import { createInterface } from "node:readline"

export async function confirm(message: string): Promise<boolean> {
	const rl = createInterface({ input: process.stdin, output: process.stdout })
	return new Promise<boolean>(resolve => {
		rl.question(`${message} (y/N) `, answer => {
			rl.close()
			resolve(answer.trim().toLowerCase() === "y")
		})
	})
}
