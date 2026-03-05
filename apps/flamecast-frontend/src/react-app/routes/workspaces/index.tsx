import { createFileRoute } from "@tanstack/react-router"
import { WorkspacesListPage } from "../../pages/workspaces-list-page"

export const Route = createFileRoute("/workspaces/")({
	component: WorkspacesListPage,
})
