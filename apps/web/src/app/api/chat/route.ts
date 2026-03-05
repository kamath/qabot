import { createACPProvider } from "@mcpc-tech/acp-ai-provider";
import { convertToModelMessages, streamText } from "ai";

const provider = createACPProvider({
  // command: "claude-agent-acp",
  command: "codex-acp",
  args: [],
  session: {
    cwd: process.cwd(),
    mcpServers: [],
  },
});

export async function POST(req: Request) {
  const data = await req.json();
  console.log(data);

  const result = streamText({
    model: provider.languageModel(),
    system: "You are a helpful assistant.",
    messages: await convertToModelMessages(data.messages ?? [
      {
        role: "user",
        content: "Write a simple Hello World program",
      },
    ]),
    tools: provider.tools,
  });

  return result.toUIMessageStreamResponse();
}