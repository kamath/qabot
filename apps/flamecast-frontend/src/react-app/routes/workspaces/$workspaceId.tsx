import { createFileRoute } from "@tanstack/react-router"
import { WorkspaceDetailPage } from "../../pages/workspace-detail-page"

export const Route = createFileRoute("/workspaces/$workspaceId")({
	component: WorkspaceDetailPage,
})
