"use client";

import { useCompletion } from "@ai-sdk/react";

export default function Home() {
  const { completion, complete, isLoading } = useCompletion({
    api: "/api/completion",
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 py-16">
      <button
        type="button"
        className="rounded-md border px-4 py-2"
        disabled={isLoading}
        onClick={async () => {
          await complete("What files do you see in the current directory?");
        }}
      >
        {isLoading ? "Generating..." : "Generate"}
      </button>
      <div className="max-w-2xl whitespace-pre-wrap">{completion}</div>
    </main>
  );
}
