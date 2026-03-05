import { createServer, type Server } from "node:http"
import { URL } from "node:url"

const PORTS = [19284, 19285, 19286]
const TIMEOUT_MS = 120_000

interface CallbackResult {
	code: string
	state: string
}

const SUCCESS_HTML = `<!DOCTYPE html>
<html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0">
<div style="text-align:center"><h2>Authentication successful</h2><p>You can close this tab and return to the terminal.</p></div>
</body></html>`

function tryListen(server: Server, port: number): Promise<void> {
	return new Promise((resolve, reject) => {
		server.once("error", reject)
		server.listen(port, "127.0.0.1", () => {
			server.removeListener("error", reject)
			resolve()
		})
	})
}

export async function startCallbackServer(): Promise<{
	port: number
	redirectUri: string
	waitForCallback: () => Promise<CallbackResult>
	close: () => void
}> {
	let resolve: (result: CallbackResult) => void
	let reject: (err: Error) => void
	const callbackPromise = new Promise<CallbackResult>((res, rej) => {
		resolve = res
		reject = rej
	})

	const server = createServer((req, res) => {
		if (!req.url?.startsWith("/callback")) {
			res.writeHead(404)
			res.end()
			return
		}

		const url = new URL(req.url, `http://127.0.0.1`)
		const code = url.searchParams.get("code")
		const state = url.searchParams.get("state")
		const error = url.searchParams.get("error")

		res.writeHead(200, { "Content-Type": "text/html" })
		res.end(SUCCESS_HTML)

		if (error) {
			reject!(new Error(`Authentication failed: ${error}`))
		} else if (code && state) {
			resolve!({ code, state })
		} else {
			reject!(new Error("Missing code or state in callback"))
		}
	})

	let boundPort: number | undefined
	for (const port of PORTS) {
		try {
			await tryListen(server, port)
			boundPort = port
			break
		} catch {}
	}

	if (!boundPort) {
		throw new Error(
			`Could not start callback server on any port (${PORTS.join(", ")})`,
		)
	}

	const timeout = setTimeout(() => {
		reject!(new Error("Authentication timed out"))
		server.close()
	}, TIMEOUT_MS)

	return {
		port: boundPort,
		redirectUri: `http://localhost:${boundPort}/callback`,
		waitForCallback: () => callbackPromise,
		close: () => {
			clearTimeout(timeout)
			server.close()
		},
	}
}
