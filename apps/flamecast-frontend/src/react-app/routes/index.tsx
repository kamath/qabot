import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { HomePage } from "../pages/home-page"

export const Route = createFileRoute("/")({
	validateSearch: z.object({
		runId: z.string().optional(),
	}),
	component: HomePage,
})
