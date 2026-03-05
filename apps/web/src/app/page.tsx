"use client"

import { useChat } from "@ai-sdk/react"
import {
	DefaultChatTransport,
	lastAssistantMessageIsCompleteWithToolCalls,
} from "ai"
import { useState } from "react"

export default function Home() {
	const { messages, sendMessage, addToolOutput } = useChat({
		transport: new DefaultChatTransport({
			api: "/api/chat",
		}),
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
		async onToolCall({ toolCall }) {
			if (toolCall.dynamic) {
				return
			}
		},
	})
	const [input, setInput] = useState("")

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-6 py-10">
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

						// if (!part.type.startsWith("tool-")) {
						//   return (
						//     <pre key={`${message.id}-part-${index}`}>
						//       {JSON.stringify(part, null, 2)}
						//     </pre>
						//   );
						// }

						// const toolName = part.type.slice("tool-".length);
						// const callId =
						//   "toolCallId" in part ? part.toolCallId : `${message.id}-${index}`;

						// if (!("state" in part)) {
						//   return (
						//     <pre key={callId}>
						//       {toolName}: {JSON.stringify(part, null, 2)}
						//     </pre>
						//   );
						// }

						// switch (part.state) {
						//   case "input-streaming":
						//     return <div key={callId}>Preparing {toolName} request...</div>;
						//   case "input-available": {
						//     const inputPayload = "input" in part ? part.input : undefined;
						//     const messageFromInput =
						//       typeof inputPayload === "object" &&
						//       inputPayload !== null &&
						//       "message" in inputPayload
						//         ? String(inputPayload.message)
						//         : null;

						//     return (
						//       <div key={callId}>
						//         <div>{messageFromInput ?? `${toolName} is awaiting input.`}</div>
						//         <pre>{JSON.stringify(inputPayload, null, 2)}</pre>
						//         <div className="flex gap-2">
						//           <button
						//             type="button"
						//             className="rounded-md border px-3 py-1"
						//             onClick={() =>
						//               addToolOutput({
						//                 tool: toolName,
						//                 toolCallId: callId,
						//                 output: "Yes, confirmed.",
						//               })
						//             }
						//           >
						//             Yes
						//           </button>
						//           <button
						//             type="button"
						//             className="rounded-md border px-3 py-1"
						//             onClick={() =>
						//               addToolOutput({
						//                 tool: toolName,
						//                 toolCallId: callId,
						//                 output: "No, denied.",
						//               })
						//             }
						//           >
						//             No
						//           </button>
						//         </div>
						//       </div>
						//     );
						//   }
						//   case "output-available":
						//     return (
						//       <div key={callId}>
						//         {toolName}:{" "}
						//         {"output" in part && typeof part.output === "string"
						//           ? part.output
						//           : JSON.stringify("output" in part ? part.output : null)}
						//       </div>
						//     );
						//   case "output-error":
						//     return (
						//       <div key={callId}>
						//         Error in {toolName}:{" "}
						//         {"errorText" in part ? part.errorText : "Unknown error"}
						//       </div>
						//     );
						//   default:
						//     return (
						//       <pre key={callId}>
						//         {toolName}: {JSON.stringify(part, null, 2)}
						//       </pre>
						//     );
						// }
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
