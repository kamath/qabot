import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"

const statusConfig = {
	ready: { variant: "default" as const, label: "Ready" },
	provisioning: { variant: "secondary" as const, label: "Provisioning" },
	error: { variant: "destructive" as const, label: "Error" },
} as const

export function WorkspaceStatusBadge({
	status,
}: {
	status: keyof typeof statusConfig
}) {
	const config = statusConfig[status]
	return (
		<Badge variant={config.variant}>
			{status === "provisioning" && <Spinner className="size-3" />}
			{config.label}
		</Badge>
	)
}
