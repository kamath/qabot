import { createACPProvider } from "@mcpc-tech/acp-ai-provider";
import { streamText } from "ai";

const provider = createACPProvider({
  command: "claude-agent-acp",
  args: [],
  session: {
    cwd: process.cwd(),
    mcpServers: [],
  },
});

export async function POST(req: Request) {
  const { prompt }: { prompt?: string } = await req.json();

  const result = streamText({
    model: provider.languageModel(),
    system: "You are a helpful assistant.",
    prompt: prompt ?? "Write a simple Hello World program",
    tools: provider.tools,
  });

  return result.toUIMessageStreamResponse();
}