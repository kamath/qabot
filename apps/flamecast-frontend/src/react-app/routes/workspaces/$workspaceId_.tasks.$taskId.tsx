import { createFileRoute } from "@tanstack/react-router"
import { TaskDetailPage } from "../../pages/task-detail-page"

export const Route = createFileRoute("/workspaces/$workspaceId_/tasks/$taskId")(
	{
		component: TaskDetailPage,
	},
)
