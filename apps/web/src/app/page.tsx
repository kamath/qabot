"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { backendClient } from "./../lib/backend-client";
import {
  isBackendGreetingResponse,
  isEchoResponse,
} from "@qabot/rpc";

export default function Home() {
  const { messages, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    async onToolCall({ toolCall }) {
      if (toolCall.dynamic) {
        return;
      }
    },
  });

  const [input, setInput] = useState("");

  const { data: health, isLoading: isBackendLoading } = useQuery({
    queryKey: ["backend", "ping"],
    queryFn: async () => {
      const res = await backendClient.ping.$get();
      const payload = await res.json();

      if (!isBackendGreetingResponse(payload)) {
        throw new Error("Invalid ping response shape from backend");
      }

      return payload;
    },
  });

  const echo = useMutation({
    mutationFn: async (message: string) => {
      const res = await backendClient.echo.$post({
        json: { message },
      });
      const payload = await res.json();

      if (!isEchoResponse(payload)) {
        throw new Error("Invalid echo response shape from backend");
      }

      return payload.received;
    },
  });

  const echoOutput = useMemo(() => {
    if (!echo.data) return null;
    return (
      <p className="rounded-md border px-3 py-2">
        Last echo: {echo.data}
      </p>
    );
  }, [echo.data]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-6 py-10">
      <section className="rounded-md border p-4">
        <h2 className="font-semibold">Backend via Hono RPC</h2>
        {isBackendLoading ? (
          <p>Checking backend…</p>
        ) : (
          <p>
            Status: {health?.status} | Service: {health?.service} | Time: {health?.time}
          </p>
        )}

        <button
          className="mt-2 rounded-md border px-3 py-1"
          onClick={() => {
            echo.mutate(input || "hello from web");
          }}
          type="button"
          disabled={echo.isPending}
        >
          {echo.isPending ? "Echoing..." : "Send echo to backend"}
        </button>
        {echoOutput}
      </section>

      {messages?.map((message) => (
        <div key={message.id}>
          <strong>{`${message.role}: `}</strong>
          {message.parts.map((part, index) => {
            switch (part.type) {
              case "text":
                return (
                  <span key={`${message.id}-text-${index}`}>{part.text}</span>
                );
              default:
                return (
                  <pre key={`${message.id}-part-${index}`}>
                    {JSON.stringify(part, null, 2)}
                  </pre>
                );
            }
          })}
          <br />
        </div>
      ))}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) {
            sendMessage({ text: input });
            setInput("");
          }
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full rounded-md border px-3 py-2"
          placeholder="Type a message..."
        />
      </form>
    </main>
  );
}
