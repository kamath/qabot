"use client"

import { useChat } from "@ai-sdk/react"
import {
	DefaultChatTransport,
	lastAssistantMessageIsCompleteWithToolCalls,
} from "ai"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { backendUrl, checkBackendSanity } from "@/lib/backend-client"

export default function Home() {
	const { messages, sendMessage } = useChat({
		transport: new DefaultChatTransport({
			api: `${backendUrl}/api/chat`,
		}),
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
		async onToolCall({ toolCall }) {
			if (toolCall.dynamic) {
				return
			}
		},
	})

	const [input, setInput] = useState("")

	const {
		data: sanityCheck,
		isLoading: sanityLoading,
		error: sanityError,
		refetch: runSanityCheck,
		isFetching: sanityChecking,
	} = useQuery({
		queryKey: ["backendSanity"],
		queryFn: checkBackendSanity,
		enabled: false,
	})

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-6 py-10">
			<section className="rounded-lg border p-4">
				<h2 className="mb-2 text-lg font-semibold">Backend sanity check</h2>
				<button
					type="button"
					onClick={() => runSanityCheck()}
					className="rounded-md border px-3 py-1.5"
					disabled={sanityChecking}
				>
					{sanityChecking ? "Checking..." : "Run sanity check"}
				</button>
				{sanityLoading ? <p>Waiting for backend response…</p> : null}
				{sanityError ? (
					<p className="text-red-600">
						{sanityError instanceof Error
							? sanityError.message
							: "Sanity check failed"}
					</p>
				) : null}
				{sanityCheck ? (
					<pre className="mt-2 whitespace-pre-wrap">
						{JSON.stringify(sanityCheck, null, 2)}
					</pre>
				) : null}
			</section>

			{messages?.map(message => (
				<div key={message.id}>
					<strong>{`${message.role}: `}</strong>
					{message.parts.map((part, index) => {
						switch (part.type) {
							case "text":
								return (
									<span key={`${message.id}-text-${index}`}>{part.text}</span>
								)
							default:
								return (
									<pre key={`${message.id}-part-${index}`}>
										{JSON.stringify(part, null, 2)}
									</pre>
								)
						}
					})}
					<br />
				</div>
			))}

			<form
				onSubmit={e => {
					e.preventDefault()
					if (input.trim()) {
						sendMessage({ text: input })
						setInput("")
					}
				}}
			>
				<input
					value={input}
					onChange={e => setInput(e.target.value)}
					className="w-full rounded-md border px-3 py-2"
					placeholder="Type a message..."
				/>
			</form>
		</main>
	)
}
