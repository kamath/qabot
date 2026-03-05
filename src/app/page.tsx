"use client";

import { useQuery } from "@tanstack/react-query";

type Joke = {
  id: number;
  setup: string;
  punchline: string;
};

export default function Home() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dad-joke"],
    queryFn: async () => {
      const response = await fetch(
        "https://official-joke-api.appspot.com/random_joke",
      );

      if (!response.ok) {
        throw new Error("Failed to fetch joke");
      }

      return (await response.json()) as Joke;
    },
    retry: 1,
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 py-16 text-zinc-100">
      <section className="w-full max-w-xl rounded-xl border border-zinc-800 bg-zinc-900 p-8 shadow-lg">
        <h1 className="mb-4 text-2xl font-semibold text-zinc-50">
          TanStack Query demo
        </h1>
        {isLoading ? (
          <p className="text-zinc-300">Loading a joke...</p>
        ) : isError ? (
          <p className="text-red-400">Error: {(error as Error).message}</p>
        ) : (
          <p className="text-lg text-zinc-100">
            <strong className="text-zinc-200">{data?.setup}</strong>{" "}
            <span className="text-zinc-300">{data?.punchline}</span>
          </p>
        )}
      </section>
    </main>
  );
}
