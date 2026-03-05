import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"

const statusConfig = {
	completed: { variant: "default" as const, label: "Completed" },
	working: { variant: "secondary" as const, label: "Working" },
	submitted: { variant: "secondary" as const, label: "Submitted" },
	input_required: { variant: "outline" as const, label: "Input Required" },
	failed: { variant: "destructive" as const, label: "Failed" },
	cancelled: { variant: "outline" as const, label: "Cancelled" },
	archived: { variant: "outline" as const, label: "Archived" },
} as const

export function TaskStatusBadge({
	status,
}: {
	status: keyof typeof statusConfig
}) {
	const config = statusConfig[status]
	return (
		<Badge variant={config.variant}>
			{status === "working" && <Spinner className="size-3" />}
			{config.label}
		</Badge>
	)
}
